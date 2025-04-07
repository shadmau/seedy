import { modPow } from 'bigint-crypto-utils';
import { hashBigIntsEthersStyle } from './utils/bigint.js';
import { evaluateVDF } from './evaluate.js';
import { PADDED_1024_BIT_HEX_LENGTH } from './constants.js';
export async function generateProof(x: bigint, T: number, delta: number, N: bigint) {
  const y = await evaluateVDF(x, T, N);

  const tau = Math.floor(Math.log2(T));
  const proof: bigint[] = [];

  let xi = x, yi = y;

  for (let i = 1; i <= tau - delta; i++) {
    let vi = xi;
    for (let j = 0; j < T / 2 ** i; j++) {
      vi = (vi * vi) % N;
    }

    let pad = false
    if ((xi.toString(16).length != PADDED_1024_BIT_HEX_LENGTH || yi.toString(16).length != PADDED_1024_BIT_HEX_LENGTH) && i != 1) {
      pad = true;
    }

    const ri = hashBigIntsEthersStyle(pad, xi, yi, vi);

    const xiPlus1 = (modPow(xi, ri, N) * vi) % N;
    const yiPlus1 = (modPow(vi, ri, N) * yi) % N;


    proof.push(vi);
    xi = xiPlus1;
    yi = yiPlus1;
  }

  return { y, proof };
}