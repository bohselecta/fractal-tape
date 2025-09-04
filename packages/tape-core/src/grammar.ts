/**
 * Grammar DAG management for Fractal Grammar Tape
 */

import type { Rule, Grammar } from './mdl.js';
import type { Path } from './path.js';
import { nextAvailablePath, getChildren, isAncestor } from './path.js';

/**
 * Create a new rule
 * @param symbol - Symbol address path
 * @param children - Child symbol addresses
 * @param expansion - Original phrase tokens
 * @param frequency - How often this rule is used
 * @returns New rule
 */
export function createRule(
  symbol: Path,
  children: Path[],
  expansion: string[],
  frequency: number = 1
): Rule {
  return {
    symbol,
    children,
    expansion,
    gain: 0, // Will be calculated later
    frequency
  };
}

/**
 * Define a new symbol in the grammar
 * @param grammar - Grammar to modify
 * @param children - Child symbol addresses
 * @param expansion - Original phrase tokens
 * @param frequency - How often this rule is used
 * @returns New symbol path or null if failed
 */
export function defineSymbol(
  grammar: Grammar,
  children: Path[],
  expansion: string[],
  frequency: number = 1
): Path | null {
  const symbol = nextAvailablePath(grammar.symbols);
  const rule = createRule(symbol, children, expansion, frequency);
  
  if (addRule(grammar, rule)) {
    return symbol;
  }
  
  return null;
}

/**
 * Add a rule to the grammar (from mdl.ts)
 */
function addRule(grammar: Grammar, rule: Rule): boolean {
  if (grammar.symbols.has(rule.symbol)) {
    return false; // Symbol already exists
  }
  
  grammar.rules.set(rule.symbol, rule);
  grammar.symbols.add(rule.symbol);
  grammar.depth = Math.max(grammar.depth, rule.symbol.length);
  
  return true;
}

/**
 * Expand a symbol to its full expansion
 * @param grammar - Grammar containing rules
 * @param symbol - Symbol to expand
 * @returns Expanded tokens
 */
export function expandSymbol(grammar: Grammar, symbol: Path): string[] {
  const rule = grammar.rules.get(symbol);
  if (!rule) {
    return [symbol]; // Unknown symbol, treat as literal
  }
  
  const result: string[] = [];
  for (const child of rule.children) {
    result.push(...expandSymbol(grammar, child));
  }
  
  return result;
}

/**
 * Expand a stream of symbols
 * @param grammar - Grammar containing rules
 * @param stream - Stream of symbol addresses
 * @returns Expanded token stream
 */
export function expandStream(grammar: Grammar, stream: Path[]): string[] {
  const result: string[] = [];
  
  for (const symbol of stream) {
    result.push(...expandSymbol(grammar, symbol));
  }
  
  return result;
}

/**
 * Find all symbols that reference a given symbol
 * @param grammar - Grammar to search
 * @param target - Target symbol to find references to
 * @returns Array of symbols that reference target
 */
export function findReferences(grammar: Grammar, target: Path): Path[] {
  const references: Path[] = [];
  
  for (const [symbol, rule] of grammar.rules) {
    if (rule.children.includes(target)) {
      references.push(symbol);
    }
  }
  
  return references;
}

/**
 * Get dependency graph of the grammar
 * @param grammar - Grammar to analyze
 * @returns Map of symbol -> its dependencies
 */
export function getDependencyGraph(grammar: Grammar): Map<Path, Path[]> {
  const deps = new Map<Path, Path[]>();
  
  for (const [symbol, rule] of grammar.rules) {
    deps.set(symbol, [...rule.children]);
  }
  
  return deps;
}

/**
 * Check if grammar has cycles
 * @param grammar - Grammar to check
 * @returns True if grammar has cycles
 */
export function hasCycles(grammar: Grammar): boolean {
  const visited = new Set<Path>();
  const recStack = new Set<Path>();
  
  function hasCycle(symbol: Path): boolean {
    if (recStack.has(symbol)) return true;
    if (visited.has(symbol)) return false;
    
    visited.add(symbol);
    recStack.add(symbol);
    
    const rule = grammar.rules.get(symbol);
    if (rule) {
      for (const child of rule.children) {
        if (hasCycle(child)) return true;
      }
    }
    
    recStack.delete(symbol);
    return false;
  }
  
  for (const symbol of grammar.symbols) {
    if (hasCycle(symbol)) return true;
  }
  
  return false;
}

/**
 * Get topological sort of grammar symbols
 * @param grammar - Grammar to sort
 * @returns Topologically sorted symbols
 */
export function topologicalSort(grammar: Grammar): Path[] {
  const visited = new Set<Path>();
  const result: Path[] = [];
  
  function visit(symbol: Path) {
    if (visited.has(symbol)) return;
    
    visited.add(symbol);
    const rule = grammar.rules.get(symbol);
    if (rule) {
      for (const child of rule.children) {
        visit(child);
      }
    }
    result.push(symbol);
  }
  
  for (const symbol of grammar.symbols) {
    visit(symbol);
  }
  
  return result;
}

/**
 * Get statistics about the grammar
 * @param grammar - Grammar to analyze
 * @returns Grammar statistics
 */
export function getGrammarStats(grammar: Grammar) {
  const stats = {
    totalRules: grammar.rules.size,
    maxDepth: grammar.depth,
    avgChildrenPerRule: 0,
    totalExpansions: 0,
    symbolsByDepth: new Map<number, number>()
  };
  
  let totalChildren = 0;
  let totalExpansions = 0;
  
  for (const [symbol, rule] of grammar.rules) {
    const depth = symbol.length;
    stats.symbolsByDepth.set(depth, (stats.symbolsByDepth.get(depth) || 0) + 1);
    
    totalChildren += rule.children.length;
    totalExpansions += rule.expansion.length;
  }
  
  stats.avgChildrenPerRule = totalChildren / grammar.rules.size;
  stats.totalExpansions = totalExpansions;
  
  return stats;
}

/**
 * Validate grammar consistency
 * @param grammar - Grammar to validate
 * @returns Array of validation errors
 */
export function validateGrammar(grammar: Grammar): string[] {
  const errors: string[] = [];
  
  // Check for cycles
  if (hasCycles(grammar)) {
    errors.push('Grammar contains cycles');
  }
  
  // Check for undefined symbols
  for (const [symbol, rule] of grammar.rules) {
    for (const child of rule.children) {
      if (!grammar.symbols.has(child) && !isValidPath(child)) {
        errors.push(`Rule ${symbol} references undefined symbol ${child}`);
      }
    }
  }
  
  // Check for duplicate symbols
  const seen = new Set<Path>();
  for (const symbol of grammar.symbols) {
    if (seen.has(symbol)) {
      errors.push(`Duplicate symbol ${symbol}`);
    }
    seen.add(symbol);
  }
  
  return errors;
}

/**
 * Check if a path is valid (from path.ts)
 */
function isValidPath(path: Path): boolean {
  return /^[012]+$/.test(path);
}
