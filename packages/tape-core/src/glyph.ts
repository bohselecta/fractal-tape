export interface TrieNode{kids:Map<string,TrieNode>;glyph?:string}
export function buildTrie(entries:{phrase:string[],glyph:string}[]):TrieNode{
  const root:TrieNode={kids:new Map()};
  for(const e of entries){let n=root; for(const w of e.phrase){ if(!n.kids.has(w)) n.kids.set(w,{kids:new Map()}); n=n.kids.get(w)!; } n.glyph=e.glyph; }
  return root;
}
export function encodeWithTrie(words:string[],trie:TrieNode){const out:string[]=[]; for(let i=0;i<words.length;){let n=trie,j=i,last:null|{len:number,glyph:string}=null; while(j<words.length){const k=n.kids.get(words[j]); if(!k) break; n=k; if(n.glyph) last={len:j-i+1,glyph:n.glyph}; j++; } if(last){out.push(last.glyph); i+=last.len;} else {out.push(words[i]); i++;}} return out;}
export const DEFAULT_GLYPHS=[
  {phrase:["i'm","going","to"],glyph:"^%>"},{phrase:["and","then"],glyph:"€€<"},
  {phrase:["until","it","is","finished"],glyph:"⊕"},{phrase:["after","that"],glyph:"↻"},
  {phrase:["a","bit"],glyph:"≈"},{phrase:["because"],glyph:"∵"},{phrase:["in","order","to"],glyph:"⇒"}
];