/**
 * RePair/Sequitur-style pair grammar induction for FGT
 */

import type { Rule, Grammar } from './mdl.js';
import type { Path } from './path.js';
import { defineSymbol, expandStream } from './grammar.js';
import { mdlGain, mdlImproves } from './mdl.js';

export interface Pair {
  left: string;
  right: string;
  frequency: number;
  gain: number;
}

/**
 * Find the most frequent adjacent pair in a stream
 * @param stream - Stream of symbols
 * @returns Most frequent pair or null if none found
 */
export function findMostFrequentPair(stream: string[]): Pair | null {
  const freq = new Map<string, number>();
  
  for (let i = 0; i < stream.length - 1; i++) {
    const pair = `${stream[i]}\u0001${stream[i + 1]}`;
    freq.set(pair, (freq.get(pair) || 0) + 1);
  }
  
  if (freq.size === 0) return null;
  
  let bestPair = '';
  let bestFreq = 0;
  
  for (const [pair, frequency] of freq) {
    if (frequency > bestFreq) {
      bestFreq = frequency;
      bestPair = pair;
    }
  }
  
  const [left, right] = bestPair.split('\u0001');
  return {
    left,
    right,
    frequency: bestFreq,
    gain: 0 // Will be calculated later
  };
}

/**
 * Replace all occurrences of a pair with a new symbol
 * @param stream - Stream to modify
 * @param pair - Pair to replace
 * @param newSymbol - Symbol to replace with
 * @returns New stream with replacements
 */
export function replacePair(stream: string[], pair: Pair, newSymbol: string): string[] {
  const result: string[] = [];
  let i = 0;
  
  while (i < stream.length) {
    if (i < stream.length - 1 && 
        stream[i] === pair.left && 
        stream[i + 1] === pair.right) {
      result.push(newSymbol);
      i += 2; // Skip both symbols
    } else {
      result.push(stream[i]);
      i++;
    }
  }
  
  return result;
}

/**
 * Calculate gain for a pair replacement
 * @param pair - Pair to replace
 * @param frequency - How many times it appears
 * @param symbolSize - Size of the new symbol
 * @param lambda - Rule cost penalty
 * @returns MDL gain
 */
export function calculatePairGain(
  pair: Pair,
  frequency: number,
  symbolSize: number,
  lambda: number = 1.0
): number {
  const originalSize = (pair.left.length + pair.right.length + 1) * frequency; // +1 for space
  const compressedSize = symbolSize * frequency;
  const ruleCost = 3 + symbolSize + 2; // DEF + symbol + 2 children
  
  return (originalSize - compressedSize) - (ruleCost * lambda);
}

/**
 * Try to define a new symbol for a pair
 * @param grammar - Grammar to modify
 * @param pair - Pair to create symbol for
 * @param frequency - How many times it appears
 * @param lambda - Rule cost penalty
 * @returns New symbol path or null if not beneficial
 */
export function tryDefinePair(
  grammar: Grammar,
  pair: Pair,
  frequency: number,
  lambda: number = 1.0
): Path | null {
  const symbolSize = 2; // Assume 2-char symbol
  const gain = calculatePairGain(pair, frequency, symbolSize, lambda);
  
  if (gain <= 0) return null;
  
  const children = [pair.left, pair.right];
  const expansion = [pair.left, pair.right];
  
  return defineSymbol(grammar, children, expansion, frequency);
}

/**
 * Run RePair-style grammar induction
 * @param grammar - Grammar to build
 * @param stream - Initial stream
 * @param maxIterations - Maximum iterations
 * @param lambda - Rule cost penalty
 * @returns Final stream after induction
 */
export function runRepair(
  grammar: Grammar,
  stream: string[],
  maxIterations: number = 100,
  lambda: number = 1.0
): string[] {
  let currentStream = [...stream];
  let iterations = 0;
  
  while (iterations < maxIterations) {
    const pair = findMostFrequentPair(currentStream);
    if (!pair) break;
    
    const newSymbol = tryDefinePair(grammar, pair, pair.frequency, lambda);
    if (!newSymbol) break;
    
    currentStream = replacePair(currentStream, pair, newSymbol);
    iterations++;
  }
  
  return currentStream;
}

/**
 * Run Sequitur-style grammar induction (more conservative)
 * @param grammar - Grammar to build
 * @param stream - Initial stream
 * @param maxIterations - Maximum iterations
 * @param lambda - Rule cost penalty
 * @returns Final stream after induction
 */
export function runSequitur(
  grammar: Grammar,
  stream: string[],
  maxIterations: number = 100,
  lambda: number = 1.0
): string[] {
  let currentStream = [...stream];
  let iterations = 0;
  
  while (iterations < maxIterations) {
    const pair = findMostFrequentPair(currentStream);
    if (!pair) break;
    
    // Sequitur only creates rules for pairs that appear at least twice
    if (pair.frequency < 2) break;
    
    const newSymbol = tryDefinePair(grammar, pair, pair.frequency, lambda);
    if (!newSymbol) break;
    
    currentStream = replacePair(currentStream, pair, newSymbol);
    iterations++;
  }
  
  return currentStream;
}

/**
 * Run hybrid grammar induction (RePair + Sequitur)
 * @param grammar - Grammar to build
 * @param stream - Initial stream
 * @param maxIterations - Maximum iterations
 * @param lambda - Rule cost penalty
 * @returns Final stream after induction
 */
export function runHybridInduction(
  grammar: Grammar,
  stream: string[],
  maxIterations: number = 100,
  lambda: number = 1.0
): string[] {
  let currentStream = [...stream];
  let iterations = 0;
  
  // Phase 1: RePair (aggressive)
  const repairIterations = Math.floor(maxIterations * 0.7);
  currentStream = runRepair(grammar, currentStream, repairIterations, lambda);
  
  // Phase 2: Sequitur (conservative)
  const sequiturIterations = maxIterations - repairIterations;
  currentStream = runSequitur(grammar, currentStream, sequiturIterations, lambda);
  
  return currentStream;
}

/**
 * Analyze pair induction results
 * @param grammar - Grammar after induction
 * @param originalStream - Original stream
 * @param finalStream - Final stream
 * @returns Analysis summary
 */
export function analyzePairInduction(
  grammar: Grammar,
  originalStream: string[],
  finalStream: string[]
) {
  const originalSize = originalStream.join(' ').length;
  const finalSize = finalStream.join(' ').length;
  const compressionRatio = finalSize / originalSize;
  
  const stats = {
    originalTokens: originalStream.length,
    finalTokens: finalStream.length,
    originalSize,
    finalSize,
    compressionRatio,
    rulesCreated: grammar.rules.size,
    maxDepth: grammar.depth,
    avgRuleLength: 0
  };
  
  // Calculate average rule length
  let totalRuleLength = 0;
  for (const rule of grammar.rules.values()) {
    totalRuleLength += rule.children.length;
  }
  stats.avgRuleLength = totalRuleLength / grammar.rules.size;
  
  return stats;
}

/**
 * Get pair frequency distribution
 * @param stream - Stream to analyze
 * @returns Map of pair -> frequency
 */
export function getPairDistribution(stream: string[]): Map<string, number> {
  const dist = new Map<string, number>();
  
  for (let i = 0; i < stream.length - 1; i++) {
    const pair = `${stream[i]}\u0001${stream[i + 1]}`;
    dist.set(pair, (dist.get(pair) || 0) + 1);
  }
  
  return dist;
}
