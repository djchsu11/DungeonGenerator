/**
 * PF2e encounter budgeting.
 *
 * Reference: PF2e Core Rulebook / GM Core, "Building Encounters".
 * XP budgets (for a party of 4): trivial 40, low 60, moderate 80, severe 120, extreme 160.
 * Per-additional-character adjustment: +/-10 (trivial), +/-15 (low), +/-20 (moderate),
 * +/-30 (severe), +/-40 (extreme).
 * Per-creature XP cost by level relative to party level:
 *   -4=10, -3=15, -2=20, -1=30, 0=40, +1=60, +2=80, +3=120, +4=160
 */
import type { Threat } from "../types.js";

const BASE_BUDGETS: Record<Threat, number> = {
  trivial: 40,
  low: 60,
  moderate: 80,
  severe: 120,
  extreme: 160,
};

const PER_EXTRA_PC: Record<Threat, number> = {
  trivial: 10,
  low: 15,
  moderate: 20,
  severe: 30,
  extreme: 40,
};

const CREATURE_XP_BY_LEVEL_DIFF: Record<number, number> = {
  [-4]: 10,
  [-3]: 15,
  [-2]: 20,
  [-1]: 30,
  0: 40,
  1: 60,
  2: 80,
  3: 120,
  4: 160,
};

export function encounterBudget(threat: Threat, partySize: number): number {
  const extras = partySize - 4;
  return BASE_BUDGETS[threat] + extras * PER_EXTRA_PC[threat];
}

/**
 * XP cost of a single creature vs the party.
 * Returns null if the creature is outside the party-level ±4 window
 * (in which case it's not a valid encounter component).
 */
export function creatureXp(creatureLevel: number, partyLevel: number): number | null {
  const diff = creatureLevel - partyLevel;
  if (diff < -4 || diff > 4) return null;
  return CREATURE_XP_BY_LEVEL_DIFF[diff]!;
}

/** Minimum XP cost of any usable creature (party level -4 = 10 XP). */
export const MIN_CREATURE_XP = 10;
