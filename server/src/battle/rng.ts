/**
 * RNG serializável (mulberry32). O estado é um inteiro que vive DENTRO do
 * `BattleState`, então a batalha salva em jsonb continua de onde parou — e uma
 * seed fixa reproduz a batalha inteira nos testes.
 */
export interface Rng {
  state: number;
}

/** Float em [0, 1). Avança o estado. */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) | 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** true com probabilidade `percent`/100. */
export function chance(rng: Rng, percent: number): boolean {
  return next(rng) * 100 < percent;
}

/** Inteiro em [min, max]. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(next(rng) * (max - min + 1));
}

export function shuffle<T>(rng: Rng, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next(rng) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
