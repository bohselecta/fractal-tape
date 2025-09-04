/**
 * Aggressive glyph training with benefit scoring
 */

import { words } from './tokenize.js';
import { mine } from './minePhrases.js';
import { poolForTape } from './glyphPool.js';

export type GlyphEntry = { 
  phrase: string[]; 
  glyph: string; 
  gain?: number; 
};

export interface TrainOptions {
  top?: number;        // Maximum number of glyphs to generate
  nMin?: number;       // Minimum n-gram size
  nMax?: number;       // Maximum n-gram size
  prefix?: string;     // Glyph prefix character
  levels?: number;     // ASCII pool levels (1-3)
  seed?: string;       // Deterministic seed
}

/**
 * Train aggressive glyph dictionary with benefit scoring
 * @param text - Input text to train on
 * @param options - Training options
 * @returns Array of glyph entries sorted by benefit
 */
export function train(
  text: string,
  options: TrainOptions = {}
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
