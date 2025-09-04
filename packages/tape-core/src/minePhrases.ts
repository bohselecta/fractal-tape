/**
 * Benefit-scored phrase mining
 * Mines n-grams and ranks by actual byte savings, not just frequency
 */

export type Phrase = string[];
export type Cand = { 
  phrase: Phrase; 
  count: number; 
  chars: number; 
  gain: number; 
};

/**
 * Mine phrases with benefit scoring
 * @param words - Tokenized words
 * @param nMin - Minimum n-gram size (default: 2)
 * @param nMax - Maximum n-gram size (default: 5)
 * @returns Candidates sorted by gain (desc), then length (desc), then lexicographic
 */
export function mine(words: string[], nMin: number = 2, nMax: number = 5): Cand[] {
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
  const candidates: Cand[] = [];
  
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
