import { ethers } from 'ethers'; 


function bigintToMinimalHex(n: bigint): string {
    if (n < 0) {
        throw new Error("Negative numbers not handled for packing bytes.");
    }
    if (n === BigInt(0)) {
        return '0x00';
    }
    let hex = n.toString(16);
    if (hex.length % 2 !== 0) {
        hex = '0' + hex;
    }
    return '0x' + hex;
}


export function hashBigIntsEthersStyle(...args: bigint[]): bigint {

    const types = args.map(() => 'bytes');

    const values = args.map(n => bigintToMinimalHex(n));

    const hashHex = ethers.solidityPackedKeccak256(types, values);

    return BigInt(hashHex);
}
