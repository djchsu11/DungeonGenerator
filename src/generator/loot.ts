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

/**
 * Split `total` gp across `pileCount` piles using random weights so no two
 * piles end up equal. Each pile is guaranteed at least `minPerPile` (if the
 * budget allows), and results are rounded to whole gp with the remainder
 * absorbed by random piles so the total is exact.
 */
function jitterSplit(total: number, pileCount: number, rng: Rng, minPerPile = 0): number[] {
  if (pileCount <= 0) return [];
  if (pileCount === 1) return [total];
  if (total <= 0) return new Array(pileCount).fill(0);

  const guaranteed = Math.min(minPerPile * pileCount, total);
  const remainder = total - guaranteed;

  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < pileCount; i++) {
    // Weights in [0.4, 1.6] give a healthy spread without any pile going to zero.
    const w = 0.4 + rng.next() * 1.2;
    weights.push(w);
    sum += w;
  }

  const piles = weights.map((w) => Math.floor((w / sum) * remainder) + minPerPile);
  let distributed = piles.reduce((s, v) => s + v, 0);
  let leftover = total - distributed;

  // Sprinkle leftover +/- 1gp coins one at a time into random piles until exact.
  while (leftover > 0) {
    piles[rng.int(0, pileCount - 1)]! += 1;
    leftover--;
  }
  while (leftover < 0) {
    const idx = rng.int(0, pileCount - 1);
    if (piles[idx]! > 0) {
      piles[idx]! -= 1;
      leftover++;
    }
  }

  return piles;
}

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
  // Add per-dungeon jitter (±25%) so total gp isn't the same for every dungeon.
  const jitter = 0.75 + rng.next() * 0.5;
  const gp = Math.round(gpCurve * 6 * gen * encScale * jitter);
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

const PHYSICAL_KINDS = new Set([
  "weapon",
  "armor",
  "shield",
  "consumable",
  "equipment",
  "treasure",
  "backpack",
  "book",
]);

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
    // Defense-in-depth: never let an effect/feat/action/spell slip into a
    // chest, even if the adapter's pack routing changes upstream.
    if (!PHYSICAL_KINDS.has(String(it.kind).toLowerCase())) return false;
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
  numSecretVaults = 0,
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
  const secretCount = Math.max(0, Math.min(numSecretVaults, vaultCount));
  const vaultHoards: LootContent[] = [];
  for (let i = 0; i < vaultCount; i++) vaultHoards.push({ items: [], gp: 0, fromDefeated: false });

  // Route mid-tier items to secret vaults first — finding a hidden door
  // should feel more rewarding than opening the vault behind an unlocked door.
  const midInVault = vaultItems.filter((it) => it.level >= Math.max(0, partyLevel - 3));
  const lowInVault = vaultItems.filter((it) => it.level < Math.max(0, partyLevel - 3));
  const orderedVaultItems: LootItem[] = [];
  // Interleave: give each secret vault a mid-tier item before falling through
  // to normal round-robin distribution.
  for (let i = 0; i < secretCount && i < midInVault.length; i++) {
    orderedVaultItems.push(midInVault[i]!);
  }
  const remainingMids = midInVault.slice(secretCount);
  orderedVaultItems.push(...remainingMids, ...lowInVault);
  orderedVaultItems.forEach((it, i) => vaultHoards[i % vaultCount]!.items.push(it));
  vaultCons.forEach((it, i) => vaultHoards[(i + secretCount) % vaultCount]!.items.push(it));

  // Weight gp toward secret vaults (2x share each) so a secret room has a
  // meaningfully heavier coin pile than a regular one.
  const gpWeights = new Array<number>(vaultCount).fill(1);
  for (let i = 0; i < secretCount; i++) gpWeights[i] = 2;
  const totalWeight = gpWeights.reduce((s, w) => s + w, 0);
  const baseGpSplit = jitterSplit(gpForVaults, vaultCount, rng, 1);
  // Multiply each pile by its weight ratio while preserving the total.
  const weightedRaw = baseGpSplit.map((g, i) => g * (gpWeights[i]! * vaultCount) / totalWeight);
  const weightedTotal = weightedRaw.reduce((s, v) => s + v, 0);
  const scale = weightedTotal > 0 ? gpForVaults / weightedTotal : 1;
  const weightedFloor = weightedRaw.map((v) => Math.floor(v * scale));
  let leftover = gpForVaults - weightedFloor.reduce((s, v) => s + v, 0);
  while (leftover > 0) {
    // Give leftover to secret vaults first, then largest by weight.
    const idx = leftover > 0 ? rng.int(0, secretCount > 0 ? secretCount - 1 : vaultCount - 1) : 0;
    weightedFloor[idx]! += 1;
    leftover--;
  }
  vaultHoards.forEach((h, i) => (h.gp = weightedFloor[i] ?? 0));

  const combatDropCount = Math.max(1, numCombatRooms);
  const combatDrops: LootContent[] = [];
  for (let i = 0; i < combatDropCount; i++) combatDrops.push({ items: [], gp: 0, fromDefeated: true });
  combatPerm.forEach((it, i) => combatDrops[i % combatDropCount]!.items.push(it));
  combatCons.forEach((it, i) => combatDrops[i % combatDropCount]!.items.push(it));
  // Only ~60% of combats actually drop coin; the rest drop 0 (bandits carry
  // gold, oozes don't). This creates natural variance and avoids the
  // "every kill drops N gp" feel.
  const combatDroppers = Math.max(1, Math.round(combatDropCount * 0.6));
  const combatGpSplit = jitterSplit(gpForCombat, combatDroppers, rng, 0);
  const combatIndices = rng.shuffle([...Array(combatDropCount).keys()]).slice(0, combatDroppers);
  combatIndices.forEach((idx, i) => (combatDrops[idx]!.gp = combatGpSplit[i] ?? 0));

  const bossHoard: LootContent = {
    items: [...bossOnly, ...bossCons],
    gp: gpForBoss,
    fromDefeated: true,
  };

  return { vaultHoards, combatDrops, bossHoard };
}
