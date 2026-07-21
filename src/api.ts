/**
 * Top-level programmatic API. Exposed as `game.dungeongen`.
 */
import { archetypeById } from "./archetypes/index.js";
import { FAMILY_BUNDLES } from "./families/bundles.js";
import { planDungeon } from "./generator/index.js";
import { buildScene } from "./foundry/scene.js";
import { placeTokens } from "./foundry/actors.js";
import { buildJournal } from "./foundry/journal.js";
import { ensureFolders } from "./foundry/compendium.js";
import type { GenerationInput } from "./types.js";

export interface GenerateResult {
  scene: any;
  journal: any;
  totalXp: number;
  totalGp: number;
  dungeonName: string;
}

export async function generate(input: GenerationInput): Promise<GenerateResult> {
  ui.notifications?.info("Dungeon Generator: planning dungeon...");
  const { plan, embed } = await planDungeon(input);

  const arch = archetypeById(plan.input.archetype);
  const folders = await ensureFolders(plan.name);

  ui.notifications?.info(`Dungeon Generator: building scene "${plan.name}"...`);
  const { scene } = await buildScene(plan, embed, arch);
  if (folders.sceneFolder?.id) {
    await scene.update({ folder: folders.sceneFolder.id });
  }

  await placeTokens(plan, scene);

  const journal = await buildJournal(plan, folders.journalFolder);

  ui.notifications?.info(`Dungeon Generator: "${plan.name}" ready.`);

  return {
    scene,
    journal,
    totalXp: plan.totalXp,
    totalGp: plan.totalLootGp,
    dungeonName: plan.name,
  };
}

export const api = {
  generate,
  families: FAMILY_BUNDLES,
};
