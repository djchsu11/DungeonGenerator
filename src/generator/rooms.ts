/**
 * Assign a RoomType to each graph node, respecting:
 * - entrance is always "empty"
 * - boss is always "combat"
 * - mini-boss is always "combat"
 * - dead-ends are biased toward "loot" or "puzzle"
 * - remaining rooms follow a target ratio (~45% combat, 15% hazard, 15% loot, 15% empty, +puzzles)
 */
import type { DungeonGraph, PuzzleDensity, RoomType, Rng } from "../types.js";

interface Ratios {
  combat: number;
  hazard: number;
  loot: number;
  empty: number;
}

const BASE_RATIOS: Ratios = {
  combat: 0.45,
  hazard: 0.15,
  loot: 0.15,
  empty: 0.15,
};

function puzzleCountFor(totalRooms: number, density: PuzzleDensity, rng: Rng): number {
  if (density === "none") return 0;
  const per = { rare: 15, normal: 9, frequent: 5 }[density];
  const base = Math.floor(totalRooms / per);
  return base + (rng.chance((totalRooms % per) / per) ? 1 : 0);
}

export function assignRoomTypes(
  graph: DungeonGraph,
  puzzleDensity: PuzzleDensity,
  rng: Rng,
): void {
  const nodes = [...graph.nodes.values()];
  const entrance = nodes.find((n) => n.isEntrance);
  if (entrance) entrance.roomType = "empty";

  const boss = nodes.find((n) => n.isBoss);
  if (boss) boss.roomType = "combat";
  const mini = nodes.find((n) => n.isMiniBoss);
  if (mini) mini.roomType = "combat";

  // Secret rooms are always loot rooms — they carry a share of the treasure
  // budget behind a hidden door.
  for (const n of nodes) {
    if (n.isSecret) n.roomType = "loot";
  }

  const remaining = nodes.filter((n) => !n.isEntrance && !n.isBoss && !n.isMiniBoss && !n.isSecret);
  const total = nodes.length;

  const puzzles = puzzleCountFor(total, puzzleDensity, rng);

  const deadEnds = remaining.filter((n) => n.isDeadEnd);
  const others = remaining.filter((n) => !n.isDeadEnd);

  let puzzlesLeft = puzzles;
  let combatSlots = Math.round(BASE_RATIOS.combat * remaining.length);
  const hazardSlots = Math.round(BASE_RATIOS.hazard * remaining.length);
  let lootSlots = Math.round(BASE_RATIOS.loot * remaining.length);
  let emptySlots = remaining.length - combatSlots - hazardSlots - lootSlots - puzzlesLeft;
  if (emptySlots < 0) {
    combatSlots += emptySlots;
    emptySlots = 0;
  }

  const shuffledDead = rng.shuffle(deadEnds);
  for (const n of shuffledDead) {
    if (puzzlesLeft > 0 && rng.chance(0.4)) {
      n.roomType = "puzzle";
      puzzlesLeft--;
    } else if (lootSlots > 0) {
      n.roomType = "loot";
      lootSlots--;
    } else if (puzzlesLeft > 0) {
      n.roomType = "puzzle";
      puzzlesLeft--;
    } else {
      n.roomType = "empty";
      emptySlots = Math.max(0, emptySlots - 1);
    }
  }

  const pool: RoomType[] = [];
  for (let i = 0; i < combatSlots; i++) pool.push("combat");
  for (let i = 0; i < hazardSlots; i++) pool.push("hazard");
  for (let i = 0; i < lootSlots; i++) pool.push("loot");
  for (let i = 0; i < puzzlesLeft; i++) pool.push("puzzle");
  for (let i = 0; i < emptySlots; i++) pool.push("empty");
  while (pool.length < others.length) pool.push("combat");
  const assigned = rng.shuffle(pool).slice(0, others.length);
  others.forEach((n, i) => (n.roomType = assigned[i] ?? "empty"));
}
