import { buildTrie, encodeWithTrie, DEFAULT_GLYPHS } from './glyph.js';
import { normalizeWords } from './utils.js';
import { minDepthForSlots } from './address.js';
import type { IngestStats, Address, Token } from './types.js';
import type { GlyphEntry } from './trainer.js';
import { openStore } from './store.js';
export function encodeTextToTokens(text:string,glyphs:GlyphEntry[]=DEFAULT_GLYPHS){const words=normalizeWords(text);const trie=buildTrie(glyphs);return encodeWithTrie(words,trie);}
export function ingestDocsToStore(docs:string[],dbPath='tape.db',glyphs:GlyphEntry[]=DEFAULT_GLYPHS):IngestStats{
  const store=openStore(dbPath);
  
  // Batch insert glyphs
  const glyphEntries: Array<[string, string]> = glyphs.map(g => [g.glyph, g.phrase.join(' ')]);
  store.batchGlyphs(glyphEntries);
  
  let addr=0,pre=0,post=0;
  const BATCH_SIZE = 1000; // Process in batches of 1000
  
  for(let doc=0; doc<docs.length; doc++){
    const words=normalizeWords(docs[doc]); 
    pre+=words.length;
    const toks=encodeTextToTokens(docs[doc],glyphs); 
    post+=toks.length;
    const start=addr;
    
    // Batch insert tokens and postings
    const tokenEntries: Array<[Address, Token]> = [];
    const postingEntries: Array<[Token, Address]> = [];
    
    for(const t of toks){
      tokenEntries.push([addr, t]);
      postingEntries.push([t, addr]);
      addr++;
    }
    
    // Insert in batches
    for(let i = 0; i < tokenEntries.length; i += BATCH_SIZE) {
      const tokenBatch = tokenEntries.slice(i, i + BATCH_SIZE);
      const postingBatch = postingEntries.slice(i, i + BATCH_SIZE);
      store.batchTokens(tokenBatch);
      store.batchPostings(postingBatch);
    }
    
    store.addDocBounds(doc,start,addr);
  }
  
  const D=minDepthForSlots(addr); 
  const u=store.db.prepare('SELECT COUNT(DISTINCT token) as u FROM tokens').get() as {u:number};
  store.close(); 
  return {docs:docs.length,tokensPre:pre,tokensPost:post,uniqueTokens:u.u,depthD:D};
}