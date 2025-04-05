import { hashBigIntsEthersStyle } from "./utils/bigint.js";
import { modPow } from 'bigint-crypto-utils';

export async function verifyProof(x: bigint, y: bigint, T: number, delta: number, proof: bigint[], N: bigint): Promise<boolean> {
  const tau = Math.floor(Math.log2(T));
  if (proof.length !== tau - delta) return false;
  let xi = x, yi = y;
  for (let i = 1; i <= tau - delta; i++) {
    const vi = proof[i - 1];
    const ri = hashBigIntsEthersStyle(xi, yi, vi);

    xi = (modPow(xi, ri, N) * vi) % N;
    console.log("xi_new:", xi.toString(16));

    yi = (modPow(vi, ri, N) * yi) % N;
    console.log("yi_new:", yi.toString(16));
  }

  let expected = xi;
  for (let i = 0; i < 2 ** delta; i++) {
    expected = (expected * expected) % N;
  }

  return expected === yi;
}