import { ethers } from 'ethers';
import { PADDED_1024_BIT_HEX_LENGTH } from '../constants.js';

function bigintToMinimalHex(n: bigint, pad = false): string {
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


    if (pad && hex.length < PADDED_1024_BIT_HEX_LENGTH) {
        hex = hex.padStart(PADDED_1024_BIT_HEX_LENGTH, '0');
    }
    return '0x' + hex;
}

export function hashBigIntsEthersStyle(pad = false, ...args: bigint[]): bigint {
    const types = args.map(() => 'bytes');
    let values = args.map((n, i) => bigintToMinimalHex(n, i === 2 ? false : pad)); // Do not pad vi, since its not coming from BigNumber.sol
    const hashHex = ethers.solidityPackedKeccak256(types, values);
    return BigInt(hashHex);
}