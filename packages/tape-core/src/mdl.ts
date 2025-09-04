/**
 * Minimum Description Length (MDL) optimization for Fractal Grammar Tape
 */

export interface Rule {
  symbol: string;        // Address path (e.g., "021")
  children: string[];    // Child symbol addresses
  expansion: string[];   // Original phrase tokens
  gain: number;          // MDL gain score
  frequency: number;     // How often this rule is used
}

export interface Grammar {
  rules: Map<string, Rule>;  // symbol -> rule
  symbols: Set<string>;      // All defined symbols
  depth: number;             // Maximum depth reached
}

/**
 * Calculate byte cost of a rule definition
 * @param rule - The rule to cost
 * @param lambda - Rule cost penalty factor
 * @returns Cost in bytes
 */
export function ruleCost(rule: Rule, lambda: number = 1.0): number {
  // Cost = DEF + symbol + children + expansion
  const defCost = 3; // "DEF"
  const symbolCost = rule.symbol.length;
  const childrenCost = rule.children.length * 2; // Each child address
  const expansionCost = rule.expansion.join(' ').length; // Original phrase
  
  return (defCost + symbolCost + childrenCost + expansionCost) * lambda;
}

/**
 * Calculate byte savings from using a rule
 * @param rule - The rule
 * @param frequency - How many times it's used
 * @returns Bytes saved
 */
export function ruleSavings(rule: Rule, frequency: number): number {
  const originalBytes = rule.expansion.join(' ').length;
  const compressedBytes = rule.symbol.length;
  return (originalBytes - compressedBytes) * frequency;
}

/**
 * Calculate MDL gain for a candidate rule
 * @param rule - The candidate rule
 * @param frequency - How many times it would be used
 * @param lambda - Rule cost penalty factor
 * @returns MDL gain (positive = beneficial)
 */
export function mdlGain(rule: Rule, frequency: number, lambda: number = 1.0): number {
  const savings = ruleSavings(rule, frequency);
  const cost = ruleCost(rule, lambda);
  return savings - cost;
}

/**
 * Check if adding a rule improves MDL
 * @param grammar - Current grammar
 * @param rule - Candidate rule
 * @param frequency - How many times it would be used
 * @param lambda - Rule cost penalty factor
 * @returns True if MDL improves
 */
export function mdlImproves(
  grammar: Grammar, 
  rule: Rule, 
  frequency: number, 
  lambda: number = 1.0
): boolean {
  return mdlGain(rule, frequency, lambda) > 0;
}

/**
 * Calculate total MDL cost of grammar + stream
 * @param grammar - The grammar
 * @param stream - Token stream
 * @param lambda - Rule cost penalty factor
 * @returns Total cost in bytes
 */
export function totalMdlCost(grammar: Grammar, stream: string[], lambda: number = 1.0): number {
  let cost = 0;
  
  // Cost of all rules
  for (const rule of grammar.rules.values()) {
    cost += ruleCost(rule, lambda);
  }
  
  // Cost of stream (REF + symbol for each token)
  cost += stream.length * 4; // "REF " + symbol
  
  return cost;
}

/**
 * Calculate compression ratio
 * @param original - Original text
 * @param grammar - Compressed grammar
 * @param stream - Compressed stream
 * @param lambda - Rule cost penalty factor
 * @returns Compression ratio (0-1, lower = better)
 */
export function compressionRatio(
  original: string,
  grammar: Grammar,
  stream: string[],
  lambda: number = 1.0
): number {
  const originalBytes = new TextEncoder().encode(original).length;
  const compressedBytes = totalMdlCost(grammar, stream, lambda);
  return compressedBytes / originalBytes;
}

/**
 * Find the most beneficial rule to add
 * @param candidates - Candidate rules with frequencies
 * @param lambda - Rule cost penalty factor
 * @returns Best rule or null if none beneficial
 */
export function findBestRule(
  candidates: Array<{ rule: Rule; frequency: number }>,
  lambda: number = 1.0
): { rule: Rule; frequency: number; gain: number } | null {
  let best = null;
  let bestGain = -Infinity;
  
  for (const candidate of candidates) {
    const gain = mdlGain(candidate.rule, candidate.frequency, lambda);
    if (gain > bestGain) {
      bestGain = gain;
      best = { ...candidate, gain };
    }
  }
  
  return bestGain > 0 ? best : null;
}

/**
 * Create empty grammar
 */
export function createGrammar(): Grammar {
  return {
    rules: new Map(),
    symbols: new Set(),
    depth: 0
  };
}

/**
 * Add a rule to the grammar
 * @param grammar - Grammar to modify
 * @param rule - Rule to add
 * @returns True if added successfully
 */
export function addRule(grammar: Grammar, rule: Rule): boolean {
  if (grammar.symbols.has(rule.symbol)) {
    return false; // Symbol already exists
  }
  
  grammar.rules.set(rule.symbol, rule);
  grammar.symbols.add(rule.symbol);
  grammar.depth = Math.max(grammar.depth, rule.symbol.length);
  
  return true;
}
