export type Address = number;
export type DocID = number;
export type Token = string;

export interface GlyphEntry { phrase: string[]; glyph: string; }
export interface IngestStats { docs:number; tokensPre:number; tokensPost:number; uniqueTokens:number; depthD:number; }