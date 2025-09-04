/**
 * Fractal Grammar Tape (FGT) - Main training algorithm
 */

import type { Rule, Grammar } from './mdl.js';
import type { Path } from './path.js';
import { createGrammar, addRule } from './mdl.js';
import { defineSymbol, expandStream } from './grammar.js';
import { mineHighOrder } from './mine.js';
import { runHybridInduction } from './repair.js';
import { nextAvailablePath } from './path.js';

export interface FGTConfig {
  topK: number;           // Top K candidates from mining
  nMin: number;           // Minimum n-gram size
  nMax: number;           // Maximum n-gram size
  maxIterations: number;  // Maximum repair iterations
  lambda: number;         // Rule cost penalty factor
  minGain: number;        // Minimum gain threshold
  minFreq: number;        // Minimum frequency threshold
}

export interface FGTResult {
  grammar: Grammar;
  stream: Path[];
  originalTokens: string[];
  compressionRatio: number;
  totalSavings: number;
  iterations: number;
  stats: {
    rulesCreated: number;
    maxDepth: number;
    avgRuleLength: number;
    depthDistribution: Map<number, number>;
  };
}

/**
 * Default FGT configuration
 */
export const DEFAULT_FGT_CONFIG: FGTConfig = {
  topK: 100,
  nMin: 2,
  nMax: 5,
  maxIterations: 50,
  lambda: 1.0,
  minGain: 1.0,
  minFreq: 2
};

/**
 * Train Fractal Grammar Tape
 * @param text - Input text
 * @param config - FGT configuration
 * @returns FGT result
 */
export function trainFGT(text: string, config: FGTConfig = DEFAULT_FGT_CONFIG): FGTResult {
  // Tokenize input
  const tokens = text.toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  
  // Initialize grammar and stream
  const grammar = createGrammar();
  let stream: Path[] = [...tokens]; // Start with word symbols
  let iterations = 0;
  
  // Phase 1: High-order mining
  const candidates = mineHighOrder(tokens, config.topK);
  const filteredCandidates = candidates.filter(c => 
    c.gain >= config.minGain && c.frequency >= config.minFreq
  );
  
  // Add top candidates as rules
  for (const candidate of filteredCandidates) {
    const children = candidate.phrase.map(word => word); // Words as child symbols
    const symbol = defineSymbol(grammar, children, candidate.phrase, candidate.frequency);
    
    if (symbol) {
      // Replace occurrences in stream
      stream = replacePhraseInStream(stream, candidate.phrase, symbol);
    }
  }
  
  // Phase 2: RePair/Sequitur induction
  const finalStream = runHybridInduction(grammar, stream, config.maxIterations, config.lambda);
  
  // Calculate statistics
  const originalSize = text.length;
  const compressedSize = calculateCompressedSize(grammar, finalStream);
  const compressionRatio = compressedSize / originalSize;
  const totalSavings = originalSize - compressedSize;
  
  const stats = {
    rulesCreated: grammar.rules.size,
    maxDepth: grammar.depth,
    avgRuleLength: calculateAvgRuleLength(grammar),
    depthDistribution: getDepthDistribution(grammar)
  };
  
  return {
    grammar,
    stream: finalStream,
    originalTokens: tokens,
    compressionRatio,
    totalSavings,
    iterations,
    stats
  };
}

/**
 * Replace all occurrences of a phrase in a stream
 * @param stream - Stream to modify
 * @param phrase - Phrase to replace
 * @param symbol - Symbol to replace with
 * @returns New stream with replacements
 */
function replacePhraseInStream(stream: Path[], phrase: string[], symbol: Path): Path[] {
  const result: Path[] = [];
  let i = 0;
  
  while (i < stream.length) {
    let match = true;
    
    // Check if phrase matches starting at position i
    for (let j = 0; j < phrase.length; j++) {
      if (i + j >= stream.length || stream[i + j] !== phrase[j]) {
        match = false;
        break;
      }
    }
    
    if (match) {
      result.push(symbol);
      i += phrase.length;
    } else {
      result.push(stream[i]);
      i++;
    }
  }
  
  return result;
}

/**
 * Calculate compressed size of grammar + stream
 * @param grammar - Grammar
 * @param stream - Compressed stream
 * @returns Size in bytes
 */
function calculateCompressedSize(grammar: Grammar, stream: Path[]): number {
  let size = 0;
  
  // Size of grammar rules
  for (const rule of grammar.rules.values()) {
    size += 3; // "DEF"
    size += rule.symbol.length;
    size += rule.children.length * 2; // Each child address
    size += rule.expansion.join(' ').length; // Original phrase
  }
  
  // Size of stream
  size += stream.length * 4; // "REF " + symbol for each token
  
  return size;
}

/**
 * Calculate average rule length
 * @param grammar - Grammar
 * @returns Average number of children per rule
 */
function calculateAvgRuleLength(grammar: Grammar): number {
  if (grammar.rules.size === 0) return 0;
  
  let totalLength = 0;
  for (const rule of grammar.rules.values()) {
    totalLength += rule.children.length;
  }
  
  return totalLength / grammar.rules.size;
}

/**
 * Get depth distribution of grammar
 * @param grammar - Grammar
 * @returns Map of depth -> count
 */
function getDepthDistribution(grammar: Grammar): Map<number, number> {
  const dist = new Map<number, number>();
  
  for (const symbol of grammar.symbols) {
    const depth = symbol.length;
    dist.set(depth, (dist.get(depth) || 0) + 1);
  }
  
  return dist;
}

/**
 * Encode FGT result to stream format
 * @param result - FGT result
 * @returns Encoded stream
 */
export function encodeFGT(result: FGTResult): string {
  const lines: string[] = [];
  
  // Add grammar rules
  for (const [symbol, rule] of result.grammar.rules) {
    const children = rule.children.join(' ');
    const expansion = rule.expansion.join(' ');
    lines.push(`DEF ${symbol} -> [${children}] // ${expansion}`);
  }
  
  // Add stream
  lines.push('STREAM:');
  lines.push(result.stream.join(' '));
  
  return lines.join('\n');
}

/**
 * Decode FGT stream
 * @param encoded - Encoded stream
 * @returns Decoded tokens
 */
export function decodeFGT(encoded: string): string[] {
  const lines = encoded.split('\n');
  const grammar = createGrammar();
  
  // Parse grammar rules
  for (const line of lines) {
    if (line.startsWith('DEF ')) {
      const match = line.match(/DEF (\w+) -> \[([^\]]+)\] \/\/ (.+)/);
      if (match) {
        const [, symbol, childrenStr, expansion] = match;
        const children = childrenStr.split(' ').filter(Boolean);
        const expansionTokens = expansion.split(' ');
        
        addRule(grammar, {
          symbol,
          children,
          expansion: expansionTokens,
          gain: 0,
          frequency: 1
        });
      }
    }
  }
  
  // Find and parse stream
  let stream: Path[] = [];
  let inStream = false;
  for (const line of lines) {
    if (line === 'STREAM:') {
      inStream = true;
    } else if (inStream && line.trim()) {
      stream = line.trim().split(' ');
      break;
    }
  }
  
  // Expand stream
  return expandStream(grammar, stream);
}

/**
 * Get FGT statistics
 * @param result - FGT result
 * @returns Detailed statistics
 */
export function getFGTStats(result: FGTResult) {
  const originalSize = result.originalTokens.join(' ').length;
  const compressedSize = calculateCompressedSize(result.grammar, result.stream);
  
  return {
    original: {
      tokens: result.originalTokens.length,
      size: originalSize
    },
    compressed: {
      tokens: result.stream.length,
      size: compressedSize
    },
    compression: {
      ratio: result.compressionRatio,
      savings: result.totalSavings,
      percentage: (1 - result.compressionRatio) * 100
    },
    grammar: result.stats,
    efficiency: {
      tokensPerRule: result.originalTokens.length / result.stats.rulesCreated,
      bytesPerRule: originalSize / result.stats.rulesCreated
    }
  };
}
