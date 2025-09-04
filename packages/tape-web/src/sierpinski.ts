export type Vec = { x:number; y:number };
const SQRT3 = Math.sqrt(3);
export const A:Vec={x:0,y:0}, B:Vec={x:1,y:0}, C:Vec={x:.5,y:SQRT3/2};

function midpoint(p:Vec,q:Vec):Vec { return { x:(p.x+q.x)/2, y:(p.y+q.y)/2 }; }
function centroid(p:Vec,q:Vec,r:Vec):Vec { return { x:(p.x+q.x+r.x)/3, y:(p.y+q.y+r.y)/3 }; }

export function addressToPoint(code:string):Vec{
  let pA=A, pB=B, pC=C;
  for (const ch of code){
    const ab=midpoint(pA,pB), bc=midpoint(pB,pC), ca=midpoint(pC,pA);
    if (ch==='0'){ pB=ab; pC=ca; }
    else if (ch==='1'){ pA=ab; pC=bc; }
    else { pA=ca; pB=bc; }
  }
  return centroid(pA,pB,pC);
}

export function pointInTri(p: Vec, a: Vec, b: Vec, c: Vec): boolean {
  const v0 = { x: c.x - a.x, y: c.y - a.y };
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: p.x - a.x, y: p.y - a.y };

  const dot00 = v0.x*v0.x + v0.y*v0.y;
  const dot01 = v0.x*v1.x + v0.y*v1.y;
  const dot02 = v0.x*v2.x + v0.y*v2.y;
  const dot11 = v1.x*v1.x + v1.y*v1.y;
  const dot12 = v1.x*v2.x + v1.y*v2.y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return (u >= 0) && (v >= 0) && (u + v <= 1);
}

export function pointToAddress(p: Vec, D: number): string {
  let a = A, b = B, c = C;
  let code = '';
  for (let i = 0; i < D; i++) {
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);

    // Match addressToPoint rules:
    // '0' => keep (a,ab,ca)
    // '1' => keep (ab,b,bc)
    // '2' => keep (ca,bc,c)
    if (pointInTri(p, a, ab, ca)) {
      code += '0'; b = ab; c = ca;
    } else if (pointInTri(p, ab, b, bc)) {
      code += '1'; a = ab; c = bc;
    } else {
      code += '2'; a = ca; b = bc;
    }
  }
  return code;
}
