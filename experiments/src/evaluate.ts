export async function evaluateVDF(x: bigint, T: number, N: bigint): Promise<bigint> {
    let y = x;
    for (let i = 0; i < T; i++) y = (y * y) % N;
    return y;
  }