/**
 * Trie-based longest-match encoding/decoding
 */

import type { GlyphEntry } from './trainer.js';

export type Trie = { 
  kids: Map<string, Trie>; 
  glyph?: string; 
};

/**
 * Build trie from glyph entries
 * @param entries - Array of glyph entries
 * @returns Trie structure for encoding
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
 * @param words - Input words
 * @param trie - Trie structure
 * @returns Array of encoded tokens
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
 * @param tokens - Encoded tokens
 * @param entries - Original glyph entries
 * @returns Decoded words
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

// Re-export types for convenience
export type { GlyphEntry } from './trainer.js';
