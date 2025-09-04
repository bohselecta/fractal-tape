import pkg from 'roaring';
const { RoaringBitmap32 } = pkg;
import type { Address, DocID, Token } from './types.js';

type RoaringBitmap = InstanceType<typeof RoaringBitmap32>;

export interface BitmapIndex {
  tokenToDocs: Map<Token, RoaringBitmap>;
  docToTokens: Map<DocID, RoaringBitmap>;
  totalDocs: number;
}

export function createBitmapIndex(): BitmapIndex {
  return {
    tokenToDocs: new Map(),
    docToTokens: new Map(),
    totalDocs: 0
  };
}

export function addTokenToDoc(index: BitmapIndex, token: Token, doc: DocID): void {
  // Add token to doc mapping
  if (!index.tokenToDocs.has(token)) {
    index.tokenToDocs.set(token, new RoaringBitmap32());
  }
  index.tokenToDocs.get(token)!.add(doc);
  
  // Add doc to token mapping
  if (!index.docToTokens.has(doc)) {
    index.docToTokens.set(doc, new RoaringBitmap32());
  }
  index.docToTokens.get(doc)!.add(tokenToId(token));
}

export function tokenToId(token: Token): number {
  // Simple hash function to convert token to numeric ID
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function idToToken(id: number, tokenMap: Map<number, Token>): Token | null {
  return tokenMap.get(id) || null;
}

export function getDocsForToken(index: BitmapIndex, token: Token): number[] {
  const bitmap = index.tokenToDocs.get(token);
  return bitmap ? Array.from(bitmap) : [];
}

export function getTokensForDoc(index: BitmapIndex, doc: DocID): number[] {
  const bitmap = index.docToTokens.get(doc);
  return bitmap ? Array.from(bitmap) : [];
}

export function intersectTokenDocs(index: BitmapIndex, tokens: Token[]): number[] {
  if (tokens.length === 0) return [];
  
  const bitmaps = tokens
    .map(token => index.tokenToDocs.get(token))
    .filter(bitmap => bitmap !== undefined) as RoaringBitmap[];
  
  if (bitmaps.length === 0) return [];
  
  let result = bitmaps[0].clone();
  for (let i = 1; i < bitmaps.length; i++) {
    result.andInPlace(bitmaps[i]);
  }
  
  return Array.from(result);
}

export function unionTokenDocs(index: BitmapIndex, tokens: Token[]): number[] {
  if (tokens.length === 0) return [];
  
  const bitmaps = tokens
    .map(token => index.tokenToDocs.get(token))
    .filter(bitmap => bitmap !== undefined) as RoaringBitmap[];
  
  if (bitmaps.length === 0) return [];
  
  let result = bitmaps[0].clone();
  for (let i = 1; i < bitmaps.length; i++) {
    result.orInPlace(bitmaps[i]);
  }
  
  return Array.from(result);
}

export function buildBitmapIndexFromStore(store: any): BitmapIndex {
  const index = createBitmapIndex();
  const tokenMap = new Map<number, Token>();
  
  // Get all unique tokens and their postings
  const tokens = store.db.prepare('SELECT DISTINCT token FROM tokens').all() as {token: string}[];
  
  for (const {token} of tokens) {
    const tokenId = tokenToId(token);
    tokenMap.set(tokenId, token);
    
    const addresses = store.postings(token, 1000000);
    const docs = new Set<number>();
    
    for (const addr of addresses) {
      try {
        const doc = store.addressToDoc(addr);
        docs.add(doc);
        addTokenToDoc(index, token, doc);
      } catch (e) {
        // Skip invalid addresses
        continue;
      }
    }
  }
  
  index.totalDocs = Math.max(...Array.from(index.docToTokens.keys()), -1) + 1;
  return index;
}

export function bitmapStats(index: BitmapIndex): {
  totalTokens: number;
  totalDocs: number;
  avgTokensPerDoc: number;
  avgDocsPerToken: number;
} {
  const totalTokens = index.tokenToDocs.size;
  const totalDocs = index.totalDocs;
  
  const totalTokenDocPairs = Array.from(index.tokenToDocs.values())
    .reduce((sum, bitmap) => sum + bitmap.size, 0);
  
  const avgTokensPerDoc = totalDocs > 0 ? totalTokenDocPairs / totalDocs : 0;
  const avgDocsPerToken = totalTokens > 0 ? totalTokenDocPairs / totalTokens : 0;
  
  return {
    totalTokens,
    totalDocs,
    avgTokensPerDoc,
    avgDocsPerToken
  };
}
