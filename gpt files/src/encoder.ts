import type { GlyphEntry } from './glyphDict';
export type TrieNode = { kids: Map<string, TrieNode>; glyph?: string };
export function buildTrie(entries: GlyphEntry[]): TrieNode { const root: TrieNode = { kids: new Map() }; for (const e of entries){ let n = root; for (const w of e.phrase){ if (!n.kids.has(w)) n.kids.set(w, { kids: new Map() }); n = n.kids.get(w)!; } n.glyph = e.glyph; } return root; }
export function encodeWithTrie(words: string[], trie: TrieNode): string[] { const out: string[] = []; for (let i=0;i<words.length;){ let n = trie, j = i, last: null | { len:number; glyph:string } = null; while (j<words.length){ const kid = n.kids.get(words[j]); if (!kid) break; n = kid; if (n.glyph) last = { len: j-i+1, glyph: n.glyph }; j++; } if (last){ out.push(last.glyph); i += last.len; } else { out.push(words[i]); i++; } } return out; }
export function minDepthForSlots(n:number){ let D=0, cap=1; while(cap<n){D++; cap*=3;} return D; }
export function toBase3(n:number, D:number){ let s=''; for(let k=D-1;k>=0;k--){const p=Math.trunc(n/(3**k)); s+=(p%3).toString(); n%=3**k;} return s; }
