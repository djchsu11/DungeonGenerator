/**
 * Spatial embedding: assign axis-aligned rectangles to graph nodes so that
 * connected nodes are near each other and no rooms overlap.
 *
 * Grid unit = 1 square = 100px = 5 ft.
 * All coordinates are in grid squares; the scene builder scales to pixels.
 */
import type { DungeonGraph, DungeonNode, Rect, Rng } from "../types.js";

const CORRIDOR_MIN = 3;
const CORRIDOR_MAX = 8;
const MARGIN = 1;

interface RoomSizeInput {
  partySize: number;
}

/**
 * Room dimensions in tiles. Combat rooms scale up with threat and party size
 * so there's actual tactical maneuvering space around the creatures — a
 * "just fits" room becomes a stand-and-swing brawl in play.
 */
function roomSizeFor(node: DungeonNode, rng: Rng, opts: RoomSizeInput): { w: number; h: number } {
  const partyBonus = Math.max(0, opts.partySize - 4); // extra tiles per direction

  if (node.isEntrance) {
    return { w: rng.int(5, 7) + partyBonus, h: rng.int(5, 7) + partyBonus };
  }

  // Boss climax: needs a real arena — room for large/huge boss + minions + party.
  if (node.isBoss) {
    const threat = node.threat ?? "severe";
    const base = threat === "extreme" ? 14 : 12;
    return {
      w: rng.int(base, base + 4) + partyBonus,
      h: rng.int(base, base + 4) + partyBonus,
    };
  }

  if (node.isMiniBoss) {
    return { w: rng.int(10, 13) + partyBonus, h: rng.int(10, 13) + partyBonus };
  }

  // Combat rooms scale by threat so a severe encounter isn't crammed into
  // a 5x5 broom closet.
  if (node.roomType === "combat") {
    const threat = node.threat ?? "moderate";
    const rangeByThreat: Record<string, [number, number]> = {
      trivial: [6, 8],
      low: [7, 9],
      moderate: [8, 11],
      severe: [10, 13],
      extreme: [12, 15],
    };
    const [min, max] = rangeByThreat[threat] ?? [8, 11];
    return { w: rng.int(min, max) + partyBonus, h: rng.int(min, max) + partyBonus };
  }

  // Non-combat rooms stay compact.
  if (node.isDeadEnd) return { w: rng.int(4, 7), h: rng.int(4, 7) };
  if (node.roomType === "puzzle") return { w: rng.int(6, 9), h: rng.int(6, 9) };
  if (node.roomType === "hazard") return { w: rng.int(6, 9), h: rng.int(6, 9) };
  if (node.roomType === "loot") return { w: rng.int(5, 8), h: rng.int(5, 8) };
  return { w: rng.int(5, 8), h: rng.int(5, 8) };
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w + MARGIN <= b.x ||
    b.x + b.w + MARGIN <= a.x ||
    a.y + a.h + MARGIN <= b.y ||
    b.y + b.h + MARGIN <= a.y
  );
}

function anyOverlap(candidate: Rect, placed: Rect[]): boolean {
  for (const p of placed) if (rectsOverlap(candidate, p)) return true;
  return false;
}

/** Try to place `node` adjacent to `anchor`; return the placed rect or null. */
function tryPlaceAdjacent(
  anchor: Rect,
  size: { w: number; h: number },
  placed: Rect[],
  rng: Rng,
): { rect: Rect; dir: [number, number]; corridorLen: number } | null {
  const dirs = rng.shuffle(DIRS);
  for (const dir of dirs) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const corridorLen = rng.int(CORRIDOR_MIN, CORRIDOR_MAX);
      let x = anchor.x;
      let y = anchor.y;
      if (dir[0] === 1) {
        x = anchor.x + anchor.w + corridorLen;
        y = anchor.y + rng.int(-1, Math.max(-1, anchor.h - size.h + 1));
      } else if (dir[0] === -1) {
        x = anchor.x - size.w - corridorLen;
        y = anchor.y + rng.int(-1, Math.max(-1, anchor.h - size.h + 1));
      } else if (dir[1] === 1) {
        x = anchor.x + rng.int(-1, Math.max(-1, anchor.w - size.w + 1));
        y = anchor.y + anchor.h + corridorLen;
      } else {
        x = anchor.x + rng.int(-1, Math.max(-1, anchor.w - size.w + 1));
        y = anchor.y - size.h - corridorLen;
      }
      const rect: Rect = { x, y, w: size.w, h: size.h };
      if (!anyOverlap(rect, placed)) return { rect, dir, corridorLen };
    }
  }
  return null;
}

export interface CorridorSegment {
  from: string;
  to: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** true if this connection includes a door door segment. */
  hasDoor: boolean;
}

export interface EmbeddedDungeon {
  bounds: Rect;
  corridors: CorridorSegment[];
}

/** Assigns rects to each node in-place and returns corridor segments + bounds. */
export function embedGraph(graph: DungeonGraph, rng: Rng, opts: { partySize: number }): EmbeddedDungeon {
  const placed: Rect[] = [];
  const corridors: CorridorSegment[] = [];

  const order = topologicalOrder(graph);

  const entrance = graph.nodes.get(order[0]!)!;
  const eSize = roomSizeFor(entrance, rng, opts);
  entrance.rect = { x: 0, y: 0, w: eSize.w, h: eSize.h };
  placed.push(entrance.rect);

  for (let i = 1; i < order.length; i++) {
    const node = graph.nodes.get(order[i]!)!;
    const parentEdge = graph.edges.find((e) => e.to === node.id) ?? graph.edges.find((e) => e.from === node.id);
    if (!parentEdge) continue;
    const parentId = parentEdge.to === node.id ? parentEdge.from : parentEdge.to;
    const parent = graph.nodes.get(parentId)!;
    if (!parent.rect) continue;

    const size = roomSizeFor(node, rng, opts);
    let placement = tryPlaceAdjacent(parent.rect, size, placed, rng);
    if (!placement) {
      const size2 = { w: Math.max(3, size.w - 2), h: Math.max(3, size.h - 2) };
      placement = tryPlaceAdjacent(parent.rect, size2, placed, rng);
    }
    if (!placement) {
      const anchorNodes = order.slice(0, i).map((id) => graph.nodes.get(id)!).filter((n) => n.rect);
      for (const anchor of rng.shuffle(anchorNodes)) {
        placement = tryPlaceAdjacent(anchor.rect!, size, placed, rng);
        if (placement) break;
      }
    }
    if (!placement) continue;

    node.rect = placement.rect;
    placed.push(node.rect);

    corridors.push(
      corridorBetween(parent, node, placement.dir, parentEdge.hasDoor),
    );
  }

  for (const edge of graph.edges) {
    if (corridors.some((c) => (c.from === edge.from && c.to === edge.to) || (c.from === edge.to && c.to === edge.from))) continue;
    const a = graph.nodes.get(edge.from)!;
    const b = graph.nodes.get(edge.to)!;
    if (!a.rect || !b.rect) continue;
    const dir = pickDirection(a.rect, b.rect);
    corridors.push(corridorBetween(a, b, dir, edge.hasDoor));
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of graph.nodes.values()) {
    if (!n.rect) continue;
    if (n.rect.x < minX) minX = n.rect.x;
    if (n.rect.y < minY) minY = n.rect.y;
    if (n.rect.x + n.rect.w > maxX) maxX = n.rect.x + n.rect.w;
    if (n.rect.y + n.rect.h > maxY) maxY = n.rect.y + n.rect.h;
  }
  const pad = 3;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;

  for (const n of graph.nodes.values()) {
    if (n.rect) {
      n.rect.x -= minX;
      n.rect.y -= minY;
    }
  }
  for (const c of corridors) {
    c.ax -= minX; c.bx -= minX;
    c.ay -= minY; c.by -= minY;
  }
  const bounds: Rect = { x: 0, y: 0, w: maxX - minX, h: maxY - minY };
  return { bounds, corridors };
}

function pickDirection(a: Rect, b: Rect): [number, number] {
  const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
  const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [1, 0] : [-1, 0];
  return dy >= 0 ? [0, 1] : [0, -1];
}

function corridorBetween(
  a: DungeonNode,
  b: DungeonNode,
  dir: [number, number],
  hasDoor: boolean,
): CorridorSegment {
  const ar = a.rect!;
  const br = b.rect!;
  let ax: number, ay: number, bx: number, by: number;
  if (dir[0] === 1) {
    ax = ar.x + ar.w;
    ay = ar.y + Math.floor(ar.h / 2);
    bx = br.x;
    by = br.y + Math.floor(br.h / 2);
  } else if (dir[0] === -1) {
    ax = ar.x;
    ay = ar.y + Math.floor(ar.h / 2);
    bx = br.x + br.w;
    by = br.y + Math.floor(br.h / 2);
  } else if (dir[1] === 1) {
    ax = ar.x + Math.floor(ar.w / 2);
    ay = ar.y + ar.h;
    bx = br.x + Math.floor(br.w / 2);
    by = br.y;
  } else {
    ax = ar.x + Math.floor(ar.w / 2);
    ay = ar.y;
    bx = br.x + Math.floor(br.w / 2);
    by = br.y + br.h;
  }
  return { from: a.id, to: b.id, ax, ay, bx, by, hasDoor };
}

function topologicalOrder(graph: DungeonGraph): string[] {
  const start = [...graph.nodes.values()].find((n) => n.isEntrance);
  if (!start) return [...graph.nodes.keys()];
  const seen = new Set<string>();
  const order: string[] = [];
  const stack: string[] = [start.id];
  while (stack.length) {
    const id = stack.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const e of graph.edges) {
      if (e.from === id && !seen.has(e.to)) stack.push(e.to);
      if (e.to === id && !seen.has(e.from)) stack.push(e.from);
    }
  }
  for (const id of graph.nodes.keys()) if (!seen.has(id)) order.push(id);
  return order;
}
