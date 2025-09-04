/**
 * Browser-compatible Fractal Grammar Tape (FGT) implementation
 */

export type Path = string; // Base-3 string like "021", "1201", etc.

export interface Rule {
  symbol: string;
  children: string[];
  expansion: string[];
  gain: number;
  frequency: number;
}

export interface Grammar {
  rules: Map<string, Rule>;
  symbols: Set<string>;
  depth: number;
}

export interface FGTConfig {
  topK: number;
  nMin: number;
  nMax: number;
  maxIterations: number;
  lambda: number;
  minGain: number;
  minFreq: number;
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
 * Convert number to base-3 string
 */
export function toBase3(n: number, minLength: number = 1): Path {
  if (n === 0) return '0'.repeat(minLength);
  
  let result = '';
  while (n > 0) {
    result = (n % 3).toString() + result;
    n = Math.floor(n / 3);
  }
  
  while (result.length < minLength) {
    result = '0' + result;
  }
  
  return result;
}

/**
 * Get next available path
 */
export function nextPath(usedPaths: Set<Path>, depth: number): Path {
  let candidate = toBase3(0, depth);
  let counter = 0;
  
  while (usedPaths.has(candidate)) {
    counter++;
    candidate = toBase3(counter, depth);
    
    if (counter > Math.pow(3, depth)) {
      throw new Error(`No available paths at depth ${depth}`);
    }
  }
  
  return candidate;
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
 * Add rule to grammar
 */
export function addRule(grammar: Grammar, rule: Rule): boolean {
  if (grammar.symbols.has(rule.symbol)) {
    return false;
  }
  
  grammar.rules.set(rule.symbol, rule);
  grammar.symbols.add(rule.symbol);
  grammar.depth = Math.max(grammar.depth, rule.symbol.length);
  
  return true;
}

/**
 * Define new symbol
 */
export function defineSymbol(
  grammar: Grammar,
  children: Path[],
  expansion: string[],
  frequency: number = 1
): Path | null {
  const symbol = nextPath(grammar.symbols, 1);
  const rule: Rule = {
    symbol,
    children,
    expansion,
    gain: 0,
    frequency
  };
  
  if (addRule(grammar, rule)) {
    return symbol;
  }
  
  return null;
}

/**
 * Mine n-grams with benefit scoring
 */
export function mineNgrams(tokens: string[], nMin: number = 2, nMax: number = 5) {
  const freq = new Map<string, number>();
  
  for (let n = nMin; n <= nMax; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n);
      const key = phrase.join('\u0001');
      freq.set(key, (freq.get(key) || 0) + 1);
    }
  }
  
  const candidates: Array<{ phrase: string[]; frequency: number; gain: number }> = [];
  
  for (const [key, frequency] of freq) {
    const phrase = key.split('\u0001');
    const byteSize = phrase.join(' ').length;
    const compressedSize = 2; // Assume 2-char symbol
    const gain = (byteSize - compressedSize) * frequency;
    
    if (gain > 0) {
      candidates.push({ phrase, frequency, gain });
    }
  }
  
  return candidates.sort((a, b) => b.gain - a.gain);
}

/**
 * Replace phrase in stream
 */
function replacePhraseInStream(stream: Path[], phrase: string[], symbol: Path): Path[] {
  const result: Path[] = [];
  let i = 0;
  
  while (i < stream.length) {
    let match = true;
    
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
 * Train FGT (simplified version)
 */
export function trainFGT(text: string, config: FGTConfig = {
  topK: 50,
  nMin: 2,
  nMax: 4,
  maxIterations: 20,
  lambda: 1.0,
  minGain: 1.0,
  minFreq: 2
}): FGTResult {
  // Tokenize
  const tokens = text.toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  
  // Initialize
  const grammar = createGrammar();
  let stream: Path[] = [...tokens];
  
  // Mine and add rules
  const candidates = mineNgrams(tokens, config.nMin, config.nMax);
  const topCandidates = candidates.slice(0, config.topK);
  
  for (const candidate of topCandidates) {
    if (candidate.gain >= config.minGain && candidate.frequency >= config.minFreq) {
      const children = candidate.phrase.map(word => word);
      const symbol = defineSymbol(grammar, children, candidate.phrase, candidate.frequency);
      
      if (symbol) {
        stream = replacePhraseInStream(stream, candidate.phrase, symbol);
      }
    }
  }
  
  // Calculate stats
  const originalSize = text.length;
  const compressedSize = stream.join(' ').length + grammar.rules.size * 10; // Rough estimate
  const compressionRatio = compressedSize / originalSize;
  const totalSavings = originalSize - compressedSize;
  
  const depthDist = new Map<number, number>();
  for (const symbol of grammar.symbols) {
    const depth = symbol.length;
    depthDist.set(depth, (depthDist.get(depth) || 0) + 1);
  }
  
  return {
    grammar,
    stream,
    originalTokens: tokens,
    compressionRatio,
    totalSavings,
    iterations: 0,
    stats: {
      rulesCreated: grammar.rules.size,
      maxDepth: grammar.depth,
      avgRuleLength: 2, // Simplified
      depthDistribution: depthDist
    }
  };
}

/**
 * Expand symbol to tokens
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
 * Expand stream to original tokens
 */
export function expandStream(grammar: Grammar, stream: Path[]): string[] {
  const result: string[] = [];
  
  for (const symbol of stream) {
    result.push(...expandSymbol(grammar, symbol));
  }
  
  return result;
}

/**
 * Get grammar statistics
 */
export function getGrammarStats(grammar: Grammar) {
  return {
    totalRules: grammar.rules.size,
    maxDepth: grammar.depth,
    symbols: Array.from(grammar.symbols),
    rules: Array.from(grammar.rules.values())
  };
}
