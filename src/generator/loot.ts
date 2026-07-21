/**
 * Dungeon loot budgeter.
 *
 * Distribution model (skewed low for a "scavenging" feel):
 *   - Most permanent items at party level - 5 (floored at 0). Bulk of loot.
 *   - 1-2 mid-tier items at party level -2 to -3.
 *   - At-level items go ONLY in the boss hoard (0-1 per dungeon, gated by
 *     generosity). Regular loot rooms and combat drops never exceed level -2.
 *   - Consumables mostly at party level -4 to -2, gated at party level -1.
 *   - Never above party level.
 */
import type { IndexEntry } from "../pf2e/adapter.js";
import { getItems } from "../pf2e/adapter.js";
import type { LootContent, LootGenerosity, LootItem, Rng } from "../types.js";

const GENEROSITY_MULT: Record<LootGenerosity, number> = {
  stingy: 0.6,
  standard: 1.0,
  generous: 1.5,
};

interface LootBudget {
  low: number; // party level -5 (min 0). Bulk.
  mid: number; // party level -2..-3. 1-2 items.
  bossAtLevel: number; // party level. 0-1 in boss hoard only.
  consumables: number; // party level -4..-2 (up to -1 rarely).
  gp: number;
}

function budgetFor(
  partyLevel: number,
  encounterCount: number,
  generosity: LootGenerosity,
  rng: Rng,
): LootBudget {
  const gen = GENEROSITY_MULT[generosity];
  const enc = Math.max(1, encounterCount);
  const encScale = enc / 8;
  const lowCount = Math.max(2, Math.round(4 * encScale * gen + 1));
  const midCount = generosity === "stingy" ? (rng.chance(0.5) ? 1 : 0) : 1 + (rng.chance(0.5) ? 1 : 0);
  let bossAt: number;
  if (generosity === "stingy") bossAt = rng.chance(0.3) ? 1 : 0;
  else if (generosity === "generous") bossAt = rng.chance(0.9) ? 1 : 0;
  else bossAt = rng.chance(0.6) ? 1 : 0;
  const consumables = Math.round(3 * encScale * gen + 1);
  const gpCurve = Math.max(1, partyLevel) ** 1.8;
  const gp = Math.round(gpCurve * 6 * gen * encScale);
  return { low: lowCount, mid: midCount, bossAtLevel: bossAt, consumables, gp };
}

function isConsumableTrait(e: IndexEntry): boolean {
  return (
    e.traits.includes("consumable") ||
    e.kind === "consumable" ||
    e.traits.includes("potion") ||
    e.traits.includes("scroll") ||
    e.traits.includes("alchemical") ||
    e.traits.includes("wand")
  );
}

function pickItem(
  category: "permanent" | "consumable",
  minLevel: number,
  maxLevel: number,
  rng: Rng,
): LootItem | null {
  const clampedMin = Math.max(0, minLevel);
  const clampedMax = Math.max(clampedMin, maxLevel);
  const all = getItems();
  const pool = all.filter((it) => {
    if (it.level < clampedMin || it.level > clampedMax) return false;
    if (it.rarity === "unique") return false;
    if (it.rarity === "rare" && rng.chance(0.9)) return false;
    return category === "consumable" ? isConsumableTrait(it) : !isConsumableTrait(it);
  });
  if (pool.length === 0) return null;
  const chosen = rng.pick(pool);
  return { uuid: chosen.uuid, name: chosen.name, level: chosen.level, category };
}

export interface AllocatedLoot {
  vaultHoards: LootContent[];
  combatDrops: LootContent[];
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
  const budget = budgetFor(partyLevel, encounterCount, generosity, rng);

  // BULK LOW-LEVEL POOL: goes to vaults + combat drops.
  const lowPool: LootItem[] = [];
  const lowTarget = Math.max(0, partyLevel - 5);
  for (let i = 0; i < budget.low; i++) {
    const it = pickItem("permanent", lowTarget, lowTarget, rng);
    if (it) lowPool.push(it);
  }

  // MID-TIER: 1-2 items, distributed across vaults.
  const midPool: LootItem[] = [];
  const midMin = Math.max(0, partyLevel - 3);
  const midMax = Math.max(0, partyLevel - 2);
  for (let i = 0; i < budget.mid; i++) {
    const it = pickItem("permanent", midMin, midMax, rng);
    if (it) midPool.push(it);
  }

  // BOSS at-level candidate: 0-1 item, boss hoard only.
  const bossOnly: LootItem[] = [];
  for (let i = 0; i < budget.bossAtLevel; i++) {
    const it = pickItem("permanent", partyLevel, partyLevel, rng);
    if (it) bossOnly.push(it);
  }

  // CONSUMABLES: mostly low (party -4..-2), rare chance one at party -1.
  const consumableItems: LootItem[] = [];
  const consMin = Math.max(0, partyLevel - 4);
  const consMax = Math.max(0, partyLevel - 2);
  for (let i = 0; i < budget.consumables; i++) {
    const bumpTop = rng.chance(0.15) && partyLevel - 1 > consMax;
    const it = pickItem(
      "consumable",
      consMin,
      bumpTop ? partyLevel - 1 : consMax,
      rng,
    );
    if (it) consumableItems.push(it);
  }

  rng.shuffle(lowPool);
  rng.shuffle(midPool);
  rng.shuffle(consumableItems);

  // Merge low + mid into a "regular" pool for splitting; boss keeps its own.
  const regularPool: LootItem[] = [...lowPool, ...midPool];

  const vaultShare = 0.65;
  const regularForVaults = Math.round(regularPool.length * vaultShare);
  const regularForCombat = regularPool.length - regularForVaults;

  const vaultItems = regularPool.slice(0, regularForVaults);
  const combatPerm = regularPool.slice(regularForVaults, regularForVaults + regularForCombat);

  const consForCombat = Math.round(consumableItems.length * 0.5);
  const consForBoss = Math.min(
    consumableItems.length - consForCombat,
    Math.ceil(consumableItems.length * 0.2),
  );
  const combatCons = consumableItems.slice(0, consForCombat);
  const bossCons = consumableItems.slice(consForCombat, consForCombat + consForBoss);
  const vaultCons = consumableItems.slice(consForCombat + consForBoss);

  const gpTotal = budget.gp;
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
    items: [...bossOnly, ...bossCons],
    gp: gpForBoss,
    fromDefeated: true,
  };

  return { vaultHoards, combatDrops, bossHoard };
}
