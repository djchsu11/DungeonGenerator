/**
 * Encounter builder: pack an XP budget with creatures matching the family filter.
 *
 * Strategy: greedy heaviest-first — pick 1 "anchor" creature within budget, then
 * fill remainder with minions until budget is exhausted or no valid pick remains.
 */
import type { EncounterContent, EncounterCreatureSlot, Rng, Threat } from "../types.js";
import type { IndexEntry } from "../pf2e/adapter.js";
import { getCreatures } from "../pf2e/adapter.js";
import { creatureXp, encounterBudget } from "../pf2e/encounters.js";
import { familyWeight, matchesFamily, type FamilyFilter } from "../families/resolver.js";

const THREAT_ANCHOR_PROFILE: Record<Threat, { minDiff: number; maxDiff: number }> = {
  trivial: { minDiff: -4, maxDiff: -1 },
  low: { minDiff: -2, maxDiff: 1 },
  moderate: { minDiff: -1, maxDiff: 2 },
  severe: { minDiff: 0, maxDiff: 3 },
  extreme: { minDiff: 1, maxDiff: 4 },
};

export interface EncounterOptions {
  threat: Threat;
  partyLevel: number;
  partySize: number;
  filter: FamilyFilter;
  rng: Rng;
  /** If false, ignore family filter (safety net when pool is empty). */
  strictFamily?: boolean;
}

function candidatesInLevelRange(
  partyLevel: number,
  minDiff: number,
  maxDiff: number,
  filter: FamilyFilter,
  strictFamily: boolean,
): IndexEntry[] {
  const all = getCreatures();
  return all.filter((c) => {
    if (c.rarity === "unique") return false;
    const diff = c.level - partyLevel;
    if (diff < minDiff || diff > maxDiff) return false;
    if (strictFamily && !matchesFamily(c, filter)) return false;
    return true;
  });
}

export function buildEncounter(opts: EncounterOptions): EncounterContent {
  const { threat, partyLevel, partySize, filter, rng } = opts;
  const strictFamily = opts.strictFamily ?? true;
  const budget = encounterBudget(threat, partySize);

  const anchorProfile = THREAT_ANCHOR_PROFILE[threat];
  let anchorPool = candidatesInLevelRange(
    partyLevel,
    anchorProfile.minDiff,
    anchorProfile.maxDiff,
    filter,
    strictFamily,
  );
  if (anchorPool.length === 0 && strictFamily) {
    anchorPool = candidatesInLevelRange(
      partyLevel,
      anchorProfile.minDiff,
      anchorProfile.maxDiff,
      filter,
      false,
    );
  }

  const creatures: EncounterCreatureSlot[] = [];
  let xpSpent = 0;

  if (anchorPool.length > 0) {
    const usable = anchorPool
      .map((c) => ({ c, xp: creatureXp(c.level, partyLevel), weight: familyWeight(c, filter) }))
      .filter((c) => c.xp !== null && c.xp <= budget) as Array<{ c: IndexEntry; xp: number; weight: number }>;
    if (usable.length > 0) {
      const anchor = rng.weighted(usable.map((u) => ({ value: u, weight: u.weight })));
      creatures.push({ uuid: anchor.c.uuid, name: anchor.c.name, level: anchor.c.level, xp: anchor.xp });
      xpSpent += anchor.xp;
    }
  }

  let safety = 20;
  while (xpSpent < budget && safety-- > 0) {
    const remaining = budget - xpSpent;
    let minionPool = candidatesInLevelRange(partyLevel, -4, 2, filter, strictFamily);
    if (minionPool.length === 0) minionPool = candidatesInLevelRange(partyLevel, -4, 2, filter, false);
    const affordable = minionPool
      .map((c) => ({ c, xp: creatureXp(c.level, partyLevel), weight: familyWeight(c, filter) }))
      .filter((c) => c.xp !== null && c.xp <= remaining) as Array<{ c: IndexEntry; xp: number; weight: number }>;
    if (affordable.length === 0) break;
    const pick = rng.weighted(affordable.map((a) => ({ value: a, weight: a.weight })));
    creatures.push({ uuid: pick.c.uuid, name: pick.c.name, level: pick.c.level, xp: pick.xp });
    xpSpent += pick.xp;
    if (creatures.length >= 10) break;
  }

  return {
    threat,
    xpBudget: budget,
    xpSpent,
    creatures,
  };
}
