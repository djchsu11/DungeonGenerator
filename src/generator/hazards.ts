/**
 * Hazard picker for hazard rooms.
 * Prefers hazards matching the archetype's hazardTraits, falls back to any level-appropriate hazard.
 */
import type { ArchetypeDef } from "../archetypes/index.js";
import { getHazards, type IndexEntry } from "../pf2e/adapter.js";
import type { HazardContent, Rng } from "../types.js";

export function pickHazard(
  partyLevel: number,
  archetype: ArchetypeDef,
  rng: Rng,
): HazardContent | null {
  const all = getHazards().filter((h) => !h.traits.includes("puzzle"));
  const inRange = all.filter((h) => Math.abs(h.level - partyLevel) <= 2 && h.rarity !== "unique");
  if (inRange.length === 0) return null;

  const wanted = archetype.hazardTraits;
  const thematic = inRange.filter((h) => h.traits.some((t) => wanted.includes(t)));
  const pool: IndexEntry[] = thematic.length > 0 ? thematic : inRange;
  const h = rng.pick(pool);
  return { uuid: h.uuid, name: h.name, level: h.level };
}
