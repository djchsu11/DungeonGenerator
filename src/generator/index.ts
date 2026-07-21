/**
 * Top-level generation orchestrator. Produces a fully-planned DungeonPlan.
 * Does not touch Foundry documents — that's the scene/journal/compendium builders' job.
 */
import { ARCHETYPES } from "../archetypes/index.js";
import { findFamily, FAMILY_BUNDLES } from "../families/bundles.js";
import { makeFilter } from "../families/resolver.js";
import { makeRng } from "../rng.js";
import type {
  ArchetypeId,
  DungeonNode,
  DungeonPlan,
  GenerationInput,
  RoomContent,
  Threat,
} from "../types.js";
import { assignRoomTypes } from "./rooms.js";
import { generateGraph } from "./graph.js";
import { embedGraph, type EmbeddedDungeon } from "./embed.js";
import { buildEncounter } from "./encounters.js";
import { pickHazard } from "./hazards.js";
import { allocateLoot } from "./loot.js";
import { generatePuzzle } from "./puzzles/index.js";
import { generateReadAloud, generateGmNotes, generateBossIdentity } from "./prose.js";
import { generateDungeonName } from "./name.js";
import { ensureIndex } from "../pf2e/adapter.js";

const DEFAULT_FAMILY_ARCHETYPE: ArchetypeId = "cave";

function resolveArchetype(input: GenerationInput): ArchetypeId {
  if (input.archetype) return input.archetype;
  const bundle = findFamily(input.familyId ?? null);
  if (bundle?.defaultArchetype) return bundle.defaultArchetype;
  return DEFAULT_FAMILY_ARCHETYPE;
}

function threatForRoom(node: DungeonNode, climax: "severe" | "extreme"): Threat {
  if (node.isBoss) return climax;
  if (node.isMiniBoss) return "severe";
  if (node.depth <= 2) return "low";
  if (node.depth <= 4) return "moderate";
  return "moderate";
}

function summarizeEncounter(
  enc: {
    creatures: Array<{ name: string; level: number }>;
  },
  isBoss: boolean,
): { groups: Array<{ name: string; count: number }> } {
  if (!enc.creatures.length) return { groups: [] };

  let listing = enc.creatures;
  if (isBoss) {
    // Remove one instance of the highest-level creature (the boss) from the
    // hint so the boss stays a surprise. Remaining creatures are described
    // as minions/guards.
    const sorted = enc.creatures
      .map((c, i) => ({ c, i }))
      .sort((a, b) => b.c.level - a.c.level);
    const bossIdx = sorted[0]?.i;
    if (bossIdx !== undefined) {
      listing = enc.creatures.filter((_, i) => i !== bossIdx);
    }
  }

  const byName = new Map<string, number>();
  for (const c of listing) byName.set(c.name, (byName.get(c.name) ?? 0) + 1);
  const groups = [...byName.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return { groups };
}

export interface GenerationResult {
  plan: DungeonPlan;
  embed: EmbeddedDungeon;
}

export async function planDungeon(input: GenerationInput): Promise<GenerationResult> {
  await ensureIndex();

  const rng = makeRng();
  const archetypeId = resolveArchetype(input);
  const archetype = ARCHETYPES[archetypeId];
  const bundle = findFamily(input.familyId ?? null);
  const filter = makeFilter(bundle, input.familyTraits ?? []);
  const name = input.name?.trim() || generateDungeonName(rng);

  const graph = generateGraph(input.size, rng);
  assignRoomTypes(graph, input.puzzleDensity ?? "normal", rng);
  const embed = embedGraph(graph, rng);

  const partyLevel = Math.max(1, Math.min(20, Math.floor(input.partyLevel)));
  const partySize = input.partySize ?? 4;
  const climax = input.climaxThreat ?? "severe";

  const nodes = [...graph.nodes.values()];
  const combatNodes = nodes.filter((n) => n.roomType === "combat");
  const lootNodes = nodes.filter((n) => n.roomType === "loot");

  const loot = allocateLoot(
    partyLevel,
    combatNodes.length,
    lootNodes.length,
    input.lootGenerosity ?? "standard",
    rng,
  );

  const rooms: RoomContent[] = [];

  const orderedCombat = combatNodes.slice().sort((a, b) => a.depth - b.depth);
  let combatDropIdx = 0;

  for (const node of nodes) {
    const roomType = node.roomType;
    const extras: string[] = [];
    const room: RoomContent = { node, readAloud: "", gmNotes: "" };
    let encounterHint: { groups: Array<{ name: string; count: number }> } | undefined;

    if (roomType === "combat") {
      const threat = threatForRoom(node, climax);
      node.threat = threat;
      const innerW = node.rect ? Math.max(1, node.rect.w - 2) : undefined;
      const innerH = node.rect ? Math.max(1, node.rect.h - 2) : undefined;
      const maxCreatureTiles =
        innerW !== undefined && innerH !== undefined ? Math.max(1, Math.min(innerW, innerH)) : undefined;
      // Reserve ~30% of interior floor space for movement gaps and loot tokens.
      const maxFloorTiles =
        innerW !== undefined && innerH !== undefined
          ? Math.max(1, Math.floor(innerW * innerH * 0.7))
          : undefined;
      const enc = buildEncounter({
        threat,
        partyLevel,
        partySize,
        filter,
        rng,
        maxCreatureTiles,
        maxFloorTiles,
      });
      room.encounter = enc;
      if (node.isBoss || node.isMiniBoss) {
        const ident = generateBossIdentity(rng);
        enc.bossName = ident.name;
        enc.bossFeature = ident.feature;
        extras.push(`Boss: ${ident.name} (${ident.feature}).`);
      }
      if (node.isBoss && loot.bossHoard) {
        room.loot = loot.bossHoard;
        extras.push(`Boss carries loot listed below.`);
      } else if (orderedCombat.indexOf(node) >= 0 && combatDropIdx < loot.combatDrops.length) {
        const drop = loot.combatDrops[combatDropIdx++];
        if (drop && (drop.items.length > 0 || drop.gp > 0)) room.loot = drop;
      }
      extras.push(`Encounter: ${enc.creatures.length} creatures, ${enc.xpSpent}/${enc.xpBudget} XP (${threat}).`);
      encounterHint = summarizeEncounter(enc, !!node.isBoss);
    } else if (roomType === "hazard") {
      const hz = pickHazard(partyLevel, archetype, rng);
      if (hz) {
        room.hazard = hz;
        extras.push(`Hazard: ${hz.name} (level ${hz.level}).`);
      } else {
        extras.push("No suitable hazard found for level; consider substituting an environmental effect.");
      }
    } else if (roomType === "puzzle") {
      room.puzzle = generatePuzzle(partyLevel, rng);
      extras.push(`Puzzle: ${room.puzzle.title} (DC ${room.puzzle.dc}).`);
    } else if (roomType === "loot") {
      const idx = lootNodes.indexOf(node);
      const hoard = idx >= 0 ? loot.vaultHoards[idx] : undefined;
      if (hoard && (hoard.items.length > 0 || hoard.gp > 0)) {
        room.loot = hoard;
        extras.push(`Treasure vault: ${hoard.items.length} items, ${hoard.gp} gp.`);
      } else {
        extras.push("Empty treasure vault — GM may add flavor loot.");
      }
    }

    room.readAloud = generateReadAloud(node, roomType, archetype, rng, encounterHint);
    room.gmNotes = generateGmNotes(roomType, archetype, rng, extras);
    rooms.push(room);
  }

  let totalXp = 0;
  let totalGp = 0;
  for (const r of rooms) {
    if (r.encounter) totalXp += r.encounter.xpSpent;
    if (r.loot) totalGp += r.loot.gp;
    if (r.puzzle) totalXp += Math.round(r.puzzle.level * 5);
    if (r.hazard) totalXp += Math.round(r.hazard.level * 5);
  }

  const plan: DungeonPlan = {
    name,
    input: {
      partyLevel,
      partySize,
      size: input.size,
      lighting: input.lighting ?? "torchlit",
      lootGenerosity: input.lootGenerosity ?? "standard",
      puzzleDensity: input.puzzleDensity ?? "normal",
      climaxThreat: climax,
      familyId: input.familyId ?? null,
      familyTraits: input.familyTraits ?? [],
      archetype: archetypeId,
      name,
    },
    graph,
    rooms,
    totalXp,
    totalLootGp: totalGp,
  };

  return { plan, embed };
}

export { FAMILY_BUNDLES };
