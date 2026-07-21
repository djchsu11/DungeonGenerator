/**
 * Procedural background rendering. Draws floor tiles from a bundled seamless
 * texture masked to the union of room+corridor polygons; outside is dark void.
 */
import type { ArchetypeDef } from "../archetypes/index.js";
import type { DungeonPlan } from "../types.js";
import type { EmbeddedDungeon } from "../generator/embed.js";
import { MODULE_ID } from "../types.js";

export const GRID_PX = 100;

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawNoiseFallback(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 1): void {
  const image = ctx.createImageData(w, h);
  const data = image.data;
  let s = seed;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const n = (s & 0xff) / 255;
    const base = 40 + Math.floor(n * 60);
    data[i] = base;
    data[i + 1] = base * 0.9;
    data[i + 2] = base * 0.8;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

async function makeFloorPattern(
  archetype: ArchetypeDef,
  ctx: CanvasRenderingContext2D,
): Promise<CanvasPattern | string> {
  const url = `modules/${MODULE_ID}/assets/textures/${archetype.textureFile}`;
  const img = await loadImage(url);
  if (img) {
    const p = ctx.createPattern(img, "repeat");
    if (p) return p;
  }
  const tileSize = 128;
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = tileSize;
  tileCanvas.height = tileSize;
  const tctx = tileCanvas.getContext("2d")!;
  const seed = Array.from(archetype.id).reduce((a, c) => a + c.charCodeAt(0), 0);
  drawNoiseFallback(tctx, tileSize, tileSize, seed);
  const p = ctx.createPattern(tileCanvas, "repeat");
  return p ?? "#333333";
}

export async function renderBackground(
  plan: DungeonPlan,
  embed: EmbeddedDungeon,
  archetype: ArchetypeDef,
): Promise<Blob> {
  const w = embed.bounds.w * GRID_PX;
  const h = embed.bounds.h * GRID_PX;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0b0f";
  ctx.fillRect(0, 0, w, h);

  const pattern = await makeFloorPattern(archetype, ctx);

  ctx.save();
  ctx.beginPath();
  for (const node of plan.graph.nodes.values()) {
    if (!node.rect) continue;
    ctx.rect(node.rect.x * GRID_PX, node.rect.y * GRID_PX, node.rect.w * GRID_PX, node.rect.h * GRID_PX);
  }
  const HALF = 1.5;
  const addSegment = (x1: number, y1: number, x2: number, y2: number) => {
    const minX = Math.min(x1, x2) - HALF;
    const minY = Math.min(y1, y2) - HALF;
    const maxX = Math.max(x1, x2) + HALF;
    const maxY = Math.max(y1, y2) + HALF;
    ctx.rect(minX * GRID_PX, minY * GRID_PX, (maxX - minX) * GRID_PX, (maxY - minY) * GRID_PX);
  };
  for (const c of embed.corridors) {
    if (c.ay === c.by || c.ax === c.bx) {
      addSegment(c.ax, c.ay, c.bx, c.by);
    } else {
      addSegment(c.ax, c.ay, c.bx, c.ay);
      addSegment(c.bx, c.ay, c.bx, c.by);
    }
  }
  ctx.clip();
  ctx.fillStyle = pattern as any;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 4;
  for (const node of plan.graph.nodes.values()) {
    if (!node.rect) continue;
    ctx.strokeRect(node.rect.x * GRID_PX, node.rect.y * GRID_PX, node.rect.w * GRID_PX, node.rect.h * GRID_PX);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}
