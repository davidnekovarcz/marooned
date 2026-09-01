/** Mulberry32 from a string seed. */
export function mulberry32(seed: string): () => number {
  let a = 0;
  for (let i = 0; i < seed.length; i++) {
    a = Math.imul(a ^ seed.charCodeAt(i), 2654435761);
  }
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
