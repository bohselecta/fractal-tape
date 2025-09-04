export type GlyphEntry = { phrase: string[]; glyph: string };
const ALPHA = "!#$%()*+,-./:;=?@[]^_{|}~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function asciiPool(prefix = "~", levels = 2): string[] {
  const pool: string[] = [];
  for (let L = 1; L <= levels; L++) {
    const recur = (s: string, d: number) => { if (d === 0) { pool.push(prefix + s); return; } for (let i=0;i<ALPHA.length;i++) recur(s + ALPHA[i], d - 1); };
    recur("", L);
  }
  return pool;
}
export function normalizeWords(s: string){ return s.toLowerCase().replace(/[^a-z0-9\s']/g,' ').split(/\s+/).filter(Boolean); }
export function minePhrases(words: string[], nMin=2, nMax=5){
  type Cand = { phrase: string[]; count: number; chars: number; gain: number };
  const freq = new Map<string, number>();
  for (let n=nMin; n<=nMax; n++){
    for (let i=0;i<=words.length-n;i++){
      const key = words.slice(i,i+n).join('\u0001');
      freq.set(key, (freq.get(key)||0)+1);
    }
  }
  const cands: Cand[] = [];
  freq.forEach((count, key) => {
    const phrase = key.split('\u0001');
    const chars = phrase.reduce((a,w)=>a+w.length,0) + (phrase.length-1);
    const gain = (chars - 3) * count; // conservative
    if (gain > 0) cands.push({ phrase, count, chars, gain });
  });
  cands.sort((a,b)=> b.gain - a.gain || b.phrase.length - a.phrase.length || a.phrase.join(' ').localeCompare(b.phrase.join(' ')));
  return cands;
}
