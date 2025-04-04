import pkg from 'js-sha3';
const { keccak256 } = pkg;

export function hashBigInts(...args: bigint[]): bigint {
  const hex = args.map(n => n.toString(16).padStart(512, "0")).join("");
  const hash = keccak256(Buffer.from(hex, "hex"));
  return BigInt("0x" + hash);
}