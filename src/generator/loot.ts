/**
 * Dungeon loot budgeter.
 *
 * Distribution model (tuned for felt balance, not strict PF2e GMG table):
 *   - Most permanent items sit at party level -3 to -4 (low, common).
 *   - Some at party level -2 to -1 (mid, occasional).
 *   - At-level items are rare: at most 0-2 per dungeon, weighted by generosity.
 *   - Never above party level.
 * GP scales roughly with the sum of item budgets and generosity.
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
  low: number; // party level -3..-4
  mid: number; // party level -1..-2
  atLevel: number; // party level (rare)
  consumables: number; // level -3..-1
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
  const lowCount = Math.round(3 * (enc / 8) * gen + 1);
  const midCount = Math.round(1.5 * (enc / 8) * gen);
  let atCount: number;
  if (generosity === "stingy") {
    atCount = rng.chance(0.4) ? 1 : 0;
  } else if (generosity === "generous") {
    atCount = rng.chance(0.85) ? 1 + rng.int(0, 1) : 0;
  } else {
    atCount = rng.chance(0.55) ? 1 + rng.int(0, 1) : 0;
  }
  const consumables = Math.round(4 * (enc / 8) * gen + 1);
  const gpCurve = Math.max(1, partyLevel) ** 1.8;
  const gp = Math.round(gpCurve * 6 * gen * (enc / 8));
  return { low: lowCount, mid: midCount, atLevel: Math.min(2, atCount), consumables, gp };
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
  const all = getItems();
  const pool = all.filter((it) => {
    if (it.level < minLevel || it.level > maxLevel) return false;
    if (it.rarity === "unique") return false;
    if (it.rarity === "rare" && rng.chance(0.85)) return false;
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

  const permanentItems: LootItem[] = [];
  const lowMin = Math.max(0, partyLevel - 4);
  const lowMax = Math.max(0, partyLevel - 3);
  for (let i = 0; i < budget.low; i++) {
    const it = pickItem("permanent", lowMin, lowMax, rng);
    if (it) permanentItems.push(it);
  }
  const midMin = Math.max(0, partyLevel - 2);
  const midMax = Math.max(0, partyLevel - 1);
  for (let i = 0; i < budget.mid; i++) {
    const it = pickItem("permanent", midMin, midMax, rng);
    if (it) permanentItems.push(it);
  }
  for (let i = 0; i < budget.atLevel; i++) {
    const it = pickItem("permanent", partyLevel, partyLevel, rng);
    if (it) permanentItems.push(it);
  }

  const consumableItems: LootItem[] = [];
  const consMin = Math.max(0, partyLevel - 3);
  const consMax = Math.max(0, partyLevel - 1);
  for (let i = 0; i < budget.consumables; i++) {
    const it = pickItem("consumable", consMin, consMax, rng);
    if (it) consumableItems.push(it);
  }

  rng.shuffle(permanentItems);
  rng.shuffle(consumableItems);

  const vaultShare = 0.55;
  const permForVaults = Math.round(permanentItems.length * vaultShare);
  const permForBoss = Math.min(
    permanentItems.length - permForVaults,
    Math.max(1, Math.ceil(permanentItems.length * 0.25)),
  );

  const vaultItems = permanentItems.slice(0, permForVaults);
  const bossPerm = permanentItems.slice(permForVaults, permForVaults + permForBoss);
  const combatPerm = permanentItems.slice(permForVaults + permForBoss);

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
    items: [...bossPerm, ...bossCons],
    gp: gpForBoss,
    fromDefeated: true,
  };

  return { vaultHoards, combatDrops, bossHoard };
}
