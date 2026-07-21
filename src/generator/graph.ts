/**
 * Graph-seeded dungeon topology.
 *
 * Constructs a small graph shaped as:
 *   entrance → hub → [branch1, branch2, ...] → mini-boss? → boss
 * with dead-end side rooms hanging off branches for treasure/puzzles.
 *
 * Later, the spatial embedder places these nodes as rectangles on a grid.
 */
import type { DungeonEdge, DungeonGraph, DungeonNode, DungeonSize, Rng } from "../types.js";

interface SizeShape {
  minRooms: number;
  maxRooms: number;
  branches: [number, number]; // [min, max] top-level branches from hub
  hasMiniBoss: boolean;
}

const SIZE_SHAPES: Record<DungeonSize, SizeShape> = {
  small: { minRooms: 5, maxRooms: 8, branches: [2, 3], hasMiniBoss: false },
  medium: { minRooms: 10, maxRooms: 15, branches: [2, 4], hasMiniBoss: true },
  large: { minRooms: 18, maxRooms: 25, branches: [3, 5], hasMiniBoss: true },
  huge: { minRooms: 30, maxRooms: 40, branches: [4, 6], hasMiniBoss: true },
};

let idCounter = 0;
function nid(): string {
  idCounter += 1;
  return `r${idCounter}`;
}

function makeNode(depth: number): DungeonNode {
  return {
    id: nid(),
    roomType: "empty",
    depth,
    isBoss: false,
    isMiniBoss: false,
    isDeadEnd: false,
    isEntrance: false,
  };
}

export function generateGraph(size: DungeonSize, rng: Rng): DungeonGraph {
  idCounter = 0;
  const shape = SIZE_SHAPES[size];
  const target = rng.int(shape.minRooms, shape.maxRooms);

  const nodes = new Map<string, DungeonNode>();
  const edges: DungeonEdge[] = [];

  const addNode = (n: DungeonNode) => nodes.set(n.id, n);
  const addEdge = (from: string, to: string, hasDoor = true) =>
    edges.push({ from, to, hasDoor });

  const entrance = makeNode(0);
  entrance.isEntrance = true;
  addNode(entrance);

  const hub = makeNode(1);
  addNode(hub);
  addEdge(entrance.id, hub.id);

  const branchCount = rng.int(shape.branches[0], shape.branches[1]);
  const branches: string[][] = [];

  for (let b = 0; b < branchCount; b++) {
    const branchLen = Math.max(1, Math.floor((target - 2 - (shape.hasMiniBoss ? 2 : 1)) / branchCount));
    let prev = hub.id;
    const branch: string[] = [];
    for (let i = 0; i < branchLen; i++) {
      const n = makeNode(2 + i);
      addNode(n);
      addEdge(prev, n.id);
      branch.push(n.id);
      prev = n.id;
    }
    branches.push(branch);
  }

  const currentSize = nodes.size;
  const roomsLeft = target - currentSize - (shape.hasMiniBoss ? 2 : 1);

  for (let i = 0; i < roomsLeft; i++) {
    const branch = rng.pick(branches);
    const attachTo = rng.pick(branch);
    const side = makeNode((nodes.get(attachTo)?.depth ?? 2) + 1);
    side.isDeadEnd = true;
    addNode(side);
    addEdge(attachTo, side.id);
  }

  let bossPrev = hub.id;
  const deepestBranch = branches.reduce((a, b) => (a.length >= b.length ? a : b), branches[0]!);
  if (deepestBranch.length > 0) bossPrev = deepestBranch[deepestBranch.length - 1]!;

  if (shape.hasMiniBoss) {
    const mini = makeNode((nodes.get(bossPrev)?.depth ?? 2) + 1);
    mini.isMiniBoss = true;
    addNode(mini);
    addEdge(bossPrev, mini.id);
    bossPrev = mini.id;
  }

  const boss = makeNode((nodes.get(bossPrev)?.depth ?? 3) + 1);
  boss.isBoss = true;
  addNode(boss);
  addEdge(bossPrev, boss.id);

  if (nodes.size >= 8 && rng.chance(0.5)) {
    const candidates: DungeonNode[] = [];
    for (const n of nodes.values()) if (!n.isBoss && !n.isMiniBoss && !n.isEntrance && !n.isDeadEnd) candidates.push(n);
    if (candidates.length >= 2) {
      const a = rng.pick(candidates);
      const b = rng.pick(candidates.filter((c) => c.id !== a.id));
      if (b && !edges.some((e) => (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id))) {
        addEdge(a.id, b.id, false);
      }
    }
  }

  return { nodes, edges };
}
