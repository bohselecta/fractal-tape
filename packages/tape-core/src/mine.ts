/**
 * Enhanced n-gram mining with byte-accurate sizes for FGT
 */

export interface Candidate {
  phrase: string[];
  frequency: number;
  byteSize: number;
  gain: number;
  depth: number;
}

/**
 * Calculate exact byte size of text (UTF-8)
 * @param text - Text to measure
 * @returns Byte size
 */
export function byteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Calculate byte size of phrase with spaces
 * @param phrase - Array of tokens
 * @returns Byte size including spaces
 */
export function phraseByteSize(phrase: string[]): number {
  return byteSize(phrase.join(' '));
}

/**
 * Mine n-grams with byte-accurate sizing
 * @param tokens - Input token stream
 * @param nMin - Minimum n-gram size
 * @param nMax - Maximum n-gram size
 * @returns Array of candidates sorted by gain
 */
export function mineNgrams(
  tokens: string[],
  nMin: number = 2,
  nMax: number = 5
): Candidate[] {
  const freq = new Map<string, number>();
  
  // Count all n-grams from nMin to nMax
  for (let n = nMin; n <= nMax; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n);
      const key = phrase.join('\u0001');
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  
  // Convert to candidates with byte-accurate sizing
  const candidates: Candidate[] = [];
  
  for (const [key, frequency] of freq) {
    const phrase = key.split('\u0001');
    const byteSize = phraseByteSize(phrase);
    
    // Estimate compressed size (symbol length)
    const compressedSize = Math.ceil(Math.log2(phrase.length)) + 1; // Rough estimate
    
    // Calculate gain: (bytes saved per occurrence) * frequency
    const gain = (byteSize - compressedSize) * frequency;
    
    // Only keep phrases with positive gain
    if (gain > 0) {
      candidates.push({
        phrase,
        frequency,
        byteSize,
        gain,
        depth: phrase.length
      });
    }
  }
  
  // Sort by: 1) gain (desc), 2) depth (desc), 3) frequency (desc)
  return candidates.sort((a, b) => {
    if (b.gain !== a.gain) return b.gain - a.gain;
    if (b.depth !== a.depth) return b.depth - a.depth;
    return b.frequency - a.frequency;
  });
}

/**
 * Mine high-order n-grams (5-grams down to 2-grams)
 * @param tokens - Input token stream
 * @param topK - Number of top candidates to return
 * @returns Top K candidates
 */
export function mineHighOrder(
  tokens: string[],
  topK: number = 100
): Candidate[] {
  const candidates = mineNgrams(tokens, 2, 5);
  return candidates.slice(0, topK);
}

/**
 * Find most frequent adjacent pairs
 * @param tokens - Input token stream
 * @returns Array of pairs sorted by frequency
 */
export function findFrequentPairs(tokens: string[]): Array<{ pair: [string, string]; frequency: number }> {
  const freq = new Map<string, number>();
  
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = [tokens[i], tokens[i + 1]] as [string, string];
    const key = pair.join('\u0001');
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  
  const pairs: Array<{ pair: [string, string]; frequency: number }> = [];
  for (const [key, frequency] of freq) {
    const pair = key.split('\u0001') as [string, string];
    pairs.push({ pair, frequency });
  }
  
  return pairs.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Calculate compression potential of a candidate
 * @param candidate - Candidate phrase
 * @param symbolSize - Size of the symbol that would replace it
 * @returns Compression ratio (0-1, lower = better)
 */
export function compressionPotential(candidate: Candidate, symbolSize: number): number {
  const originalSize = candidate.byteSize * candidate.frequency;
  const compressedSize = symbolSize * candidate.frequency;
  return compressedSize / originalSize;
}

/**
 * Filter candidates by minimum frequency
 * @param candidates - Array of candidates
 * @param minFreq - Minimum frequency threshold
 * @returns Filtered candidates
 */
export function filterByFrequency(candidates: Candidate[], minFreq: number): Candidate[] {
  return candidates.filter(c => c.frequency >= minFreq);
}

/**
 * Filter candidates by minimum gain
 * @param candidates - Array of candidates
 * @param minGain - Minimum gain threshold
 * @returns Filtered candidates
 */
export function filterByGain(candidates: Candidate[], minGain: number): Candidate[] {
  return candidates.filter(c => c.gain >= minGain);
}

/**
 * Get candidates by depth
 * @param candidates - Array of candidates
 * @param depth - Target depth
 * @returns Candidates at specified depth
 */
export function getByDepth(candidates: Candidate[], depth: number): Candidate[] {
  return candidates.filter(c => c.depth === depth);
}

/**
 * Calculate total potential savings
 * @param candidates - Array of candidates
 * @returns Total potential bytes saved
 */
export function totalPotentialSavings(candidates: Candidate[]): number {
  return candidates.reduce((sum, c) => sum + c.gain, 0);
}

/**
 * Get depth distribution of candidates
 * @param candidates - Array of candidates
 * @returns Map of depth -> count
 */
export function getDepthDistribution(candidates: Candidate[]): Map<number, number> {
  const dist = new Map<number, number>();
  
  for (const candidate of candidates) {
    const depth = candidate.depth;
    dist.set(depth, (dist.get(depth) || 0) + 1);
  }
  
  return dist;
}

/**
 * Analyze mining results
 * @param candidates - Array of candidates
 * @returns Analysis summary
 */
export function analyzeMining(candidates: Candidate[]) {
  const totalCandidates = candidates.length;
  const totalSavings = totalPotentialSavings(candidates);
  const avgGain = totalSavings / totalCandidates;
  const maxGain = Math.max(...candidates.map(c => c.gain));
  const depthDist = getDepthDistribution(candidates);
  
  return {
    totalCandidates,
    totalSavings,
    avgGain,
    maxGain,
    depthDistribution: depthDist,
    topCandidate: candidates[0] || null
  };
}
