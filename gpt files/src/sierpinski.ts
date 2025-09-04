export type Vec = { x:number; y:number };
const SQRT3 = Math.sqrt(3);
export const A:Vec={x:0,y:0}, B:Vec={x:1,y:0}, C:Vec={x:.5,y:SQRT3/2};
function midpoint(p:Vec,q:Vec):Vec { return { x:(p.x+q.x)/2, y:(p.y+q.y)/2 }; }
function centroid(p:Vec,q:Vec,r:Vec):Vec { return { x:(p.x+q.x+r.x)/3, y:(p.y+q.y+r.y)/3 }; }
export function addressToPoint(code:string):Vec{ let pA=A, pB=B, pC=C; for (const ch of code){ const ab=midpoint(pA,pB), bc=midpoint(pB,pC), ca=midpoint(pC,pA); if (ch==='0'){ pB=ab; pC=ca; } else if (ch==='1'){ pA=ab; pC=bc; } else { pA=ca; pB=bc; } } return centroid(pA,pB,pC); }
