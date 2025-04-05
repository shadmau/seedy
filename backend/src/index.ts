import { generateProof } from "./proof.js";
import { T, delta, N } from "./constants.js";
import { verifyProof } from "./verify.js";


async function main() {


    const seed = BigInt("0x1234abcd");
    const { y, proof } = await generateProof(seed, T, delta, N);
    console.log("Seed (x):", seed.toString(16));
    console.log("Output (y):", y.toString(16));
    console.log("Proof (π):", proof.map(p => p.toString(16)));
    console.log("Modulus (N):", N.toString(16));
    
    const isValid = await verifyProof(seed, y, T, delta, proof, N);
    console.log("✅ Verification passed?", isValid);
}

main().catch(console.error);