import { generateProof } from "./proof.js";
import { T, delta, N } from "./constants.js";
import { verifyProof } from "./verify.js";
import { createPublicClient, http, Abi } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as crypto from 'crypto';

interface VerificationResult {
    out1: string;
    out2: string;
}

const SEEDY_VERIFIER_ADDRESS = "0xd4ee61b3CB112747B534876E4c5F7e60b36E2893";
const INITIAL_SEED = BigInt("0xaecedc4a64713bfa008493698bfaa2704f6dfcc90551053b4a589fcf0c8e5bca");

const SEEDY_VERIFIER_ABI = [
    {
        inputs: [
            { name: "x", type: "bytes" },
            { name: "y", type: "bytes" },
            { name: "T", type: "uint256" },
            { name: "delta", type: "uint256" },
            { name: "proof", type: "bytes[]" },
            { name: "N", type: "bytes" }
        ],
        name: "verify",
        outputs: [
            { name: "out1", type: "bytes" },
            { name: "out2", type: "bytes" }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const;

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http()
});

function toEvenLengthHex(x: bigint): string {
    let raw = x.toString(16);
    return raw.length % 2 !== 0 ? '0' + raw : raw;
}

function printSolidityFormat(
    seed: bigint,
    y: bigint,
    T: number,
    delta: number,
    proof: bigint[],
    N: bigint
): void {
    console.log("\n// Solidity format:");
    console.log(`  bytes memory x = hex"${toEvenLengthHex(seed)}";`);
    console.log(`  bytes memory y = hex"${toEvenLengthHex(y)}";`);
    console.log(`  bytes memory N = hex"${toEvenLengthHex(N)}";`);
    console.log(`\n  uint256 T = ${T};`);
    console.log(`  uint256 delta = ${delta};`);
    console.log("  bytes[] memory proof = new bytes[](11);");
    proof.forEach((p, i) => {
        console.log(`  proof[${i}] = hex'${toEvenLengthHex(p)}';`);
    });
}


function generateNewSeed(currentSeed: bigint): bigint {
    const seedHex = currentSeed.toString(16).padStart(64, '0');
    const hash = crypto.createHash('sha256')
        .update(Buffer.from(seedHex, 'hex'))
        .digest('hex');
    return BigInt(`0x${hash}`);
}


async function iterativeTest(): Promise<void> {
    let seed = INITIAL_SEED;

    while (true) {
        try {
            seed = generateNewSeed(seed);
            console.log("Seed:", `0x${seed.toString(16)}`);

            const { y: debugY, proof: debugProofBigInts } = await generateProof(seed, T, delta, N);
            const yHex = toEvenLengthHex(debugY);
            const proofHex = debugProofBigInts.map(toEvenLengthHex);

            const verificationResult = await publicClient.readContract({
                address: SEEDY_VERIFIER_ADDRESS,
                abi: SEEDY_VERIFIER_ABI as Abi,
                functionName: 'verify',
                args: [
                    `0x${toEvenLengthHex(seed)}`,
                    `0x${yHex}`,
                    T,
                    delta,
                    proofHex.map(p => `0x${p}`),
                    `0x${toEvenLengthHex(N)}`
                ]
            }) as VerificationResult;

            if (verificationResult.out1 === verificationResult.out2) {
                console.log("✅ Verification passed! Seed:", seed.toString(16));
            } else {
                console.error("❌ Verification failed! Seed:", seed.toString(16));
                process.exit(1);
            }
        } catch (error) {
            console.error("Error during iterative testing:", error);
            process.exit(1);
        }
    }
}


async function main(): Promise<void> {
    let iterative = true
    if (iterative) {
        await iterativeTest();

    } else {
        try {

            const seed = INITIAL_SEED;
            const { y, proof } = await generateProof(seed, T, delta, N);

            console.log("\nSingle Proof Demonstration:");
            console.log("Seed (x):", toEvenLengthHex(seed));
            console.log("Output (y):", toEvenLengthHex(y));
            console.log("Proof (π):", proof.map(p => toEvenLengthHex(p)));
            console.log("Modulus (N):", toEvenLengthHex(N));

            const isValid = await verifyProof(seed, y, T, delta, proof, N);
            console.log("✅ Verification passed?", isValid);

            printSolidityFormat(seed, y, T, delta, proof, N);
        } catch (error) {
            console.error("Error in main function:", error);
        }
    }
}

main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});