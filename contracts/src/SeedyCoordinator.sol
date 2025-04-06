// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./SeedyVerifier.sol";

contract SeedyCoordinator {
    uint256 public requestCounter;

    SeedyVerifier public immutable verifier;

    bytes public constant VDF_MODULUS =
        hex"0C196BA6B8F017E8A7D66F83240C5F4ACF45C8F6F9E48F2B9D63C6F9B742CCB8701F3AF0B66D34AB63D6C6EFA509572DFE3019575280EF967A0C0E9A0B68B10CB6A7063BD5C7CC7FC1F76147CB1A45A3F802E8A8774E37CF11F750B15811D37F321293C29F67CBAA4C9E4C7A3AD1830F06069DC271D48D2611B1EF8B64C7EAD9C1";

    struct RandomnessRequest {
        address requester;
        uint256 requestBlock;
        uint256 blockDelay;
        uint256 T;
        uint256 delta;
        bool finalized;
        bytes32 seed;
        bytes finalY;
        bytes32 finalHash;
    }

    mapping(uint256 => RandomnessRequest) public requests;

    event RandomnessRequested(
        uint256 indexed requestId, address indexed requester, uint256 blockDelay, uint256 T, uint256 delta
    );

    event RandomnessFinalized(uint256 indexed requestId, bytes32 seed, bytes finalY, bytes32 finalHash);

    constructor(address _seedyVerifier) {
        verifier = SeedyVerifier(_seedyVerifier);
    }

    function requestRandomness(uint256 blockDelay, uint256 T, uint256 delta) external returns (uint256 requestId) {
        requestId = ++requestCounter;

        requests[requestId] = RandomnessRequest({
            requester: msg.sender,
            requestBlock: block.number,
            blockDelay: blockDelay,
            T: T,
            delta: delta,
            finalized: false,
            seed: 0,
            finalY: "",
            finalHash: 0
        });

        emit RandomnessRequested(requestId, msg.sender, blockDelay, T, delta);
    }

    function computeSeed(uint256 requestId) public view returns (bytes32 seed) {
        RandomnessRequest memory r = requests[requestId];
        require(r.requestBlock > 0, "Invalid requestId");

        uint256 lastBlock = r.requestBlock + r.blockDelay;

        bytes32 hashAccum = 0;
        //! todo: revert if < 255 blocks
        for (uint256 b = r.requestBlock + 1; b <= lastBlock; b++) {
            hashAccum = keccak256(abi.encode(hashAccum, blockhash(b)));
        }
        return hashAccum;
    }

    function finalizeRandomness(uint256 requestId, bytes calldata y, bytes[] calldata proof, bytes calldata x)
        external
        returns (bytes32 finalRand)
    {
        RandomnessRequest storage r = requests[requestId];
        require(!r.finalized, "Already finalized");
        require(r.requestBlock > 0, "Invalid requestId");

        require(block.number >= r.requestBlock + r.blockDelay, "Seed not ready yet");

        // bytes32 seed32 = computeSeed(requestId);
        // bytes memory x = abi.encodePacked(seed32);

        (bytes memory computedExpected, bytes memory actualY) = verifier.verify(x, y, r.T, r.delta, proof, VDF_MODULUS);

        require(keccak256(computedExpected) == keccak256(actualY), "VDF invalid");

        r.finalized = true;
        r.finalHash = keccak256(actualY);
        finalRand = r.finalHash;

        emit RandomnessFinalized(requestId, computeSeed(requestId), actualY, r.finalHash);
    }

    function getFinalRandomness(uint256 requestId) external view returns (bytes32 finalValue) {
        finalValue = requests[requestId].finalHash;
    }
}
