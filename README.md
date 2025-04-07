# Seedy: Trustless On-Chain Randomness via VDF

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> On-chain VDF verifier enabling trustless, tamper-resistant randomness on EVM.

## Problem

Secure and fair randomness on-chain is hard. Block variables are manipulable, and oracles introduce external trust assumptions and costs.

## Solution: Seedy VDF

Seedy uses **Verifiable Delay Functions (VDFs)** based on the Pietrzak scheme to provide:

1.  **Tamper Resistance:** A mandatory time delay (`T`) prevents predicting/biasing the output randomness (`y`) after a seed `x` is known.
2.  **Trustless On-Chain Verification:** A cryptographic proof (`pi`) allows our `SeedyVerifier.sol` contract to mathematically validate the VDF computation directly on-chain.

The final randomness is `keccak256(y)`. This approach offers enhanced security guarantees compared to alternatives by verifying the computation proof trustlessly on-chain.

## Architecture

* `/contracts`: Solidity contracts (`SeedyVerifier`, `SeedyCoordinator`, `Raffle` example).
* `/experiments`: TypeScript implementation for off-chain VDF proving (`generateProof`) and testing.
* `/frontend`: React/Next.js frontend for the `Raffle` example.

## How it Works (Flow)

1.  **Request:** Commit to a seed source (future blockhashes) via `SeedyCoordinator`.
2.  **Compute:** Off-chain prover calculates VDF output `y` and proof `pi` over time `T`.
3.  **Finalize:** Prover submits `x, y, pi` to `SeedyCoordinator`.
4.  **Verify:** `SeedyCoordinator` calls `SeedyVerifier.verify()` for on-chain validation.
5.  **Result:** Coordinator provides `keccak256(y)` as the final random output.

## Getting Started & Running Locally

* **Prerequisites:** Node.js, npm, Foundry.
* **Contracts:** `cd contracts && forge build && forge test`
* **Experiments (Prover/Test Script):** `cd experiments && npm install && node ./dist/index.js`
* **Frontend Demo:** `cd frontend && npm install && npm run dev`

## Deployed Contracts (Base Sepolia Testnet)

* **SeedyVerifier:** [`0xd4ee61b3CB112747B534876E4c5F7e60b36E2893`](https://base-sepolia.blockscout.com/address/0xd4ee61b3CB112747B534876E4c5F7e60b36E2893)
* **SeedyCoordinator:** [`0xf25469bdf21c06aff3f4236b8e0ca1b51c9e5ec6`](https://base-sepolia.blockscout.com/address/0xf25469bdf21c06aff3f4236b8e0ca1b51c9e5ec6)
* **Raffle:** [`0xF918db551C9C9bd8c960582676657b32DcD19b4a`](https://base-sepolia.blockscout.com/address/0xF918db551C9C9bd8c960582676657b32DcD19b4a)



## Future Work

* Dvelop a robust BigNumber library for Solidity.
* Debug and scale the off-chain prover for large `T` & target delays.
* Explore gas optimizations (e.g., zk-VDF).
* Develop more RNG use cases.

## License

[MIT](LICENSE)