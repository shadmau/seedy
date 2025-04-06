import { generateProof } from "./proof.js";
import { T, delta, N } from "./constants.js";
import { verifyProof } from "./verify.js";


async function main() {

//    const seed = BigInt("0xba6173a16341f9648039d0191ce865d1a7c3fb426892e5985cf39d47f11abff0");
//0xd8a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257

//valid seed: 0xba6173a16341f96480, 0x3a74a92014645ed1a6


// Generate a list of 100 seeds, each 72 bits (9 bytes)
    const seed = BigInt("0x3a74a92014645ed1a6");
    const { y, proof } = await generateProof(seed, T, delta, N);
    console.log("Seed (x):", toEvenLengthHex(seed));
    console.log("Output (y):", toEvenLengthHex(y));
    console.log("Proof (π):", proof.map(p => toEvenLengthHex(p)));
    console.log("Modulus (N):", toEvenLengthHex(N));




    // Print Solidity format

    // const proof = [
    //     BigInt('0x066c83979c2f1e85d767471519ba55400f5a1b6aa07e14f155cecf648731df78b731e1d62c0d10a5b71c47f4531c13cdc6f2dfba9e22df82322213b545cf7528dbfb7e9e263e1aad0167712643358376bdc724b5046a5c94da597fce3b7d8ab52dd7a5b41806fc28a67154e3c0502f52a05c02c158db75a7c358c2e51523eabc59'),
    //     BigInt('0x881f4ac3e09376f0e3c065f08c003daea28288a5ad0a03908f309a583238ebae6831bc68e2a7f7739f025b0a4f8510d3aca9888048db262be7864c0eca1caf8a3b04893f6b46f60e337b7bde798cf45631fc78e1c01d03f6d6de4310cd428e97f2b41994e2b4551870fb3e26274244f7e8d2d69b1275b76efe467f72a3227489'),
    //     BigInt('0x0a2d2f91637d233127b62fce917736117ad31d09b761d81b087a50ab7e7f2a15ebc68d20d313f9241ca51598e888641348f3c05c39c741e43c101a4750663d2cd6d05343eb3a183ff5124284382feaa18268abb141f7622e5d343b61bb1c7daa4fe590524536e94a1b88d74b0174ab40bfb640806e4474549a1391b59d6d573f82'),
    //         BigInt('0x0b9f13e348e62612388d915add77ed744d2dc731bc8ccc2138ae598dc22083c7109c4241f73ce77d43516aab9228fd5a49502305abe07b988a49e6456d50f6d0fadb6559641c1324a51a0d432e8bd246af2e4e7030fce040e6978fa9c784ecac2a641bf59a7de16fb3e315f5d60eec5848c7b10af8926147754a00aaa226f23371'),
    //         BigInt('0x0a879b67c7814eff34373451d767a885678778de35d9a1336d812c844fa904bd017ad2e2063b6802e395f49ab1c0d5be836b596ba80096431a1d197a555e58f62ddb127ad2209a1c40408c5819cb07d91f0da9fcd32ce32d97cb1627ab70c460ee4a28dab192f0be17430fc5bde414a0bc7c50044bf480eb1a17bb72218696c4d6'),
    //         BigInt('0x0830d7f92be9d7e69c96e6ec0ea68d38fa657b001b9fe722b964024a64b875631284c5fcbf188c1b69d82e39baf032155034c09cb6cd74f88e2b3aeca5c9360fae19c9e9a1e11510a1c20a16c4d3c3f2fe06405bcc92920acee5d480f7898149e67952ec52a6394c8df1da0f5954cc5f3abb55fa35537eb48f9e178c388c4d65ea')    
    //   ]
    
    // const y =BigInt("0x0344f9790741bce8b2e18da20fecbe300fd94574e7650204b7609e3557c88bab9a6d6f2b494ba4316cdca705fd46e823e7d4692388cb23eb8c36fb30d1b966973a7c22a3c11a79215c141856d951215487931249665bb35823bea23fa790ce6dcc84cb11338a144b192280820c74a58f3bef2ca89438f825a27169fedc0791da7d")
    
    const isValid = await verifyProof(seed, y, T, delta, proof, N);
    console.log("✅ Verification passed?", isValid);
    printSolidityFormat(seed, y, T, delta, proof, N);

}

function toEvenLengthHex(x: bigint) {
    let raw = x.toString(16);
    if (raw.length % 2 !== 0) {
        // prepend one '0'
        raw = '0' + raw;
    }
    return raw;
}

function printSolidityFormat(seed: bigint, y: bigint, T: number, delta: number, proof: bigint[], N: bigint) {
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

main().catch(console.error);