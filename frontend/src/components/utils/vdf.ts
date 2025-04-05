
console.log("--- Mock VDF Utils Loaded ---");

// Mock bytesInputToBigInt
export function bytesInputToBigInt(input: `0x${string}` | Uint8Array | string): bigint {
    console.log("[Mock VDF] bytesInputToBigInt called with:", input);
    // Return a placeholder bigint. For N_param, it doesn't matter much for mocking proof gen.
    return BigInt(123456789);
}

// Mock evaluateVDF
export async function evaluateVDF(x: bigint, T: bigint, N: bigint): Promise<bigint> {
    console.log(`[Mock VDF] evaluateVDF called with: x=${x}, T=${T}, N=${N}`);
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 50));
    // Return a placeholder bigint for y
    const mockY = BigInt("0x" + "1".repeat(64)); // Mock 32 bytes hex as bigint
    console.log("[Mock VDF] evaluateVDF returning mock y:", mockY);
    return mockY;
}

// Mock generateProof
export async function generateProof(xInput: `0x${string}` | bigint, TInput: bigint | number, deltaInput: bigint | number, NInput: `0x${string}` | bigint) {
    console.log(`[Mock VDF] generateProof called with: xInput=${xInput}, TInput=${TInput}, deltaInput=${deltaInput}, NInput=${NInput}`);

    // Simulate some delay for proof generation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use the mock evaluateVDF result or create another mock y
    const mockY = BigInt("0x" + "a".repeat(64));
    // Create a mock proof array
    const mockProof: bigint[] = [BigInt(111), BigInt(222), BigInt(333)];

    console.log("[Mock VDF] generateProof returning mock y and proof:", { y: mockY, proof: mockProof });
    return { y: mockY, proof: mockProof };
}



