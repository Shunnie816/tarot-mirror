/**
 * Seeded PRNG.
 *
 * Every draw is reproducible from its seed. That buys three things:
 *   - a reading can be regenerated if LLM formatting fails
 *   - engine tests are deterministic without mocking randomness
 *   - a stored reading can be replayed from `seed` alone
 *
 * `Math.random()` would cost all three. Not cryptographic — it doesn't need
 * to be; drawing a tarot card is not a security boundary.
 */

/** xmur3 string hash — turns an arbitrary seed string into 32 bits of state. */
function xmur3(input: string): () => number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 — small, fast, good enough distribution for a card shuffle. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Build a deterministic `[0, 1)` generator from a seed string. */
export function createRng(seed: string): Rng {
  return mulberry32(xmur3(seed)());
}

/** Fisher–Yates. Returns a new array; the input is not mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * A seed derived from the current time plus entropy.
 * Callers should persist the returned value alongside the reading.
 */
export function generateSeed(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}
