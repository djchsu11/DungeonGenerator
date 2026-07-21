/**
 * PF2e Treasure by Level (GMG Table 10-9).
 *
 * For a party of 4 progressing one level. We scale by party size and dungeon
 * "fraction of level" (based on encounter count) elsewhere.
 *
 * Each entry: permanent items (level relative to party), consumables, currency (gp),
 * plus lower-value gear approximated as extra gp for simplicity.
 */

export interface LevelTreasureSlots {
  /** Permanent items: level offset from party level → count. */
  permanent: Record<number, number>;
  /** Consumables: level offset from party level → count. */
  consumables: Record<number, number>;
  /** Currency in gp (includes "lesser items" bucket collapsed into gp). */
  gp: number;
  /** Total budget in gp (rough) — used for scaling. */
  totalGp: number;
}

/**
 * Simplified per-level treasure table.
 * Values approximate the published PF2e table; exact values are re-derived at
 * runtime from `game.pf2e.TreasureRollTable` when available.
 */
export const TREASURE_BY_LEVEL: Record<number, LevelTreasureSlots> = {
  1: { permanent: { 1: 2, 0: 2 }, consumables: { 1: 2, 0: 2 }, gp: 40, totalGp: 175 },
  2: { permanent: { 2: 2, 1: 2 }, consumables: { 2: 2, 1: 2 }, gp: 70, totalGp: 300 },
  3: { permanent: { 3: 2, 2: 2 }, consumables: { 3: 2, 2: 2 }, gp: 120, totalGp: 500 },
  4: { permanent: { 4: 2, 3: 2 }, consumables: { 4: 2, 3: 2 }, gp: 200, totalGp: 850 },
  5: { permanent: { 5: 2, 4: 2 }, consumables: { 5: 2, 4: 2 }, gp: 320, totalGp: 1350 },
  6: { permanent: { 6: 2, 5: 2 }, consumables: { 6: 2, 5: 2 }, gp: 500, totalGp: 2000 },
  7: { permanent: { 7: 2, 6: 2 }, consumables: { 7: 2, 6: 2 }, gp: 720, totalGp: 2900 },
  8: { permanent: { 8: 2, 7: 2 }, consumables: { 8: 2, 7: 2 }, gp: 1000, totalGp: 4000 },
  9: { permanent: { 9: 2, 8: 2 }, consumables: { 9: 2, 8: 2 }, gp: 1400, totalGp: 5700 },
  10: { permanent: { 10: 2, 9: 2 }, consumables: { 10: 2, 9: 2 }, gp: 2000, totalGp: 8000 },
  11: { permanent: { 11: 2, 10: 2 }, consumables: { 11: 2, 10: 2 }, gp: 2800, totalGp: 11500 },
  12: { permanent: { 12: 2, 11: 2 }, consumables: { 12: 2, 11: 2 }, gp: 4000, totalGp: 16500 },
  13: { permanent: { 13: 2, 12: 2 }, consumables: { 13: 2, 12: 2 }, gp: 5700, totalGp: 25000 },
  14: { permanent: { 14: 2, 13: 2 }, consumables: { 14: 2, 13: 2 }, gp: 8000, totalGp: 36500 },
  15: { permanent: { 15: 2, 14: 2 }, consumables: { 15: 2, 14: 2 }, gp: 12000, totalGp: 54500 },
  16: { permanent: { 16: 2, 15: 2 }, consumables: { 16: 2, 15: 2 }, gp: 17000, totalGp: 82500 },
  17: { permanent: { 17: 2, 16: 2 }, consumables: { 17: 2, 16: 2 }, gp: 25000, totalGp: 128000 },
  18: { permanent: { 18: 2, 17: 2 }, consumables: { 18: 2, 17: 2 }, gp: 36000, totalGp: 208000 },
  19: { permanent: { 19: 2, 18: 2 }, consumables: { 19: 2, 18: 2 }, gp: 55000, totalGp: 355000 },
  20: { permanent: { 20: 2, 19: 2 }, consumables: { 20: 2, 19: 2 }, gp: 80000, totalGp: 490000 },
};

export function slotsForPartyLevel(level: number): LevelTreasureSlots {
  const clamped = Math.max(1, Math.min(20, Math.floor(level)));
  return TREASURE_BY_LEVEL[clamped]!;
}
