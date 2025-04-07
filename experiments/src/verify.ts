import { PADDED_1024_BIT_HEX_LENGTH } from "./constants.js";
import { hashBigIntsEthersStyle } from "./utils/bigint.js";
import { modPow } from 'bigint-crypto-utils';

export async function verifyProof(x: bigint, y: bigint, T: number, delta: number, proof: bigint[], N: bigint): Promise<boolean> {
  const tau = Math.floor(Math.log2(T));
  if (proof.length !== tau - delta) return false;
  let xi = x, yi = y;
  for (let i = 1; i <= tau - delta; i++) {
    const vi = proof[i - 1];
    let pad = false
    if ((xi.toString(16).length != PADDED_1024_BIT_HEX_LENGTH || yi.toString(16).length != PADDED_1024_BIT_HEX_LENGTH) && i != 1) {
      pad = true;
    }
    const ri = hashBigIntsEthersStyle(pad, xi, yi, vi);

    console.log("--- VDF Step ---");
    console.log("  xi (input):");
    console.log("  0x" + xi.toString(16));
    console.log("  yi (input):");
    console.log("  0x" + yi.toString(16));
    console.log("  vi (proof element):");
    console.log("  0x" + vi.toString(16));
    console.log("  N (modulus):");
    console.log("  0x" + N.toString(16));
    console.log("  ri (hash(xi, yi, vi)):");
    console.log("  0x" + ri.toString(16));
    
    const xiPowRi = modPow(xi, ri, N);
    const viPowRi = modPow(vi, ri, N);
    
    console.log("  xi_pow_ri (xi^ri mod N):");
    console.log("  0x" + xiPowRi.toString(16));
    console.log("  vi_pow_ri (vi^ri mod N):");
    console.log("  0x" + viPowRi.toString(16));
    
    const xiIntermediate = xiPowRi * vi;
    const yiIntermediate = viPowRi * yi;
    
    console.log("  Intermediate mul result for new_xi (xi_pow_ri * vi):");
    console.log("  0x" + xiIntermediate.toString(16));
    
    xi = xiIntermediate % N;
    console.log("  Final new_xi:");
    console.log("  0x" + xi.toString(16));
    
    console.log("  Intermediate mul result for new_yi (vi_pow_ri * yi):");
    console.log("  0x" + yiIntermediate.toString(16));
    
    yi = yiIntermediate % N;
    console.log("  Final new_yi:");
    console.log("  0x" + yi.toString(16));
    console.log("--- End VDF Step ---");
  }

  let expected = xi;
  for (let i = 0; i < 2 ** delta; i++) {
    expected = (expected * expected) % N;
  }

  return expected === yi;
}