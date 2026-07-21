/**
 * Foundry-side helpers: build a Scene with walls/doors/lights, upload the
 * generated background PNG, and place tokens.
 */
import type { ArchetypeDef } from "../archetypes/index.js";
import { MODULE_ID, type DungeonPlan, type Lighting } from "../types.js";
import type { EmbeddedDungeon } from "../generator/embed.js";
import { renderBackground, GRID_PX } from "./background.js";
import { buildWallsAndDoors, buildLights } from "./walls.js";

export interface SceneBuildResult {
  scene: any;
  gridPx: number;
}

async function uploadBackground(sceneName: string, blob: Blob): Promise<string> {
  const g: any = game;
  const worldName: string = g.world?.id ?? "world";
  const dir = `worlds/${worldName}/${MODULE_ID}`;
  const FP: any =
    (foundry as any)?.applications?.apps?.FilePicker?.implementation ??
    (globalThis as any).FilePicker;
  try {
    await FP.createDirectory("data", dir, {}).catch(() => undefined);
  } catch {
    /* directory may already exist */
  }
  const safeName = sceneName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const file = new File([blob], `${safeName}-${Date.now()}.png`, { type: "image/png" });
  const result = await FP.upload("data", dir, file, {}, { notify: false });
  const path = typeof result === "object" && result?.path ? result.path : `${dir}/${file.name}`;
  console.info(`[${MODULE_ID}] Uploaded background to ${path}`);
  return path;
}

function darknessForLighting(l: Lighting): number {
  return l === "well-lit" ? 0.0 : l === "torchlit" ? 0.75 : 1.0;
}

export async function buildScene(
  plan: DungeonPlan,
  embed: EmbeddedDungeon,
  archetype: ArchetypeDef,
): Promise<SceneBuildResult> {
  const gridPx = GRID_PX;
  const widthPx = embed.bounds.w * gridPx;
  const heightPx = embed.bounds.h * gridPx;

  const bgBlob = await renderBackground(plan, embed, archetype);
  const bgPath = await uploadBackground(plan.name, bgBlob);

  const walls = buildWallsAndDoors(plan.graph, embed, gridPx);
  const lights = buildLights(plan.graph, embed, archetype, plan.input.lighting, gridPx);

  const sceneData: any = {
    name: plan.name,
    active: false,
    navigation: true,
    width: widthPx,
    height: heightPx,
    background: { src: bgPath },
    grid: { type: 1, size: gridPx, distance: 5, units: "ft" },
    padding: 0.1,
    initial: null,
    tokenVision: true,
    fog: { exploration: false, reset: 0 },
    darkness: darknessForLighting(plan.input.lighting),
    globalLight: plan.input.lighting === "well-lit",
    walls,
    lights,
    flags: {
      [MODULE_ID]: {
        version: 1,
        archetype: archetype.id,
        familyId: plan.input.familyId,
      },
    },
  };

  const scene = await Scene.create(sceneData);
  return { scene, gridPx };
}
