/**
 * Deterministic ASCII glyph pool generation
 */

// Safe ASCII alphabet (no quotes, backslash, <, >, &)
const ALPHA = 
  "!#$%()*+,-./:;=?@[]^_{|}~" + // punctuation (safe in HTML/JSON)
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789";

/**
 * Generate ASCII glyph pool
 * @param prefix - Prefix character (default: "~")
 * @param levels - Number of levels (1-3, default: 2)
 * @returns Array of glyph strings
 */
export function asciiPool(prefix: string = "~", levels: number = 2): string[] {
  const pool: string[] = [];
  
  for (let L = 1; L <= levels; L++) {
    const recur = (s: string, d: number) => {
      if (d === 0) {
        pool.push(prefix + s);
        return;
      }
      for (let i = 0; i < ALPHA.length; i++) {
        recur(s + ALPHA[i], d - 1);
      }
    };
    recur("", L);
  }
  
  return pool;
}

/**
 * FNV1a32 hash function
 */
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}

/**
 * Mulberry32 PRNG
 */
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically shuffle array with tape seed
 */
function shuffle<T>(arr: T[], seedStr: string): T[] {
  const rand = mulberry32(fnv1a32(seedStr));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate tape-specific glyph pool with deterministic shuffling
 * @param seed - Tape identifier for deterministic mapping
 * @param prefix - Prefix character (default: "~")
 * @param levels - Number of levels (1-3, default: 2)
 * @returns Deterministically shuffled glyph pool
 */
export function poolForTape(seed: string, prefix: string = "~", levels: number = 2): string[] {
  const pool = asciiPool(prefix, levels);
  return shuffle(pool, seed);
}
