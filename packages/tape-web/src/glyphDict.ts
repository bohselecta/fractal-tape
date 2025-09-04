export type GlyphEntry = { layer: number; phrase: string[]; glyph: string; gain?: number };

// Re-export core training functions for web use (browser-compatible)
export { train, words, build, encode, decode } from './browser-core.js';

// Safe ASCII alphabet (no quotes, backslash, <, >, &)
const ALPHA =
  "!#$%()*+,-./:;=?@[]^_{|}~" + // punctuation (safe in HTML/JSON)
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789";

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}

function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build ASCII pool: "~A", "~b", "~7", then "~AA", "~Ab", ... (levels=1..2 by default)
export function asciiGlyphPool(prefix = "~", levels = 2, alphabet = ALPHA): string[] {
  const pool: string[] = [];
  for (let L = 1; L <= levels; L++) {
    const recur = (s: string, d: number) => {
      if (d === 0) { pool.push(prefix + s); return; }
      for (let i = 0; i < alphabet.length; i++) recur(s + alphabet[i], d - 1);
    };
    recur("", L);
  }
  return pool;
}

// Deterministically shuffle with tape seed
function shuffle<T>(arr: T[], seedStr: string): T[] {
  const rand = mulberry32(fnv1a32(seedStr));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);
}

// Mine bi/tri-grams (you can extend to 4-grams if desired)
export function minePhrases(words: string[], top = 96) {
  const freq = new Map<string, number>();
  for (let i = 0; i < words.length; i++) {
    if (i + 1 < words.length) {
      const k2 = `${words[i]}\u0001${words[i + 1]}`;
      freq.set(k2, (freq.get(k2) || 0) + 1);
    }
    if (i + 2 < words.length) {
      const k3 = `${words[i]}\u0001${words[i + 1]}\u0001${words[i + 2]}`;
      freq.set(k3, (freq.get(k3) || 0) + 1);
    }
  }
  // Sort by freq desc, then longer n-grams first, then lexicographic
  const items = [...freq.entries()].sort((a, b) => {
    const la = a[0].split("\u0001").length, lb = b[0].split("\u0001").length;
    if (b[1] !== a[1]) return b[1] - a[1];
    if (lb !== la) return lb - la;
    return a[0].localeCompare(b[0]);
  }).slice(0, top);
  return items.map(([k]) => k.split("\u0001"));
}

// Main: build per-tape ASCII glyph set
export function buildAsciiGlyphsForTape(
  text: string,
  opts?: { top?: number; prefix?: string; levels?: number; seed?: string; layer?: number }
): GlyphEntry[] {
  const { top = 96, prefix = "~", levels = 2, seed, layer = 1 } = opts || {};
  const words = normalizeWords(text);
  const phrases = minePhrases(words, top);
  const pool = shuffle(asciiGlyphPool(prefix, levels), seed ?? ("tape:" + fnv1a32(text)));
  return phrases.map((phrase, i) => ({ layer, phrase, glyph: pool[i] }));
}

// Legacy Unicode system (kept for compatibility)
export const PRESET_GLYPHS: GlyphEntry[] = [];

const POOL = ('⟡◇◆✦✧✪✫✬✭✮✯✰✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❂❉❋❖❥❧➤➣➢➠➟➛➜➲➳➺➻➼➽➾✚✜✢✣✤✥☆★☼☄☯✈✇⌁⌘').split('');

export function trainGlyphsFromText(text: string, top = 96, layer = 1){
  const words = text.toLowerCase().replace(/[^a-z0-9\s']/g,' ').split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (let i=0;i<words.length;i++){
    if (i+1<words.length) freq.set(`${words[i]}\u0001${words[i+1]}`, (freq.get(`${words[i]}\u0001${words[i+1]}`)||0)+1);
    if (i+2<words.length) freq.set(`${words[i]}\u0001${words[i+1]}\u0001${words[i+2]}`, (freq.get(`${words[i]}\u0001${words[i+1]}\u0001${words[i+2]}`)||0)+1);
  }
  const items = [...freq.entries()].sort((a,b)=>{
    const la=a[0].split('\u0001').length, lb=b[0].split('\u0001').length;
    if (b[1]!==a[1]) return b[1]-a[1];
    if (lb!==la) return lb-la;
    return a[0].localeCompare(b[0]);
  }).slice(0, top);

  const trained = items.slice(0, POOL.length).map((e,i)=>({ layer, phrase: e[0].split('\u0001'), glyph: POOL[i] }));
  setGlyphs([...trained, ...PRESET_GLYPHS]);
}

// Layered mining functions
export function mineFromEncodedStream(encodedTokens: string[], layer: number, top = 96): GlyphEntry[] {
  // Treat encoded tokens as "words" for mining
  const phrases = minePhrases(encodedTokens, top);
  const pool = shuffle(asciiGlyphPool("~", 2), `layer-${layer}-${Date.now()}`);
  return phrases.map((phrase, i) => ({ layer, phrase, glyph: pool[i] }));
}

export function getGlyphsUpToLayer(maxLayer: number): GlyphEntry[] {
  return CURRENT.filter(g => g.layer <= maxLayer);
}

export function trainLayeredGlyphs(text: string, layerDepth: number, opts?: { top?: number; prefix?: string; levels?: number; seed?: string }): void {
  const { top = 96, prefix = "~", levels = 2, seed } = opts || {};
  
  // Clear existing glyphs except presets
  setGlyphs([...PRESET_GLYPHS]);
  
  let currentText = text;
  
  for (let layer = 1; layer <= layerDepth; layer++) {
    if (layer === 1) {
      // Layer 1: mine directly from input text
      const words = normalizeWords(currentText);
      const phrases = minePhrases(words, top);
      const pool = shuffle(asciiGlyphPool(prefix, levels), seed ?? ("tape:" + fnv1a32(text)));
      const newGlyphs = phrases.map((phrase, i) => ({ layer, phrase, glyph: pool[i] }));
      setGlyphs([...getGlyphs(), ...newGlyphs]);
    } else {
      // Layer 2+: mine from encoded stream
      const allGlyphs = getGlyphsUpToLayer(layer - 1);
      const trie = build(allGlyphs);
      const words = normalizeWords(currentText);
      const encodedTokens = encode(words, trie);
      
      const newGlyphs = mineFromEncodedStream(encodedTokens, layer, top);
      setGlyphs([...getGlyphs(), ...newGlyphs]);
      
      // Update currentText to the encoded stream for next iteration
      currentText = encodedTokens.join(' ');
    }
  }
}

// State management
let CURRENT: GlyphEntry[] = [...PRESET_GLYPHS];
let useAsciiOnly = true; // Default to ASCII mode
let currentLayerDepth = 1; // Track current layer depth

export function getGlyphs(){ return CURRENT; }
export function setGlyphs(list: GlyphEntry[]){ CURRENT = list; }
export function exportGlyphs(): string { return JSON.stringify(CURRENT, null, 2); }

export function getAsciiOnly(){ return useAsciiOnly; }
export function setAsciiOnly(ascii: boolean){ useAsciiOnly = ascii; }

export function getLayerDepth(){ return currentLayerDepth; }
export function setLayerDepth(depth: number){ currentLayerDepth = depth; }
