import { generateProof } from "./proof.js";
import { T, delta, N } from "./constants.js";
import { verifyProof } from "./verify.js";


async function main() {


    const seed = BigInt("0x1234abcd");
    const { y, proof } = await generateProof(seed, T, delta, N);
    console.log(y, proof);
    const isValid = await verifyProof(seed, y, T, delta, proof, N);
    console.log("✅ Verification passed?", isValid);
}

main().catch(console.error);