import Database from 'better-sqlite3';
import type { Address, DocID, Token } from './types.js';
export interface TapeStore{
  putToken(addr:Address,token:Token):void; addPosting(token:Token,addr:Address):void;
  addDocBounds(doc:DocID,start:Address,end:Address):void;
  postings(token:Token,limit?:number):Address[];
  addressToDoc(addr:Address):DocID; addressesToDocs(addrs:Address[]):DocID[];
  tokenAt(addr:Address):Token|null; tokensInRange(start:Address,end:Address):Token[];
  count():number; close():void; db:Database.Database;
  
  // Batched operations
  batchTokens(entries: Array<[Address, Token]>):void;
  batchPostings(entries: Array<[Token, Address]>):void;
  batchGlyphs(entries: Array<[string, string]>):void;
}
export function openStore(path='tape.db'):TapeStore{
  const db=new Database(path); db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS tokens(addr INTEGER PRIMARY KEY, token TEXT);
           CREATE TABLE IF NOT EXISTS postings(token TEXT, addr INTEGER);
           CREATE INDEX IF NOT EXISTS idx_postings ON postings(token, addr);
           CREATE TABLE IF NOT EXISTS doc_bounds(doc INTEGER PRIMARY KEY, start INTEGER, end INTEGER);
           CREATE TABLE IF NOT EXISTS glyph_dict(glyph TEXT PRIMARY KEY, phrase TEXT);`);
  
  // Prepared statements for single operations
  const put=db.prepare('INSERT OR REPLACE INTO tokens(addr,token) VALUES(?,?)');
  const addP=db.prepare('INSERT INTO postings(token,addr) VALUES(?,?)');
  const addD=db.prepare('INSERT OR REPLACE INTO doc_bounds(doc,start,end) VALUES(?,?,?)');
  
  // Prepared statements for batched operations
  const batchTokens=db.prepare('INSERT OR REPLACE INTO tokens(addr,token) VALUES(?,?)');
  const batchPostings=db.prepare('INSERT INTO postings(token,addr) VALUES(?,?)');
  const batchGlyphs=db.prepare('INSERT OR REPLACE INTO glyph_dict(glyph, phrase) VALUES(?, ?)');
  
  // Query statements
  const qP=db.prepare('SELECT addr FROM postings WHERE token=? ORDER BY addr ASC LIMIT ?');
  const qB=db.prepare('SELECT doc FROM doc_bounds WHERE start <= ? AND end > ? LIMIT 1');
  const qT=db.prepare('SELECT token FROM tokens WHERE addr = ?');
  const qR=db.prepare('SELECT token FROM tokens WHERE addr >= ? AND addr < ? ORDER BY addr ASC');
  const qC=db.prepare('SELECT COUNT(*) as c FROM tokens');
  
  return { db,
    putToken(a,t){put.run(a,t);}, 
    addPosting(t,a){addP.run(t,a);}, 
    addDocBounds(d,s,e){addD.run(d,s,e);},
    postings(t,l=1_000_000){return qP.all(t,l).map((r: any)=>r.addr as number);},
    addressToDoc(a){const r=qB.get(a,a) as {doc:number}|undefined; if(!r) throw new Error('oob'); return r.doc;},
    addressesToDocs(as){const ds=new Set<number>(); for(const a of as){const r=qB.get(a,a) as {doc:number}|undefined; if(r) ds.add(r.doc);} return Array.from(ds).sort((x,y)=>x-y);},
    tokenAt(a){const r=qT.get(a) as {token:string}|undefined; return r?.token ?? null;},
    tokensInRange(s,e){return qR.all(s,e).map((r: any)=>r.token as string);},
    count(){const r=qC.get() as {c:number}; return r.c;},
    close(){db.close();},
    
    // Batched operations
    batchTokens: (entries: Array<[Address, Token]>) => {
      const transaction = db.transaction(() => {
        for(const [addr, token] of entries) {
          batchTokens.run(addr, token);
        }
      });
      transaction();
    },
    batchPostings: (entries: Array<[Token, Address]>) => {
      const transaction = db.transaction(() => {
        for(const [token, addr] of entries) {
          batchPostings.run(token, addr);
        }
      });
      transaction();
    },
    batchGlyphs: (entries: Array<[string, string]>) => {
      const transaction = db.transaction(() => {
        for(const [glyph, phrase] of entries) {
          batchGlyphs.run(glyph, phrase);
        }
      });
      transaction();
    }
  };
}