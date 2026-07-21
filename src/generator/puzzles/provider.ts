import type { PuzzleContent, Rng } from "../../types.js";

export interface PuzzleProvider {
  id: string;
  /** Return a puzzle appropriate for the party level, or null if none available. */
  generate(partyLevel: number, rng: Rng): PuzzleContent | null;
}

/** Standard PF2e DC-by-level table (simplified). */
export function standardDCForLevel(level: number): number {
  const table: Record<number, number> = {
    0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22, 7: 23, 8: 24, 9: 26, 10: 27,
    11: 28, 12: 30, 13: 31, 14: 32, 15: 34, 16: 35, 17: 36, 18: 38, 19: 39, 20: 40,
  };
  return table[Math.max(0, Math.min(20, Math.floor(level)))]!;
}
