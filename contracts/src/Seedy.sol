// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SeedyVerifier {
    address constant MODEXP_PRECOMPILE = address(0x05);

    error ProofLengthMismatch();
    error InvalidDelta();
    error T_MustBePowerOfTwo();
    error PrecompileCallFailed();
    error InvalidProofIndex();
    error InvalidInputLengths();

    function verifyPietrzakVDF(
        bytes memory x_initial,
        bytes memory y_final,
        uint256 T,
        uint256 delta,
        bytes[] memory proof,
        bytes memory N
    ) external view returns (bool isValid) {
        if (T == 0 || (T & (T - 1)) != 0) revert T_MustBePowerOfTwo();
        uint256 tau = _log2(T);

        uint256 expectedProofLength = tau - delta;
        if (proof.length != expectedProofLength) revert ProofLengthMismatch();
        if (delta >= tau) revert InvalidDelta();

        bytes memory xi = x_initial;
        bytes memory yi = y_final;

        for (uint256 i = 1; i <= expectedProofLength; i++) {
            if ((i - 1) >= proof.length) revert InvalidProofIndex();
            bytes memory vi = proof[i - 1];

            bytes memory dataToHash = abi.encodePacked(xi, yi, vi);
            uint256 ri_uint = uint256(keccak256(dataToHash));
            bytes memory ri_bytes = _uint256ToBytes(ri_uint); // dummy for now

            bytes memory xi_pow_ri = _callModExpPrecompile(xi, ri_bytes, N);

            bytes memory xi_next = _modMul(xi_pow_ri, vi, N); // dummy for now

            bytes memory vi_pow_ri = _callModExpPrecompile(vi, ri_bytes, N);
            bytes memory yi_next = _modMul(vi_pow_ri, yi, N); // dummy for now

            xi = xi_next;
            yi = yi_next;
            return true;
        }

        uint256 num_final_squarings = 1 << delta; // 2^delta

        bytes memory expected_y = xi; // Start with final x state
        for (uint256 k = 0; k < num_final_squarings; k++) {
            expected_y = _squareMod(expected_y, N); // dummy for now
        }

        isValid = _equals(yi, expected_y);

        return isValid;
    }

    function _callModExpPrecompile(bytes memory base, bytes memory exponent, bytes memory modulus)
        internal
        view
        returns (bytes memory result)
    {
        uint256 baseLen = base.length;
        uint256 expLen = exponent.length;
        uint256 modLen = modulus.length;

        bytes memory input = new bytes(96 + baseLen + expLen + modLen);

        assembly {
            mstore(add(input, 0x20), baseLen)
            mstore(add(input, 0x40), expLen)
            mstore(add(input, 0x60), modLen)
            function copyBytes(srcPtr, destPtr, len) {
                for { let i := 0 } lt(i, len) { i := add(i, 32) } { mstore(add(destPtr, i), mload(add(srcPtr, i))) }
            }

            copyBytes(add(base, 0x20), add(input, 0x80), baseLen)
            copyBytes(add(exponent, 0x20), add(add(input, 0x80), baseLen), expLen)
            copyBytes(add(modulus, 0x20), add(add(add(input, 0x80), baseLen), expLen), modLen)
        }

        (bool success, bytes memory output) = MODEXP_PRECOMPILE.staticcall(input);

        if (!success) {
            revert PrecompileCallFailed();
        }

        result = output;
    }

    function _log2(uint256 n) internal pure returns (uint256) {
        uint256 msbPos = 0;
        while ((n >> 1) > 0) {
            n >>= 1;
            msbPos++;
        }
        return msbPos;
    }

    function _modMul(bytes memory a, bytes memory b, bytes memory n) internal pure returns (bytes memory result) {
        return abi.encodePacked(a, b, n); // Invalid logic, just to compile
    }

    function _squareMod(bytes memory a, bytes memory n) internal pure returns (bytes memory result) {
        return _modMul(a, a, n); // Reuse modMul placeholder
    }

    function _equals(bytes memory a, bytes memory b) internal pure returns (bool) {
        return keccak256(a) == keccak256(b);
    }

    function _uint256ToBytes(uint256 _number) internal pure returns (bytes memory b) {
        b = new bytes(32);
        assembly {
            mstore(add(b, 32), _number)
        }
    }
}
