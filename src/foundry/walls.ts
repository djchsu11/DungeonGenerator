/**
 * Wall + door segment builder.
 *
 * Each room becomes a rectangle of 4 wall sides; corridor openings punch holes
 * in room walls (represented by omitted segments) with a door segment placed at
 * the opening. Corridor sides also emit walls.
 */
import type { ArchetypeDef } from "../archetypes/index.js";
import type { CorridorSegment } from "../generator/embed.js";
import type { EmbeddedDungeon } from "../generator/embed.js";
import type { DungeonGraph, Lighting } from "../types.js";

interface Wall {
  c: [number, number, number, number];
  door?: number;
  ds?: number;
  move?: number;
  sight?: number;
  sound?: number;
  light?: number;
}

interface Light {
  x: number;
  y: number;
  config: {
    dim: number;
    bright: number;
    color: string;
    alpha: number;
    animation?: { type: string; speed: number; intensity: number };
  };
}

function wall(x1: number, y1: number, x2: number, y2: number): Wall {
  return { c: [x1, y1, x2, y2], move: 20, sight: 20, sound: 20, light: 20 };
}

function door(x1: number, y1: number, x2: number, y2: number): Wall {
  return { c: [x1, y1, x2, y2], door: 1, ds: 0, move: 20, sight: 20, sound: 20, light: 20 };
}

/** Returns all corridors that touch a given room side, as [pos, length] pairs. */
function openingsOnSide(
  roomId: string,
  side: "top" | "bottom" | "left" | "right",
  graph: DungeonGraph,
  corridors: CorridorSegment[],
): Array<{ start: number; end: number; door: boolean }> {
  const room = graph.nodes.get(roomId);
  if (!room?.rect) return [];
  const r = room.rect;
  const openings: Array<{ start: number; end: number; door: boolean }> = [];
  for (const c of corridors) {
    if (c.from !== roomId && c.to !== roomId) continue;
    const facingRoom = c.from === roomId ? { x: c.ax, y: c.ay } : { x: c.bx, y: c.by };
    const width = 3;
    if (side === "right" && facingRoom.x === r.x + r.w) {
      const s = Math.max(r.y, facingRoom.y - width / 2);
      const e = Math.min(r.y + r.h, facingRoom.y + width / 2);
      if (e > s) openings.push({ start: s, end: e, door: c.hasDoor });
    } else if (side === "left" && facingRoom.x === r.x) {
      const s = Math.max(r.y, facingRoom.y - width / 2);
      const e = Math.min(r.y + r.h, facingRoom.y + width / 2);
      if (e > s) openings.push({ start: s, end: e, door: c.hasDoor });
    } else if (side === "bottom" && facingRoom.y === r.y + r.h) {
      const s = Math.max(r.x, facingRoom.x - width / 2);
      const e = Math.min(r.x + r.w, facingRoom.x + width / 2);
      if (e > s) openings.push({ start: s, end: e, door: c.hasDoor });
    } else if (side === "top" && facingRoom.y === r.y) {
      const s = Math.max(r.x, facingRoom.x - width / 2);
      const e = Math.min(r.x + r.w, facingRoom.x + width / 2);
      if (e > s) openings.push({ start: s, end: e, door: c.hasDoor });
    }
  }
  return openings.sort((a, b) => a.start - b.start);
}

function segmentSide(
  fixedCoord: number,
  varStart: number,
  varEnd: number,
  isHorizontal: boolean,
  openings: Array<{ start: number; end: number; door: boolean }>,
  gridPx: number,
): Wall[] {
  const walls: Wall[] = [];
  let cursor = varStart;
  for (const op of openings) {
    if (op.start > cursor) {
      walls.push(
        isHorizontal
          ? wall(cursor * gridPx, fixedCoord * gridPx, op.start * gridPx, fixedCoord * gridPx)
          : wall(fixedCoord * gridPx, cursor * gridPx, fixedCoord * gridPx, op.start * gridPx),
      );
    }
    walls.push(
      op.door
        ? isHorizontal
          ? door(op.start * gridPx, fixedCoord * gridPx, op.end * gridPx, fixedCoord * gridPx)
          : door(fixedCoord * gridPx, op.start * gridPx, fixedCoord * gridPx, op.end * gridPx)
        : (null as any),
    );
    if (!op.door) walls.pop();
    cursor = op.end;
  }
  if (cursor < varEnd) {
    walls.push(
      isHorizontal
        ? wall(cursor * gridPx, fixedCoord * gridPx, varEnd * gridPx, fixedCoord * gridPx)
        : wall(fixedCoord * gridPx, cursor * gridPx, fixedCoord * gridPx, varEnd * gridPx),
    );
  }
  return walls;
}

function corridorWalls(c: CorridorSegment, gridPx: number): Wall[] {
  const half = 1.5;
  const walls: Wall[] = [];
  if (c.ay === c.by) {
    const minX = Math.min(c.ax, c.bx);
    const maxX = Math.max(c.ax, c.bx);
    walls.push(wall(minX * gridPx, (c.ay - half) * gridPx, maxX * gridPx, (c.ay - half) * gridPx));
    walls.push(wall(minX * gridPx, (c.ay + half) * gridPx, maxX * gridPx, (c.ay + half) * gridPx));
  } else if (c.ax === c.bx) {
    const minY = Math.min(c.ay, c.by);
    const maxY = Math.max(c.ay, c.by);
    walls.push(wall((c.ax - half) * gridPx, minY * gridPx, (c.ax - half) * gridPx, maxY * gridPx));
    walls.push(wall((c.ax + half) * gridPx, minY * gridPx, (c.ax + half) * gridPx, maxY * gridPx));
  } else {
    const midX = c.bx;
    const minX = Math.min(c.ax, midX);
    const maxX = Math.max(c.ax, midX);
    walls.push(wall(minX * gridPx, (c.ay - half) * gridPx, (maxX + half) * gridPx, (c.ay - half) * gridPx));
    walls.push(wall(minX * gridPx, (c.ay + half) * gridPx, (maxX - half) * gridPx, (c.ay + half) * gridPx));
    const minY = Math.min(c.ay, c.by);
    const maxY = Math.max(c.ay, c.by);
    walls.push(wall((midX - half) * gridPx, (minY - half) * gridPx, (midX - half) * gridPx, maxY * gridPx));
    walls.push(wall((midX + half) * gridPx, (minY + half) * gridPx, (midX + half) * gridPx, maxY * gridPx));
  }
  return walls;
}

export function buildWallsAndDoors(
  graph: DungeonGraph,
  embed: EmbeddedDungeon,
  gridPx: number,
): Wall[] {
  const walls: Wall[] = [];
  for (const [id, node] of graph.nodes) {
    if (!node.rect) continue;
    const r = node.rect;
    walls.push(
      ...segmentSide(r.y, r.x, r.x + r.w, true, openingsOnSide(id, "top", graph, embed.corridors), gridPx),
      ...segmentSide(r.y + r.h, r.x, r.x + r.w, true, openingsOnSide(id, "bottom", graph, embed.corridors), gridPx),
      ...segmentSide(r.x, r.y, r.y + r.h, false, openingsOnSide(id, "left", graph, embed.corridors), gridPx),
      ...segmentSide(r.x + r.w, r.y, r.y + r.h, false, openingsOnSide(id, "right", graph, embed.corridors), gridPx),
    );
  }
  for (const c of embed.corridors) walls.push(...corridorWalls(c, gridPx));
  return walls;
}

export function buildLights(
  graph: DungeonGraph,
  _embed: EmbeddedDungeon,
  archetype: ArchetypeDef,
  lighting: Lighting,
  gridPx: number,
): Light[] {
  if (lighting === "well-lit") return [];
  const lights: Light[] = [];
  for (const node of graph.nodes.values()) {
    if (!node.rect) continue;
    if (lighting === "dark") continue;
    const cx = (node.rect.x + node.rect.w / 2) * gridPx;
    const cy = (node.rect.y + node.rect.h / 2) * gridPx;
    lights.push({
      x: cx,
      y: cy,
      config: {
        dim: Math.max(node.rect.w, node.rect.h) * 0.75 * gridPx / 100 * 5,
        bright: Math.min(node.rect.w, node.rect.h) * 0.5 * gridPx / 100 * 5,
        color: archetype.torchColor,
        alpha: 0.35,
        animation: { type: "torch", speed: 2, intensity: 3 },
      },
    });
  }
  return lights;
}
