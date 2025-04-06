// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {BigNumber, BigNumbers} from "./BigNumbers.sol";


contract SeedyVerifier {
    address constant MODEXP_PRECOMPILE = address(0x05);

    error ProofLengthMismatch(uint256 expected, uint256 actual);
    error InvalidDelta(uint256 delta, uint256 tau);
    error T_MustBePowerOfTwo();
    error PrecompileCallFailed();
    error ModulusIsZero();
    error InputNegative();

    // --- VDF Verification Logic ---

    function verify(
        bytes calldata x,
        bytes calldata y,
        uint256 T,
        uint256 delta,
        bytes[] calldata proof,
        bytes calldata N
    ) external view returns (bytes memory out1, bytes memory out2) {
        // --- Input Validation ---
        if (T == 0 || (T & (T - 1)) != 0) revert T_MustBePowerOfTwo();
        uint256 tau = _log2(T);
        if (delta >= tau) revert InvalidDelta(delta, tau);
        uint256 expectedProofLength = tau - delta;
        if (proof.length != expectedProofLength) {
            revert ProofLengthMismatch(expectedProofLength, proof.length);
        }

        // --- VDF Verification Loop ---
        bytes memory xi = x;
        bytes memory yi = y;

        for (uint256 i = 0; i < expectedProofLength; i++) {
            (xi, yi) = _vdfStep(xi, yi, proof[i], N);
        }

        // Final Check Step ---
        //  expected_y = xi ^ (2^(2^delta)) mod N
        bytes memory current_x = xi;
        uint256 num_squarings = 1 << delta;
        bytes memory expected_y = current_x;

        for (uint256 i = 0; i < num_squarings; i++) {
            expected_y = _modExp(expected_y, hex"02", N);
        }

        return (expected_y, yi);
    }

    function _vdfStep(
        bytes memory xi,
        bytes memory yi,
        bytes calldata vi,
        bytes calldata N
    ) internal view returns (bytes memory new_xi_bytes, bytes memory new_yi_bytes) {
        // console.log("--- VDF Step ---");
        // console.log("xi (input):");
        // console.logBytes(xi);
        // console.log("yi (input):");
        // console.logBytes(yi);
        // console.log("vi (proof element):");
        // console.logBytes(vi);
        // console.log("N (modulus):");
        // console.logBytes(N);
        // console.log("encodePacked(xi, yi, vi):");
        // console.logBytes(abi.encodePacked(xi, yi, vi));
        bytes32 ri_hash = keccak256(abi.encodePacked(xi, yi, vi));
        // console.log("ri_hash:");
        // console.logBytes32(ri_hash);
        bytes memory ri_bytes = abi.encodePacked(uint256(ri_hash));
        // console.log("ri (hash(xi, yi, vi)):");
        // console.logBytes(ri_bytes);
        
        bytes memory xi_pow_ri_bytes = _modExp(xi, ri_bytes, N);
        // console.log("xi_pow_ri (xi^ri mod N):");
        // console.logBytes(xi_pow_ri_bytes);

        bytes memory vi_pow_ri_bytes = _modExp(vi, ri_bytes, N);
        // console.log("vi_pow_ri (vi^ri mod N):");
        // console.logBytes(vi_pow_ri_bytes);

        new_xi_bytes = _calculate_new_xi(xi_pow_ri_bytes, vi, N);
        // console.log("Final new_xi:");
        // console.logBytes(new_xi_bytes);

        new_yi_bytes = _calculate_new_yi(vi_pow_ri_bytes, yi, N);
        // console.log("Final new_yi:");
        // console.logBytes(new_yi_bytes);
        // console.log("--- End VDF Step ---");
    }
    
    /**
     * @dev Calculates new_xi = (xi^ri * vi) mod N
     */
    function _calculate_new_xi(
        bytes memory xi_pow_ri_bytes,
        bytes calldata vi,
        bytes calldata N
    ) internal view returns (bytes memory new_xi_bytes) {
        bytes memory ONE_BYTES = hex"01";

        BigNumber memory bn_xi_pow_ri = BigNumbers.init(xi_pow_ri_bytes, false);
        BigNumber memory bn_vi = BigNumbers.init(vi, false);

        BigNumber memory bnR_xi = BigNumbers.mul(bn_xi_pow_ri, bn_vi);
        // console.log("Intermediate mul result for new_xi (xi_pow_ri * vi):");
        // console.logBytes(bnR_xi.val);

        new_xi_bytes = _modExp(bnR_xi.val, ONE_BYTES, N);
    }

    /**
     * @dev Calculates new_yi = (vi^ri * yi) mod N
     */
    function _calculate_new_yi(
        bytes memory vi_pow_ri_bytes,
        bytes memory yi,
        bytes calldata N
    ) internal view returns (bytes memory new_yi_bytes) {
        bytes memory ONE_BYTES = hex"01";

        BigNumber memory bn_vi_pow_ri = BigNumbers.init(vi_pow_ri_bytes, false);
        BigNumber memory bn_yi = BigNumbers.init(yi, false);

        BigNumber memory bnR_yi = BigNumbers.mul(bn_vi_pow_ri, bn_yi);
        // console.log("Intermediate mul result for new_yi (vi_pow_ri * yi):");
        // console.logBytes(bnR_yi.val);

        new_yi_bytes = _modExp(bnR_yi.val, ONE_BYTES, N);
    }

    /**
     * @dev Performs modular exponentiation using the EIP-198 precompile.
     */
    function _modExp(
        bytes memory base,
        bytes memory exponent,
        bytes memory modulus
    ) internal view returns (bytes memory result) {
        uint256 baseLen = base.length;
        uint256 expLen = exponent.length;
        uint256 modLen = modulus.length;
        if (modLen == 0) return bytes('');

        bytes memory input = new bytes(96 + baseLen + expLen + modLen);
        assembly {
            mstore(add(input, 0x20), baseLen)
            mstore(add(input, 0x40), expLen)
            mstore(add(input, 0x60), modLen)

            let inputDataPtr := add(input, 0x80)

            let basePtr := add(base, 0x20)
            let i := 0
            for { } lt(i, baseLen) { i := add(i, 32) } {
                mstore(add(inputDataPtr, i), mload(add(basePtr, i)))
            }

            let expDataPtr := add(inputDataPtr, baseLen)
            let expPtr := add(exponent, 0x20)
            i := 0
            for { } lt(i, expLen) { i := add(i, 32) } {
                 mstore(add(expDataPtr, i), mload(add(expPtr, i)))
             }

            let modDataPtr := add(expDataPtr, expLen)
            let modPtr := add(modulus, 0x20)
            i := 0
            for { } lt(i, modLen) { i := add(i, 32) } {
                mstore(add(modDataPtr, i), mload(add(modPtr, i)))
            }
        }
        
        (bool success, bytes memory output) = MODEXP_PRECOMPILE.staticcall(input);
        if (!success) {
            revert PrecompileCallFailed();
        }
        result = output;
    }

    /**
     * @dev Calculates floor(log2(n)) for n > 0.
     */
    function _log2(uint256 n) internal pure returns (uint256) {
        require(n > 0, "_log2: Input must be positive");
        uint256 len = BigNumbers.bitLength(n);
        if (len == 0) return 0;
        return len - 1;
    }
}
