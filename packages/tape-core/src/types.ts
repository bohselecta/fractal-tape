export type Address = number;
export type DocID = number;
export type Token = string;

// GlyphEntry moved to trainer.ts to include gain field
export interface IngestStats { docs:number; tokensPre:number; tokensPost:number; uniqueTokens:number; depthD:number; }