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
  const fileName = `${safeName}-${Date.now()}.png`;
  const relativePath = `${dir}/${fileName}`;
  const file = new File([blob], fileName, { type: "image/png" });
  const result = await FP.upload("data", dir, file, {}, { notify: false });

  let returnedPath: string | undefined =
    typeof result === "object" && typeof result?.path === "string" ? result.path : undefined;

  let path = relativePath;
  if (returnedPath) {
    if (/^https?:\/\//i.test(returnedPath)) {
      const idx = returnedPath.indexOf("/worlds/");
      if (idx !== -1) {
        path = returnedPath.slice(idx + 1);
      }
    } else {
      path = returnedPath;
    }
  }

  console.info(`[${MODULE_ID}] Uploaded background. server=${returnedPath} using=${path}`);
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

  // v14: the visible background lives on a Level, not the scene root.
  // We create one ground-floor level and hang the background off it.
  // Set scene root background to empty string for compat with older readers.
  const levelDoc: any = {
    name: "Ground",
    sort: 0,
    elevation: { bottom: 0, top: 10 },
    background: { src: bgPath },
  };

  const sceneData: any = {
    name: plan.name,
    active: false,
    navigation: true,
    width: widthPx,
    height: heightPx,
    background: { src: "" },
    levels: [levelDoc],
    grid: { type: 1, size: gridPx, distance: 5, units: "ft" },
    padding: 0,
    initial: null,
    tokenVision: true,
    fog: { exploration: false, reset: 0 },
    darkness: darknessForLighting(plan.input.lighting),
    globalLight: plan.input.lighting === "well-lit",
    backgroundColor: "#0b0b0f",
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
  const srcLevels: any[] = scene?._source?.levels ?? [];
  const levelSrc = srcLevels[0]?.background?.src ?? null;
  console.info(
    `[${MODULE_ID}] Scene ${scene?.id} created. levels=${srcLevels.length} level[0].background.src=${levelSrc}`,
  );

  if (!levelSrc || levelSrc !== bgPath) {
    console.warn(`[${MODULE_ID}] Level background not set as expected, updating explicitly.`);
    const clonedLevels = srcLevels.length > 0
      ? JSON.parse(JSON.stringify(srcLevels))
      : [{ name: "Ground", sort: 0, elevation: { bottom: 0, top: 10 }, background: {} }];
    clonedLevels[0].background = { ...(clonedLevels[0].background ?? {}), src: bgPath };
    await scene.update({ levels: clonedLevels, "background.src": bgPath, thumb: null });
    const afterLevels: any[] = scene?._source?.levels ?? [];
    console.info(
      `[${MODULE_ID}] After update, level[0].background.src=${afterLevels[0]?.background?.src}`,
    );
  }

  return { scene, gridPx };
}
