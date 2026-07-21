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
  /**
   * Maximum creature tile size that will fit in the target room, accounting
   * for a 1-tile wall buffer. When provided, creatures larger than this are
   * filtered out (or all, if the pool would be empty).
   */
  maxCreatureTiles?: number;
  /**
   * Maximum total floor area (in tiles) available for creatures. The
   * encounter builder ensures the sum of each picked creature's footprint
   * (sizeTiles²) does not exceed this, so the room can physically hold
   * everything without overlap.
   */
  maxFloorTiles?: number;
}

function candidatesInLevelRange(
  partyLevel: number,
  minDiff: number,
  maxDiff: number,
  filter: FamilyFilter,
  strictFamily: boolean,
  maxCreatureTiles: number | undefined,
): IndexEntry[] {
  const all = getCreatures();
  return all.filter((c) => {
    // Safety: refuse anything that isn't an actor-type creature. Hazards
    // must never be picked as encounter monsters — they'd render as always-
    // visible hostile tokens instead of hidden hazards.
    const kind = String(c.kind).toLowerCase();
    if (kind && kind !== "npc" && kind !== "character") return false;
    if (c.rarity === "unique") return false;
    const diff = c.level - partyLevel;
    if (diff < minDiff || diff > maxDiff) return false;
    if (strictFamily && !matchesFamily(c, filter)) return false;
    if (maxCreatureTiles !== undefined && c.sizeTiles > maxCreatureTiles) return false;
    return true;
  });
}

export function buildEncounter(opts: EncounterOptions): EncounterContent {
  const { threat, partyLevel, partySize, filter, rng } = opts;
  const strictFamily = opts.strictFamily ?? true;
  const maxTiles = opts.maxCreatureTiles;
  const maxFloor = opts.maxFloorTiles;
  const budget = encounterBudget(threat, partySize);

  // Track total footprint so we don't pack more creatures than the room can hold.
  let footprintUsed = 0;
  const footprintFits = (size: number): boolean => {
    if (maxFloor === undefined) return true;
    return footprintUsed + size * size <= maxFloor;
  };

  const anchorProfile = THREAT_ANCHOR_PROFILE[threat];
  let anchorPool = candidatesInLevelRange(
    partyLevel,
    anchorProfile.minDiff,
    anchorProfile.maxDiff,
    filter,
    strictFamily,
    maxTiles,
  );
  if (anchorPool.length === 0 && strictFamily) {
    anchorPool = candidatesInLevelRange(
      partyLevel,
      anchorProfile.minDiff,
      anchorProfile.maxDiff,
      filter,
      false,
      maxTiles,
    );
  }
  if (anchorPool.length === 0 && maxTiles !== undefined) {
    anchorPool = candidatesInLevelRange(
      partyLevel,
      anchorProfile.minDiff,
      anchorProfile.maxDiff,
      filter,
      false,
      undefined,
    );
  }

  const creatures: EncounterCreatureSlot[] = [];
  let xpSpent = 0;

  if (anchorPool.length > 0) {
    const usable = anchorPool
      .map((c) => ({ c, xp: creatureXp(c.level, partyLevel), weight: familyWeight(c, filter) }))
      .filter((c) => c.xp !== null && c.xp <= budget && footprintFits(c.c.sizeTiles)) as Array<{
        c: IndexEntry;
        xp: number;
        weight: number;
      }>;
    if (usable.length > 0) {
      const anchor = rng.weighted(usable.map((u) => ({ value: u, weight: u.weight })));
      creatures.push({ uuid: anchor.c.uuid, name: anchor.c.name, level: anchor.c.level, xp: anchor.xp, sizeTiles: anchor.c.sizeTiles });
      xpSpent += anchor.xp;
      footprintUsed += anchor.c.sizeTiles * anchor.c.sizeTiles;
    }
  }

  let safety = 20;
  while (xpSpent < budget && safety-- > 0) {
    const remaining = budget - xpSpent;
    let minionPool = candidatesInLevelRange(partyLevel, -4, 2, filter, strictFamily, maxTiles);
    if (minionPool.length === 0) {
      minionPool = candidatesInLevelRange(partyLevel, -4, 2, filter, false, maxTiles);
    }
    const affordable = minionPool
      .map((c) => ({ c, xp: creatureXp(c.level, partyLevel), weight: familyWeight(c, filter) }))
      .filter(
        (c) => c.xp !== null && c.xp <= remaining && footprintFits(c.c.sizeTiles),
      ) as Array<{ c: IndexEntry; xp: number; weight: number }>;
    if (affordable.length === 0) break;
    const pick = rng.weighted(affordable.map((a) => ({ value: a, weight: a.weight })));
    creatures.push({ uuid: pick.c.uuid, name: pick.c.name, level: pick.c.level, xp: pick.xp, sizeTiles: pick.c.sizeTiles });
    xpSpent += pick.xp;
    footprintUsed += pick.c.sizeTiles * pick.c.sizeTiles;
    if (creatures.length >= 10) break;
  }

  return {
    threat,
    xpBudget: budget,
    xpSpent,
    creatures,
  };
}
