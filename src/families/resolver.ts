import type { IndexEntry } from "../pf2e/adapter.js";
import type { FamilyBundle } from "./bundles.js";

export interface FamilyFilter {
  /** Family bundle if the user picked one. */
  bundle: FamilyBundle | null;
  /** Raw trait list fallback if no bundle was picked. */
  rawTraits: string[];
}

export function makeFilter(bundle: FamilyBundle | null, rawTraits: string[]): FamilyFilter {
  return { bundle, rawTraits: rawTraits.map((t) => t.toLowerCase()) };
}

/** Returns true iff the creature matches the family filter. Empty filter matches everything. */
export function matchesFamily(creature: IndexEntry, filter: FamilyFilter): boolean {
  const traits = creature.traits;

  if (filter.bundle) {
    if (filter.bundle.excludeTraits?.some((t) => traits.includes(t))) return false;
    return filter.bundle.includeTraits.some((t) => traits.includes(t));
  }
  if (filter.rawTraits.length > 0) {
    return filter.rawTraits.some((t) => traits.includes(t));
  }
  return true;
}

/** Boost weight for boosted traits (used to bias selection). */
export function familyWeight(creature: IndexEntry, filter: FamilyFilter): number {
  if (!filter.bundle) return 1;
  const boosted = filter.bundle.boostTraits ?? [];
  return creature.traits.some((t) => boosted.includes(t)) ? 2 : 1;
}

/** True iff the filter is unconstrained (no bundle, no raw traits). */
export function isUnconstrained(filter: FamilyFilter): boolean {
  return !filter.bundle && filter.rawTraits.length === 0;
}
