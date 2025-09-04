import { toBase3 } from './path.js';

// ===== Address Math Utilities =====
export function base3ToAddr(base3: string): number {
  let addr = 0;
  for (let i = 0; i < base3.length; i++) {
    const digit = parseInt(base3[i], 3);
    addr = addr * 3 + digit;
  }
  return addr;
}

export function addrToBase3(addr: number, D: number): string {
  return toBase3(addr, D);
}

// Sierpinski triangle geometry constants
export const SQRT3 = Math.sqrt(3);
export const TRIANGLE_VERTICES = {
  A: { x: 0, y: 0 },
  B: { x: 1, y: 0 },
  C: { x: 0.5, y: SQRT3 / 2 }
};

export interface Point2D {
  x: number;
  y: number;
}

export function midpoint(p: Point2D, q: Point2D): Point2D {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

export function centroid(p: Point2D, q: Point2D, r: Point2D): Point2D {
  return { x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 };
}

export function addressToPoint(base3: string): Point2D {
  let pA = TRIANGLE_VERTICES.A;
  let pB = TRIANGLE_VERTICES.B;
  let pC = TRIANGLE_VERTICES.C;
  
  for (const ch of base3) {
    const ab = midpoint(pA, pB);
    const bc = midpoint(pB, pC);
    const ca = midpoint(pC, pA);
    
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
  
  return centroid(pA, pB, pC);
}

export function pointToAddress(point: Point2D, D: number): string {
  // Convert point back to base3 address (approximation)
  // This is a simplified implementation - could be enhanced for precision
  let base3 = '';
  let pA = TRIANGLE_VERTICES.A;
  let pB = TRIANGLE_VERTICES.B;
  let pC = TRIANGLE_VERTICES.C;
  
  for (let i = 0; i < D; i++) {
    const ab = midpoint(pA, pB);
    const bc = midpoint(pB, pC);
    const ca = midpoint(pC, pA);
    
    // Determine which sub-triangle contains the point
    const centroid0 = centroid(ab, pC, ca);
    const centroid1 = centroid(ab, bc, pC);
    const centroid2 = centroid(ca, ab, bc);
    
    const dist0 = Math.sqrt((point.x - centroid0.x) ** 2 + (point.y - centroid0.y) ** 2);
    const dist1 = Math.sqrt((point.x - centroid1.x) ** 2 + (point.y - centroid1.y) ** 2);
    const dist2 = Math.sqrt((point.x - centroid2.x) ** 2 + (point.y - centroid2.y) ** 2);
    
    if (dist0 <= dist1 && dist0 <= dist2) {
      base3 += '0';
      pB = ab;
      pC = ca;
    } else if (dist1 <= dist2) {
      base3 += '1';
      pA = ab;
      pC = bc;
    } else {
      base3 += '2';
      pA = ca;
      pB = bc;
    }
  }
  
  return base3;
}

export function normalizeWords(s:string){return s.toLowerCase().replace(/[^a-z0-9\s']/g,' ').split(/\s+/).filter(Boolean);}

// ===== Query Windowing Utilities =====
export interface AddressSpan {
  start: number;
  end: number;
  count: number;
  doc?: number;
}

export function packAddressesIntoSpans(addresses: number[], maxGap: number): AddressSpan[] {
  if (addresses.length === 0) return [];
  
  const spans: AddressSpan[] = [];
  let currentStart = addresses[0];
  let currentEnd = addresses[0];
  let currentCount = 1;
  
  for (let i = 1; i < addresses.length; i++) {
    const addr = addresses[i];
    if (addr - currentEnd <= maxGap) {
      currentEnd = addr;
      currentCount++;
    } else {
      spans.push({ start: currentStart, end: currentEnd, count: currentCount });
      currentStart = addr;
      currentEnd = addr;
      currentCount = 1;
    }
  }
  
  spans.push({ start: currentStart, end: currentEnd, count: currentCount });
  return spans;
}

export function findMinMaxSpans(addresses: number[], minSpan: number, maxGap: number): AddressSpan[] {
  const spans = packAddressesIntoSpans(addresses, maxGap);
  return spans.filter(span => span.count >= minSpan);
}

export function mergeOverlappingSpans(spans: AddressSpan[], overlapThreshold: number = 0): AddressSpan[] {
  if (spans.length === 0) return [];
  
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: AddressSpan[] = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const gap = next.start - current.end;
    
    if (gap <= overlapThreshold) {
      // Merge spans
      current.end = Math.max(current.end, next.end);
      current.count += next.count;
    } else {
      // Start new span
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged;
}