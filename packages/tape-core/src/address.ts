/**
 * Sierpinski triangle address mathematics
 */

/**
 * Calculate minimum depth for given number of slots
 * @param n - Number of slots needed
 * @returns Minimum depth D where 3^D >= n
 */
export function minDepthForSlots(n: number): number {
  let D = 0;
  let cap = 1;
  while (cap < n) {
    D++;
    cap *= 3;
  }
  return D;
}

// toBase3 moved to path.ts to avoid conflicts

/**
 * Convert base-3 address to 2D point in Sierpinski triangle
 * @param base3 - Base-3 address string
 * @returns Point coordinates {x, y}
 */
export function addrPoint(base3: string): { x: number; y: number } {
  const SQRT3 = Math.sqrt(3);
  const A = { x: 0, y: 0 };
  const B = { x: 1, y: 0 };
  const C = { x: 0.5, y: SQRT3 / 2 };
  
  let pA = A, pB = B, pC = C;
  
  for (const ch of base3) {
    const ab = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
    const bc = { x: (pB.x + pC.x) / 2, y: (pB.y + pC.y) / 2 };
    const ca = { x: (pC.x + pA.x) / 2, y: (pC.y + pA.y) / 2 };
    
    if (ch === '0') {
      pB = ab;
      pC = ca;
    } else if (ch === '1') {
      pA = ab;
      pC = bc;
    } else {
      pA = ca;
      pB = bc;
    }
  }
  
  // Return centroid of final triangle
  return {
    x: (pA.x + pB.x + pC.x) / 3,
    y: (pA.y + pB.y + pC.y) / 3
  };
}
