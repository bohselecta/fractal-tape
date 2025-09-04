/**
 * Base-3 path operations for Fractal Grammar Tape
 */

export type Path = string; // Base-3 string like "021", "1201", etc.

/**
 * Convert number to base-3 string
 * @param n - Number to convert
 * @param minLength - Minimum length (pad with leading zeros)
 * @returns Base-3 string
 */
export function toBase3(n: number, minLength: number = 1): Path {
  if (n === 0) return '0'.repeat(minLength);
  
  let result = '';
  while (n > 0) {
    result = (n % 3).toString() + result;
    n = Math.floor(n / 3);
  }
  
  // Pad with leading zeros
  while (result.length < minLength) {
    result = '0' + result;
  }
  
  return result;
}

/**
 * Convert base-3 string to number
 * @param path - Base-3 string
 * @returns Number
 */
export function fromBase3(path: Path): number {
  let result = 0;
  for (let i = 0; i < path.length; i++) {
    const digit = parseInt(path[i], 3);
    result = result * 3 + digit;
  }
  return result;
}

/**
 * Get next available path at given depth
 * @param usedPaths - Set of already used paths
 * @param depth - Target depth
 * @returns Next available path
 */
export function nextPath(usedPaths: Set<Path>, depth: number): Path {
  let candidate = toBase3(0, depth);
  let counter = 0;
  
  while (usedPaths.has(candidate)) {
    counter++;
    candidate = toBase3(counter, depth);
    
    // Prevent infinite loop (shouldn't happen in practice)
    if (counter > Math.pow(3, depth)) {
      throw new Error(`No available paths at depth ${depth}`);
    }
  }
  
  return candidate;
}

/**
 * Get next available path at any depth (starts with depth 1)
 * @param usedPaths - Set of already used paths
 * @returns Next available path
 */
export function nextAvailablePath(usedPaths: Set<Path>): Path {
  let depth = 1;
  let candidate = nextPath(usedPaths, depth);
  
  // If we've used up all paths at this depth, try next depth
  while (usedPaths.has(candidate)) {
    depth++;
    candidate = nextPath(usedPaths, depth);
  }
  
  return candidate;
}

/**
 * Check if path is valid base-3
 * @param path - Path to validate
 * @returns True if valid
 */
export function isValidPath(path: Path): boolean {
  return /^[012]+$/.test(path);
}

/**
 * Get depth of a path
 * @param path - Base-3 path
 * @returns Depth (length)
 */
export function getDepth(path: Path): number {
  return path.length;
}

/**
 * Get parent path (one level up)
 * @param path - Base-3 path
 * @returns Parent path or null if at root
 */
export function getParent(path: Path): Path | null {
  if (path.length <= 1) return null;
  return path.slice(0, -1);
}

/**
 * Get all ancestor paths
 * @param path - Base-3 path
 * @returns Array of ancestor paths (including self)
 */
export function getAncestors(path: Path): Path[] {
  const ancestors: Path[] = [];
  let current = path;
  
  while (current.length > 0) {
    ancestors.unshift(current);
    current = current.slice(0, -1);
  }
  
  return ancestors;
}

/**
 * Check if one path is ancestor of another
 * @param ancestor - Potential ancestor
 * @param descendant - Potential descendant
 * @returns True if ancestor is ancestor of descendant
 */
export function isAncestor(ancestor: Path, descendant: Path): boolean {
  return descendant.startsWith(ancestor) && ancestor.length < descendant.length;
}

/**
 * Get children of a path
 * @param path - Base-3 path
 * @param usedPaths - Set of used paths
 * @returns Array of child paths
 */
export function getChildren(path: Path, usedPaths: Set<Path>): Path[] {
  const children: Path[] = [];
  
  for (const child of usedPaths) {
    if (isAncestor(path, child) && child.length === path.length + 1) {
      children.push(child);
    }
  }
  
  return children.sort();
}

/**
 * Encode path as varint (for compact storage)
 * @param path - Base-3 path
 * @returns Uint8Array of varint-encoded path
 */
export function encodePath(path: Path): Uint8Array {
  let num = fromBase3(path);
  const bytes: number[] = [];
  
  while (num > 0) {
    let byte = num & 0x7F;
    num >>>= 7;
    if (num > 0) byte |= 0x80;
    bytes.push(byte);
  }
  
  return new Uint8Array(bytes);
}

/**
 * Decode varint to path
 * @param data - Varint-encoded data
 * @returns Base-3 path
 */
export function decodePath(data: Uint8Array): Path {
  let num = 0;
  let shift = 0;
  
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    num |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  
  return toBase3(num);
}

/**
 * Convert path to Sierpinski triangle coordinates
 * @param path - Base-3 path
 * @returns {x, y} coordinates in [0,1] range
 */
export function pathToCoords(path: Path): { x: number; y: number } {
  const SQRT3 = Math.sqrt(3);
  const A = { x: 0, y: 0 };
  const B = { x: 1, y: 0 };
  const C = { x: 0.5, y: SQRT3 / 2 };
  
  let pA = A, pB = B, pC = C;
  
  for (const digit of path) {
    const ab = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
    const bc = { x: (pB.x + pC.x) / 2, y: (pB.y + pC.y) / 2 };
    const ca = { x: (pC.x + pA.x) / 2, y: (pC.y + pA.y) / 2 };
    
    if (digit === '0') {
      pB = ab;
      pC = ca;
    } else if (digit === '1') {
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
