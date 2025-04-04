import {  hashBigInts } from "./utils/bigint.js";
import { modPow } from 'bigint-crypto-utils';

export async function verifyProof(x: bigint, y: bigint, T: number, delta: number, proof: bigint[], N: bigint): Promise<boolean> {
  const tau = Math.floor(Math.log2(T));
  if (proof.length !== tau - delta) return false;

  let xi = x, yi = y;
  for (let i = 1; i <= tau - delta; i++) {
    const vi = proof[i - 1];
    const ri = hashBigInts(xi, yi, vi);
    xi = (modPow(xi, ri, N) * vi) % N;
    yi = (modPow(vi, ri, N) * yi) % N;
  }

  let expected = xi;
  for (let i = 0; i < 2 ** delta; i++) {
    expected = (expected * expected) % N;
  }

  return expected === yi;
}