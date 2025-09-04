/**
 * Text tokenization utilities
 */

/**
 * Normalize and split text into words
 * - Convert to lowercase
 * - Keep only alphanumeric characters and apostrophes
 * - Split on whitespace
 * - Filter out empty strings
 */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
