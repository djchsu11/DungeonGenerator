/**
 * Dungeon loot budgeter.
 *
 * Given party level, encounter count, and generosity, produce a list of loot
 * "hoards" to distribute across rooms:
 *   ~60% permanent items → treasure vaults (loot rooms)
 *   ~40% consumables + gp → split between boss and combat encounters
 */
import type { IndexEntry } from "../pf2e/adapter.js";
import { getItems } from "../pf2e/adapter.js";
import { slotsForPartyLevel, type LevelTreasureSlots } from "../pf2e/loot.js";
import type { LootContent, LootGenerosity, LootItem, Rng } from "../types.js";

const GENEROSITY_MULT: Record<LootGenerosity, number> = {
  stingy: 0.65,
  standard: 1.0,
  generous: 1.4,
};

/** Compute how much of a "level's worth" of treasure to award this dungeon. */
export function dungeonFractionOfLevel(encounterCount: number, generosity: LootGenerosity): number {
  const referenceEncountersPerLevel = 8;
  const raw = encounterCount / referenceEncountersPerLevel;
  return Math.min(1.2, Math.max(0.2, raw)) * GENEROSITY_MULT[generosity];
}

export function scaledSlotsForDungeon(
  partyLevel: number,
  encounterCount: number,
  generosity: LootGenerosity,
): LevelTreasureSlots {
  const base = slotsForPartyLevel(partyLevel);
  const f = dungeonFractionOfLevel(encounterCount, generosity);
  const scale = (rec: Record<number, number>): Record<number, number> =>
    Object.fromEntries(
      Object.entries(rec).map(([k, v]) => [k, Math.max(0, Math.round(v * f))]),
    );
  return {
    permanent: scale(base.permanent),
    consumables: scale(base.consumables),
    gp: Math.round(base.gp * f),
    totalGp: Math.round(base.totalGp * f),
  };
}

/** Pick an item of a given level (± tolerance) and category. */
function pickItem(
  category: "permanent" | "consumable",
  desiredLevel: number,
  rng: Rng,
): LootItem | null {
  const isConsumableTrait = (e: IndexEntry) =>
    e.traits.includes("consumable") ||
    e.kind === "consumable" ||
    e.traits.includes("potion") ||
    e.traits.includes("scroll") ||
    e.traits.includes("alchemical");

  const all = getItems();
  const pool = all.filter((it) => {
    if (Math.abs(it.level - desiredLevel) > 1) return false;
    if (it.rarity === "unique") return false;
    return category === "consumable" ? isConsumableTrait(it) : !isConsumableTrait(it);
  });
  if (pool.length === 0) return null;
  const chosen = rng.pick(pool);
  return { uuid: chosen.uuid, name: chosen.name, level: chosen.level, category };
}

export interface AllocatedLoot {
  vaultHoards: LootContent[]; // to place in loot rooms
  combatDrops: LootContent[]; // to attach to combat encounters (order roughly matches combat rooms)
  bossHoard: LootContent | null;
}

export function allocateLoot(
  partyLevel: number,
  numCombatRooms: number,
  numLootRooms: number,
  generosity: LootGenerosity,
  rng: Rng,
): AllocatedLoot {
  const encounterCount = Math.max(1, numCombatRooms);
  const slots = scaledSlotsForDungeon(partyLevel, encounterCount, generosity);

  const permanentItems: LootItem[] = [];
  for (const [offsetStr, count] of Object.entries(slots.permanent)) {
    const offset = Number(offsetStr);
    const desiredLevel = partyLevel + offset;
    for (let i = 0; i < count; i++) {
      const it = pickItem("permanent", desiredLevel, rng);
      if (it) permanentItems.push(it);
    }
  }
  const consumableItems: LootItem[] = [];
  for (const [offsetStr, count] of Object.entries(slots.consumables)) {
    const offset = Number(offsetStr);
    const desiredLevel = partyLevel + offset;
    for (let i = 0; i < count; i++) {
      const it = pickItem("consumable", desiredLevel, rng);
      if (it) consumableItems.push(it);
    }
  }

  const vaultShare = 0.6;
  const permForVaults = Math.round(permanentItems.length * vaultShare);
  const permForBoss = Math.min(permanentItems.length - permForVaults, Math.ceil(permanentItems.length * 0.3));

  const vaultItems = permanentItems.slice(0, permForVaults);
  const bossPerm = permanentItems.slice(permForVaults, permForVaults + permForBoss);
  const combatPerm = permanentItems.slice(permForVaults + permForBoss);

  const consForCombat = Math.round(consumableItems.length * 0.6);
  const consForBoss = Math.min(consumableItems.length - consForCombat, Math.ceil(consumableItems.length * 0.25));

  const combatCons = consumableItems.slice(0, consForCombat);
  const bossCons = consumableItems.slice(consForCombat, consForCombat + consForBoss);
  const vaultCons = consumableItems.slice(consForCombat + consForBoss);

  const gpTotal = slots.gp;
  const gpForVaults = Math.round(gpTotal * 0.55);
  const gpForBoss = Math.round(gpTotal * 0.2);
  const gpForCombat = gpTotal - gpForVaults - gpForBoss;

  const vaultCount = Math.max(1, numLootRooms);
  const vaultHoards: LootContent[] = [];
  for (let i = 0; i < vaultCount; i++) vaultHoards.push({ items: [], gp: 0, fromDefeated: false });
  vaultItems.forEach((it, i) => vaultHoards[i % vaultCount]!.items.push(it));
  vaultCons.forEach((it, i) => vaultHoards[i % vaultCount]!.items.push(it));
  const gpPerVault = Math.floor(gpForVaults / vaultCount);
  vaultHoards.forEach((h) => (h.gp = gpPerVault));
  vaultHoards[0]!.gp += gpForVaults - gpPerVault * vaultCount;

  const combatDropCount = Math.max(1, numCombatRooms);
  const combatDrops: LootContent[] = [];
  for (let i = 0; i < combatDropCount; i++) combatDrops.push({ items: [], gp: 0, fromDefeated: true });
  combatPerm.forEach((it, i) => combatDrops[i % combatDropCount]!.items.push(it));
  combatCons.forEach((it, i) => combatDrops[i % combatDropCount]!.items.push(it));
  const gpPerCombat = Math.floor(gpForCombat / combatDropCount);
  combatDrops.forEach((d) => (d.gp = gpPerCombat));
  combatDrops[0]!.gp += gpForCombat - gpPerCombat * combatDropCount;

  const bossHoard: LootContent = {
    items: [...bossPerm, ...bossCons],
    gp: gpForBoss,
    fromDefeated: true,
  };

  return { vaultHoards, combatDrops, bossHoard };
}
