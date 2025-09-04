#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { glob } from 'glob';
import { ingestDocsToStore, encodeTextToTokens, openStore, buildBitmapIndexFromStore, bitmapStats, intersectTokenDocs, unionTokenDocs } from '@fractaltape/tape-core';
import { packAddressesIntoSpans, findMinMaxSpans, mergeOverlappingSpans, type AddressSpan } from '@fractaltape/tape-core';

interface QueryOptions {
  mode: 'union' | 'intersection';
  window: number;
  minSpan: number;
  maxGap: number;
  limit: number;
  json: boolean;
}

function usage(){console.log(`Usage:
  tape ingest <folder-or-files...>
  tape query "<text>" [options]
  tape export <outfile.json>
  tape glyph-train <folder-or-files...> [options]
  tape bitmap [options]

Query options:
  --and, --intersection    Use AND logic (intersection) instead of OR (union)
  --or, --union           Use OR logic (union) - default
  --window <k>            Pack adjacent addresses into spans with gap <= k (default: 0)
  --min-span <n>          Minimum span size to include (default: 1)
  --max-gap <k>           Maximum gap between addresses in same span (default: 0)
  --limit <n>             Limit results to n hits (default: 50)
  --json                  Output as JSON (default: pretty-printed)

Glyph training options:
  --min-freq <n>          Minimum phrase frequency to consider (default: 2)
  --max-glyphs <n>        Maximum number of glyphs to generate (default: 20)
  --output <file>         Output glyph dictionary to file (default: glyphs.json)

Bitmap options:
  --build                 Build bitmap index from database
  --stats                 Show bitmap index statistics
  --test "<query>"        Test bitmap query performance`);}

function parseQueryArgs(args: string[]): { query: string; options: QueryOptions } {
  const options: QueryOptions = {
    mode: 'union',
    window: 0,
    minSpan: 1,
    maxGap: 0,
    limit: 50,
    json: false
  };
  
  const queryParts: string[] = [];
  let i = 0;
  
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--and':
        case '--intersection':
          options.mode = 'intersection';
          break;
        case '--or':
        case '--union':
          options.mode = 'union';
          break;
        case '--window':
          options.window = parseInt(args[++i] || '0', 10);
          break;
        case '--min-span':
          options.minSpan = parseInt(args[++i] || '1', 10);
          break;
        case '--max-gap':
          options.maxGap = parseInt(args[++i] || '0', 10);
          break;
        case '--limit':
          options.limit = parseInt(args[++i] || '50', 10);
          break;
        case '--json':
          options.json = true;
          break;
        default:
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
      }
    } else {
      queryParts.push(arg);
    }
    i++;
  }
  
  return { query: queryParts.join(' '), options };
}


interface GlyphTrainOptions {
  minFreq: number;
  maxGlyphs: number;
  output?: string;
}

function parseGlyphTrainArgs(args: string[]): { inputs: string[]; options: GlyphTrainOptions } {
  const options: GlyphTrainOptions = {
    minFreq: 2,
    maxGlyphs: 20,
    output: 'glyphs.json'
  };
  
  const inputs: string[] = [];
  let i = 0;
  
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--min-freq':
          options.minFreq = parseInt(args[++i] || '2', 10);
          break;
        case '--max-glyphs':
          options.maxGlyphs = parseInt(args[++i] || '20', 10);
          break;
        case '--output':
          options.output = args[++i] || 'glyphs.json';
          break;
        default:
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
      }
    } else {
      inputs.push(arg);
    }
    i++;
  }
  
  return { inputs, options };
}

interface BitmapOptions {
  build: boolean;
  stats: boolean;
  test?: string;
  mode: 'union' | 'intersection';
}

function parseBitmapArgs(args: string[]): { options: BitmapOptions } {
  const options: BitmapOptions = {
    build: false,
    stats: false,
    mode: 'union'
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--build':
          options.build = true;
          break;
        case '--stats':
          options.stats = true;
          break;
        case '--test':
          options.test = args[++i] || '';
          break;
        case '--and':
        case '--intersection':
          options.mode = 'intersection';
          break;
        case '--or':
        case '--union':
          options.mode = 'union';
          break;
        default:
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
      }
    }
    i++;
  }
  
  return { options };
}

function analyzePhrases(docs: string[], minFreq: number): Map<string, number> {
  const phraseFreq = new Map<string, number>();
  
  for (const doc of docs) {
    const words = doc.toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    // Analyze bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
    }
    
    // Analyze trigrams
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
    }
    
    // Analyze 4-grams
    for (let i = 0; i < words.length - 3; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`;
      phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
    }
  }
  
  // Filter by minimum frequency
  for (const [phrase, freq] of phraseFreq.entries()) {
    if (freq < minFreq) {
      phraseFreq.delete(phrase);
    }
  }
  
  return phraseFreq;
}

function generateGlyphs(phraseFreq: Map<string, number>, maxGlyphs: number): Array<{phrase: string[], glyph: string}> {
  // Sort phrases by frequency (descending) and length (descending for ties)
  const sortedPhrases = Array.from(phraseFreq.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // Frequency first
      return b[0].split(' ').length - a[0].split(' ').length; // Length second
    })
    .slice(0, maxGlyphs);
  
  // Generate simple glyphs (could be enhanced with more sophisticated algorithms)
  const glyphs: Array<{phrase: string[], glyph: string}> = [];
  const usedGlyphs = new Set<string>();
  
  for (const [phrase, freq] of sortedPhrases) {
    const words = phrase.split(' ');
    const glyph = generateSimpleGlyph(words, usedGlyphs);
    if (glyph) {
      glyphs.push({ phrase: words, glyph });
      usedGlyphs.add(glyph);
    }
  }
  
  return glyphs;
}

function generateSimpleGlyph(words: string[], usedGlyphs: Set<string>): string | null {
  // Try different glyph generation strategies
  const strategies = [
    // Strategy 1: First letters
    () => words.map(w => w[0]).join('').toUpperCase(),
    
    // Strategy 2: First and last letters
    () => words.map(w => w[0] + (w.length > 1 ? w[w.length - 1] : '')).join('').toUpperCase(),
    
    // Strategy 3: Symbolic representation
    () => {
      const symbols = ['⊕', '⊗', '⊙', '⊛', '⊚', '⊝', '⊞', '⊟', '⊠', '⊡', '⊢', '⊣', '⊤', '⊥', '⊧', '⊨', '⊩', '⊪', '⊫', '⊬'];
      const index = words.length + words[0].length;
      return symbols[index % symbols.length];
    },
    
    // Strategy 4: Unicode combinations
    () => {
      const base = 0x2000 + (words.length * 10) + (words[0].charCodeAt(0) % 10);
      return String.fromCharCode(base);
    }
  ];
  
  for (const strategy of strategies) {
    const glyph = strategy();
    if (!usedGlyphs.has(glyph) && glyph.length <= 3) {
      return glyph;
    }
  }
  
  return null;
}

async function run(){const[,,cmd,...args]=process.argv; if(!cmd) return usage();
  if(cmd==='ingest'){ 
    if(args.length===0) return usage(); 
    const inputs:string[]=[];
    for(const a of args){
      const st=fs.statSync(a); 
      if(st.isDirectory()){
        const files = glob.sync('**/*.{txt,md}',{cwd:a,nodir:true});
        for(const f of files) inputs.push(path.join(a,f));
      } else {
        inputs.push(a);
      }
    }
    const docs=inputs.map(f=>fs.readFileSync(f,'utf8')); 
    const stats=ingestDocsToStore(docs,'tape.db'); 
    console.log('Ingest complete:',stats); 
    return;
  }
  if(cmd==='query'){
    const {query, options} = parseQueryArgs(args);
    if(!query) return usage();
    
    const store=openStore('tape.db'); 
    const tokens=encodeTextToTokens(query);
    
    let addrs: number[];
    if (options.mode === 'intersection') {
      // AND logic: find intersection of all token postings
      if (tokens.length === 0) {
        addrs = [];
      } else {
        const tokenSets = tokens.map(t => new Set(store.postings(t, 100000)));
        addrs = Array.from(tokenSets[0]).filter(addr => 
          tokenSets.every(set => set.has(addr))
        ).sort((a,b) => a-b);
      }
    } else {
      // OR logic: find union of all token postings (default)
      const addrSet=new Set<number>(); 
      for(const t of tokens){
        for(const a of store.postings(t,100000)) addrSet.add(a);
      } 
      addrs=Array.from(addrSet).sort((a,b)=>a-b);
    }
    
    // Apply limit
    const limitedAddrs = addrs.slice(0, options.limit);
    
    // Generate spans based on windowing options
    let spans: AddressSpan[] = [];
    if (options.window > 0 || options.minSpan > 1 || options.maxGap > 0) {
      spans = findMinMaxSpans(limitedAddrs, options.minSpan, options.maxGap);
      if (options.window > 0) {
        spans = mergeOverlappingSpans(spans, options.window);
      }
    }
    
    const docs=store.addressesToDocs(limitedAddrs); 
    const snippets:{doc:number,addr:number,text:string}[]=[];
    for (const a of limitedAddrs) { 
      const doc=store.addressToDoc(a); 
      const start=Math.max(0,a-20); 
      const end=a+20; 
      const toks=store.tokensInRange(start,end); 
      snippets.push({doc,addr:a,text:toks.join(' ')}); 
    }
    
    const result = { 
      query, 
      tokens, 
      hits: addrs.length, 
      limitedHits: limitedAddrs.length,
      docs, 
      snippets,
      spans: spans.length > 0 ? spans : undefined,
      options
    };
    
    if (options.json) {
      console.log(JSON.stringify(result));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    store.close(); 
    return;
  }
  if(cmd==='export'){
    const out=args[0]; 
    if(!out) return usage(); 
    
    const store=openStore('tape.db');
    
    // Get basic metadata
    const countRow=store.db.prepare('SELECT COUNT(*) as c FROM tokens').get() as {c:number}; 
    const D=Math.ceil(Math.log(countRow.c)/Math.log(3));
    
    // Get postings for all tokens (limited to prevent huge files)
    const postings:Record<string,number[]>={}; 
    const rows=store.db.prepare('SELECT DISTINCT token FROM tokens LIMIT 20000').all() as {token:string}[];
    for(const {token} of rows){
      postings[token]=store.postings(token,500);
    }
    
    // Get document bounds
    const bounds=store.db.prepare('SELECT doc,start,end FROM doc_bounds ORDER BY doc ASC').all();
    
    // Get glyph dictionary
    const glyphDict=store.db.prepare('SELECT glyph, phrase FROM glyph_dict').all() as {glyph:string, phrase:string}[];
    const glyphs = glyphDict.map(g => ({
      glyph: g.glyph,
      phrase: g.phrase.split(' ')
    }));
    
    // Get token windows for UI hover (sample of addresses with context)
    const sampleAddresses = store.db.prepare(`
      SELECT addr FROM tokens 
      ORDER BY RANDOM() 
      LIMIT 1000
    `).all() as {addr:number}[];
    
    const tokenWindows: Array<{addr: number, tokens: string[]}> = [];
    for(const {addr} of sampleAddresses) {
      const start = Math.max(0, addr - 10);
      const end = addr + 10;
      const tokens = store.tokensInRange(start, end);
      tokenWindows.push({addr, tokens});
    }
    
    // Get compression stats
    const stats = {
      totalTokens: countRow.c,
      uniqueTokens: rows.length,
      documents: bounds.length,
      compressionRatio: 0 // Will be calculated by client
    };
    
    const obj = { 
      meta: { 
        count: countRow.c, 
        depthD: D, 
        generatedAt: new Date().toISOString(),
        stats
      }, 
      postings, 
      bounds,
      glyphs,
      tokenWindows,
      version: '0.2.0'
    };
    
    fs.mkdirSync(path.dirname(out),{recursive:true}); 
    fs.writeFileSync(out,JSON.stringify(obj, null, 2)); 
    console.log(`Exported to ${out} (${Math.round(JSON.stringify(obj).length/1024)}KB)`); 
    store.close(); 
    return;
  }
  
  if(cmd==='glyph-train'){
    const {inputs, options} = parseGlyphTrainArgs(args);
    if(inputs.length === 0) return usage();
    
    // Collect all documents
    const allDocs: string[] = [];
    for(const input of inputs){
      const st = fs.statSync(input);
      if(st.isDirectory()){
        const files = glob.sync('**/*.{txt,md}',{cwd:input,nodir:true});
        for(const f of files){
          allDocs.push(fs.readFileSync(path.join(input,f),'utf8'));
        }
      } else {
        allDocs.push(fs.readFileSync(input,'utf8'));
      }
    }
    
    // Analyze phrases
    const phraseFreq = analyzePhrases(allDocs, options.minFreq);
    
    // Generate glyphs
    const glyphs = generateGlyphs(phraseFreq, options.maxGlyphs);
    
    // Output results
    const output = {
      generatedAt: new Date().toISOString(),
      source: inputs,
      stats: {
        documents: allDocs.length,
        totalWords: allDocs.reduce((sum, doc) => sum + doc.split(/\s+/).length, 0),
        uniquePhrases: phraseFreq.size,
        generatedGlyphs: glyphs.length
      },
      glyphs
    };
    
    if(options.output) {
      fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
      console.log(`Generated ${glyphs.length} glyphs and saved to ${options.output}`);
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
    return;
  }
  
  if(cmd==='bitmap'){
    const {options} = parseBitmapArgs(args);
    
    if(options.build) {
      console.log('Building bitmap index...');
      const store = openStore('tape.db');
      const startTime = Date.now();
      const index = buildBitmapIndexFromStore(store);
      const buildTime = Date.now() - startTime;
      
      console.log(`Bitmap index built in ${buildTime}ms`);
      console.log('Stats:', bitmapStats(index));
      
      // Save index for future use
      const indexData = {
        totalDocs: index.totalDocs,
        totalTokens: index.tokenToDocs.size,
        buildTime,
        generatedAt: new Date().toISOString()
      };
      fs.writeFileSync('bitmap-index.json', JSON.stringify(indexData, null, 2));
      console.log('Index metadata saved to bitmap-index.json');
      
      store.close();
      return;
    }
    
    if(options.stats) {
      if(!fs.existsSync('bitmap-index.json')) {
        console.log('Bitmap index not found. Run "tape bitmap --build" first.');
        return;
      }
      
      const store = openStore('tape.db');
      const index = buildBitmapIndexFromStore(store);
      const stats = bitmapStats(index);
      
      console.log('Bitmap Index Statistics:');
      console.log(`  Total tokens: ${stats.totalTokens}`);
      console.log(`  Total docs: ${stats.totalDocs}`);
      console.log(`  Avg tokens per doc: ${stats.avgTokensPerDoc.toFixed(2)}`);
      console.log(`  Avg docs per token: ${stats.avgDocsPerToken.toFixed(2)}`);
      
      store.close();
      return;
    }
    
    if(options.test) {
      const store = openStore('tape.db');
      const index = buildBitmapIndexFromStore(store);
      const tokens = encodeTextToTokens(options.test);
      
      console.log(`Testing query: "${options.test}"`);
      console.log(`Tokens: [${tokens.join(', ')}]`);
      
      // Test bitmap performance
      const startTime = Date.now();
      const bitmapDocs = options.mode === 'intersection' 
        ? intersectTokenDocs(index, tokens)
        : unionTokenDocs(index, tokens);
      const bitmapTime = Date.now() - startTime;
      
      // Test traditional performance
      const startTime2 = Date.now();
      let traditionalDocs: number[];
      if (options.mode === 'intersection') {
        const tokenSets = tokens.map(t => new Set(store.postings(t, 100000)));
        traditionalDocs = Array.from(tokenSets[0]).filter(addr => 
          tokenSets.every(set => set.has(addr))
        ).map(addr => store.addressToDoc(addr));
      } else {
        const addrSet = new Set<number>();
        for(const t of tokens) {
          for(const a of store.postings(t, 100000)) addrSet.add(a);
        }
        traditionalDocs = Array.from(addrSet).map(addr => store.addressToDoc(addr));
      }
      const traditionalTime = Date.now() - startTime2;
      
      console.log(`Bitmap query: ${bitmapDocs.length} docs in ${bitmapTime}ms`);
      console.log(`Traditional query: ${traditionalDocs.length} docs in ${traditionalTime}ms`);
      console.log(`Speedup: ${(traditionalTime / bitmapTime).toFixed(2)}x`);
      
      store.close();
      return;
    }
    
    console.log('Use --build, --stats, or --test with bitmap command');
    return;
  }
  
  usage();}
run().catch(e=>{console.error(e);process.exit(1);});