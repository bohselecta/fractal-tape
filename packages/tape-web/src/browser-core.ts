/**
 * Browser-compatible core training functions
 * (copied from tape-core to avoid Node.js dependencies)
 */

export type GlyphEntry = { 
  phrase: string[]; 
  glyph: string; 
  gain?: number; 
};

// Safe ASCII alphabet (no quotes, backslash, <, >, &)
const ALPHA = 
  "!#$%()*+,-./:;=?@[]^_{|}~" + // punctuation (safe in HTML/JSON)
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789";

/**
 * Normalize and split text into words
 */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Mine phrases with benefit scoring
 */
export function mine(words: string[], nMin: number = 2, nMax: number = 5) {
  const freq = new Map<string, number>();
  
  // Count all n-grams from nMin to nMax
  for (let n = nMin; n <= nMax; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n);
      const key = phrase.join('\u0001');
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  
  // Convert to candidates with benefit scoring
  const candidates: Array<{ phrase: string[]; count: number; chars: number; gain: number }> = [];
  
  for (const [key, count] of freq) {
    const phrase = key.split('\u0001');
    const chars = phrase.join(' ').length; // Include spaces in character count
    
    // Estimate glyph length: 2 chars for first 82, 3 chars for next 6.7k
    let glyphLength: number;
    if (candidates.length < 82) {
      glyphLength = 2; // ~A to ~z
    } else if (candidates.length < 82 + 82 * 82) {
      glyphLength = 3; // ~AA to ~zz
    } else {
      glyphLength = 4; // ~AAA and beyond
    }
    
    // Calculate gain: (chars saved per occurrence) * frequency
    const gain = (chars - glyphLength) * count;
    
    // Only keep phrases with positive gain
    if (gain > 0) {
      candidates.push({
        phrase,
        count,
        chars,
        gain
      });
    }
  }
  
  // Sort by: 1) gain (desc), 2) length (desc), 3) lexicographic
  return candidates.sort((a, b) => {
    if (b.gain !== a.gain) return b.gain - a.gain;
    if (b.phrase.length !== a.phrase.length) return b.phrase.length - a.phrase.length;
    return a.phrase.join(' ').localeCompare(b.phrase.join(' '));
  });
}

/**
 * Generate ASCII glyph pool
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
 */
export function poolForTape(seed: string, prefix: string = "~", levels: number = 2): string[] {
  const pool = asciiPool(prefix, levels);
  return shuffle(pool, seed);
}

/**
 * Train aggressive glyph dictionary with benefit scoring
 */
export function train(
  text: string,
  options: {
    top?: number;
    nMin?: number;
    nMax?: number;
    prefix?: string;
    levels?: number;
    seed?: string;
  } = {}
): GlyphEntry[] {
  const {
    top = 512,
    nMin = 2,
    nMax = 5,
    prefix = "~",
    levels = 2,
    seed
  } = options;
  
  // Tokenize text
  const wordList = words(text);
  
  // Mine phrases with benefit scoring
  const candidates = mine(wordList, nMin, nMax);
  
  // Generate deterministic glyph pool
  const tapeSeed = seed || `tape:${text.length}:${wordList.length}`;
  const pool = poolForTape(tapeSeed, prefix, levels);
  
  // Assign glyphs to top candidates
  const entries: GlyphEntry[] = [];
  const maxGlyphs = Math.min(top, candidates.length, pool.length);
  
  for (let i = 0; i < maxGlyphs; i++) {
    entries.push({
      phrase: candidates[i].phrase,
      glyph: pool[i],
      gain: candidates[i].gain
    });
  }
  
  return entries;
}

/**
 * Trie-based longest-match encoding/decoding
 */
export type Trie = { 
  kids: Map<string, Trie>; 
  glyph?: string; 
};

/**
 * Build trie from glyph entries
 */
export function build(entries: GlyphEntry[]): Trie {
  const root: Trie = { kids: new Map() };
  
  for (const entry of entries) {
    let node = root;
    for (const word of entry.phrase) {
      if (!node.kids.has(word)) {
        node.kids.set(word, { kids: new Map() });
      }
      node = node.kids.get(word)!;
    }
    node.glyph = entry.glyph;
  }
  
  return root;
}

/**
 * Encode words using longest-match trie
 */
export function encode(words: string[], trie: Trie): string[] {
  const tokens: string[] = [];
  let i = 0;
  
  while (i < words.length) {
    let node = trie;
    let j = i;
    let lastMatch: { len: number; glyph: string } | null = null;
    
    // Find longest match starting at position i
    while (j < words.length) {
      const kid = node.kids.get(words[j]);
      if (!kid) break;
      
      node = kid;
      if (node.glyph) {
        lastMatch = { len: j - i + 1, glyph: node.glyph };
      }
      j++;
    }
    
    // Use longest match if found, otherwise use single word
    if (lastMatch) {
      tokens.push(lastMatch.glyph);
      i += lastMatch.len;
    } else {
      tokens.push(words[i]);
      i++;
    }
  }
  
  return tokens;
}

/**
 * Decode tokens back to words
 */
export function decode(tokens: string[], entries: GlyphEntry[]): string[] {
  // Build reverse mapping from glyph to phrase
  const glyphToPhrase = new Map<string, string[]>();
  for (const entry of entries) {
    glyphToPhrase.set(entry.glyph, entry.phrase);
  }
  
  const words: string[] = [];
  
  for (const token of tokens) {
    const phrase = glyphToPhrase.get(token);
    if (phrase) {
      words.push(...phrase);
    } else {
      words.push(token); // Unknown token, treat as word
    }
  }
  
  return words;
}
