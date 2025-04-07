import { PADDED_1024_BIT_HEX_LENGTH } from '@/constants';
import { modPow } from 'bigint-crypto-utils';
import { ethers } from 'ethers';
import { bytesToBigInt as viemBytesToBigInt, hexToBytes } from 'viem';



export function bytesInputToBigInt(input: `0x${string}` | Uint8Array | string): bigint {
    console.log(`[VDF Debug] bytesInputToBigInt: Input type=${typeof input}, value=`, input);
    let result: bigint;
    try {
        if (typeof input === 'string' && input.startsWith('0x')) {
            const bytes = hexToBytes(input as `0x${string}`);
            result = viemBytesToBigInt(bytes);
        } else if (input instanceof Uint8Array) {
            result = viemBytesToBigInt(input);
        } else {
            result = BigInt(input);
        }
        console.log(`[VDF Debug] bytesInputToBigInt: Output = ${result}`);
        return result;
    } catch (e) {
        console.error(`[VDF Debug] bytesInputToBigInt: Error converting input`, e);
        throw e;
    }
}

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
    console.log(`[VDF Debug] hashBigIntsEthersStyle: Input args = [${args.join(', ')}]`);
    const types = args.map(() => 'bytes');
    const values = args.map((n, i) => bigintToMinimalHex(n, i === 2 ? false : pad)); // Do not pad vi, since its not from BigNumber.sol
    console.log(`[VDF Debug] hashBigIntsEthersStyle: Packing types = [${types.join(', ')}]`);
    console.log(`[VDF Debug] hashBigIntsEthersStyle: Packing values = [${values.join(', ')}]`);
    let hashHex: string;
    try {
        hashHex = ethers.solidityPackedKeccak256(types, values);
        console.log(`[VDF Debug] hashBigIntsEthersStyle: Packed hash hex = ${hashHex}`);
    } catch (e) {
        console.error(`[VDF Debug] hashBigIntsEthersStyle: Error during solidityPackedKeccak256`, e);
        throw e;
    }
    try {
        const result = BigInt(hashHex);
        console.log(`[VDF Debug] hashBigIntsEthersStyle: Final hash bigint = ${result}`);
        return result;
    } catch (e) {
        console.error(`[VDF Debug] hashBigIntsEthersStyle: Error converting hash hex ${hashHex} to BigInt`, e);
        throw e;
    }
}


export async function evaluateVDF(x: bigint, TInput: bigint | number, N: bigint): Promise<bigint> {
    const T = BigInt(TInput);
    console.log(`[VDF Debug] evaluateVDF: Starting... x=${x}, T=${T}, N=${N}`);
    if (T < 0) {
        console.error("[VDF Debug] evaluateVDF: T cannot be negative.");
        throw new Error("T must not be negative");
    }
    if (T === BigInt(0)) {
        console.log("[VDF Debug] evaluateVDF: T is 0, returning x directly.");
        return x;
    }

    let y = x;
    const tNum = Number(T);
    if (!Number.isSafeInteger(tNum)) {
        console.warn(`[VDF Debug] evaluateVDF: T=${T} may be too large for JS loop counter.`);
    }
    console.log(`[VDF Debug] evaluateVDF: Starting loop for ${tNum} iterations.`);
    const logInterval = tNum > 0 ? Math.max(1, Math.floor(tNum / 10)) : 1;

    for (let i = 0; i < tNum; i++) {
        try {
            y = modPow(y, BigInt(2), N);
        } catch (e) {
            console.error(`[VDF Debug] evaluateVDF: Error in modPow at iteration ${i}, y=${y}, N=${N}`, e);
            throw e;
        }
        if ((i + 1) % logInterval === 0 || i === tNum - 1) {
            const yStr = y.toString();
            const loggedY = yStr.length > 100 ? yStr.substring(0, 50) + "..." + yStr.substring(yStr.length - 50) : yStr;
            console.log(`[VDF Debug] evaluateVDF: Iteration ${i + 1}/${tNum}, current y=${loggedY}`);
        }
    }
    console.log(`[VDF Debug] evaluateVDF: Finished. Final y = ${y}`);
    return y;
}

export async function generateProof(xInput: `0x${string}` | bigint, TInput: bigint | number, deltaInput: bigint | number, NInput: `0x${string}` | bigint) {


    let x: bigint, T: bigint, delta: bigint, N: bigint;
    try {
        x = typeof xInput === 'bigint' ? xInput : bytesInputToBigInt(xInput);
        T = BigInt(TInput);
        delta = BigInt(deltaInput);
        N = typeof NInput === 'bigint' ? NInput : bytesInputToBigInt(NInput);
    } catch (e) {
        console.error(`[VDF Debug] generateProof: Error during input conversion`, e);
        throw e;
    }

    if (T <= 0) {
        console.error("[VDF Debug] generateProof: T must be positive.")
        throw new Error("T must be positive");
    }
    if (delta < 0) {
        console.error("[VDF Debug] generateProof: delta cannot be negative.")
        throw new Error("delta cannot be negative");
    }
    console.log(`[VDF Debug] generateProof: Converted inputs: x=${x}, T=${T}, delta=${delta}, N=${N}`);

    console.log(`[VDF Debug] generateProof: Evaluating VDF to get y...`);
    let y: bigint;
    try {
        y = await evaluateVDF(x, T, N);
        console.log(`[VDF Debug] generateProof: VDF evaluated, y = ${y}`);
    } catch (e) {
        console.error(`[VDF Debug] generateProof: Error during evaluateVDF call`, e);
        throw e;
    }

    const TNum = Number(T);
    if (!Number.isSafeInteger(TNum)) {
        console.warn("[VDF Debug] generateProof: T might be too large for safe integer conversion in proof loop.");
    }
    if (TNum <= 0) {
        console.error("[VDF Debug] generateProof: T resulted in non-positive number for log2.")
        throw new Error("T must be positive for log2 calculation");
    }
    const tau = Math.floor(Math.log2(TNum));
    console.log(`[VDF Debug] generateProof: Calculated tau (log2(T)) = ${tau}`);

    const deltaNum = Number(delta);
    if (deltaNum >= tau) {
        console.warn(`[VDF Debug] generateProof: Delta (${deltaNum}) >= Tau (${tau}). No proof iterations needed.`);
        return { y, proof: [] };
    }

    const proof: bigint[] = [];
    let xi = x;
    let yi = y;

    const loopEnd = tau - deltaNum;
    console.log(`[VDF Debug] generateProof: Starting proof loop from i=1 to ${loopEnd}.`);
    for (let i = 1; i <= loopEnd; i++) {
        console.log(`[VDF Debug] generateProof: --- Iteration ${i}/${loopEnd} ---`);
        const xiStr = xi.toString();
        const yiStr = yi.toString();
        console.log(`[VDF Debug] generateProof: Current xi = ${xiStr.length > 100 ? xiStr.substring(0, 50) + "..." + xiStr.substring(xiStr.length - 50) : xiStr}`);
        console.log(`[VDF Debug] generateProof: Current yi = ${yiStr.length > 100 ? yiStr.substring(0, 50) + "..." + yiStr.substring(yiStr.length - 50) : yiStr}`);

        // Calculate vi = xi^(2^(T/2^i)) mod N
        const powerOfTwo = BigInt(i);
        if (powerOfTwo < BigInt(0)) {
            console.error(`[VDF Debug] generateProof: Calculated powerOfTwo is negative: ${powerOfTwo}`);
            throw new Error("Invalid exponent calculation");
        }
        const twoPowI = BigInt(1) << powerOfTwo; // 2^i using bit shift
        if (twoPowI <= BigInt(0)) {
            console.error(`[VDF Debug] generateProof: Error - 2^${i} resulted in non-positive value: ${twoPowI}.`);
            throw new Error(`Exponent base 2 calculation failed at i=${i}`);
        }
        const iterations = T / twoPowI;
        console.log(`[VDF Debug] generateProof: Iter ${i}: Calculating vi by repeated squaring for ${iterations} iterations.`);

        let vi = xi;
        const iterNum = Number(iterations);
        if (!Number.isSafeInteger(iterNum)) {
            console.warn(`[VDF Debug] generateProof: Iter ${i}: Number of iterations ${iterations} may be too large for JS loop.`);
        }
        const logIntervalVi = iterNum > 0 ? Math.max(1, Math.floor(iterNum / 5)) : 1; // Log progress ~5 times

        for (let j = 0; j < iterNum; j++) {
            try {
                vi = modPow(vi, BigInt(2), N); // Efficient squaring: vi = (vi * vi) % N
            } catch (e) {
                console.error(`[VDF Debug] generateProof: Iter ${i}: Error during vi calculation inner loop (j=${j})`, e);
                throw e;
            }
            if ((j + 1) % logIntervalVi === 0 || j === iterNum - 1) {
                console.log(`[VDF Debug] generateProof: Iter ${i}: vi calculation progress ${j + 1}/${iterNum}`);
            }
        }

        const viStr = vi.toString();
        console.log(`[VDF Debug] generateProof: Iter ${i}: Calculated vi = ${viStr.length > 100 ? viStr.substring(0, 50) + "..." + viStr.substring(viStr.length - 50) : viStr}`);

        // Calculate ri = H(xi, yi, vi)
        console.log(`[VDF Debug] generateProof: Iter ${i}: Calculating ri = H(xi, yi, vi)`);
        let ri: bigint;
        try {
            console.log(`[VDF Debug] generateProof: Iter ${i}: Hashing inputs: xi=${xi}, yi=${yi}, vi=${vi}`);
            let pad = false
            if ((xi.toString(16).length != PADDED_1024_BIT_HEX_LENGTH || yi.toString(16).length != PADDED_1024_BIT_HEX_LENGTH) && i != 1) {
                pad = true;
            }
            ri = hashBigIntsEthersStyle(pad, xi, yi, vi);
            console.log(`[VDF Debug] generateProof: Iter ${i}: Calculated ri = ${ri}`);
        } catch (e) {
            console.error(`[VDF Debug] generateProof: Iter ${i}: Error calculating ri with hashBigIntsEthersStyle`, e);
            throw e;
        }

        // Calculate xi+1 = xi^ri * vi mod N
        console.log(`[VDF Debug] generateProof: Iter ${i}: Calculating xi+1 = (xi^ri * vi) mod N`);
        let xiPlus1: bigint;
        try {
            xiPlus1 = (modPow(xi, ri, N) * vi) % N;
            const xiPlus1Str = xiPlus1.toString();
            console.log(`[VDF Debug] generateProof: Iter ${i}: Calculated xi+1 = ${xiPlus1Str.length > 100 ? xiPlus1Str.substring(0, 50) + "..." + xiPlus1Str.substring(xiPlus1Str.length - 50) : xiPlus1Str}`);
        } catch (e) {
            console.error(`[VDF Debug] generateProof: Iter ${i}: Error calculating xi+1`, e);
            throw e;
        }

        // Calculate yi+1 = vi^ri * yi mod N
        console.log(`[VDF Debug] generateProof: Iter ${i}: Calculating yi+1 = (vi^ri * yi) mod N`);
        let yiPlus1: bigint;
        try {
            yiPlus1 = (modPow(vi, ri, N) * yi) % N;
            const yiPlus1Str = yiPlus1.toString();
            console.log(`[VDF Debug] generateProof: Iter ${i}: Calculated yi+1 = ${yiPlus1Str.length > 100 ? yiPlus1Str.substring(0, 50) + "..." + yiPlus1Str.substring(yiPlus1Str.length - 50) : yiPlus1Str}`);
        } catch (e) {
            console.error(`[VDF Debug] generateProof: Iter ${i}: Error calculating yi+1`, e);
            throw e;
        }

        const viLogStr = vi.toString();
        console.log(`[VDF Debug] generateProof: Iter ${i}: Pushing vi (${viLogStr.length > 100 ? viLogStr.substring(0, 50) + "..." + viLogStr.substring(viLogStr.length - 50) : viLogStr}) to proof.`);
        proof.push(vi);
        xi = xiPlus1;
        yi = yiPlus1;
        console.log(`[VDF Debug] generateProof: --- End Iteration ${i} ---`);
    }

    console.log(`[VDF Debug] generateProof: Finished proof loop. Final proof array (length ${proof.length}): [${proof.map(p => p.toString().substring(0, 10) + '...').join(', ')}]`);
    return { y, proof };
} 