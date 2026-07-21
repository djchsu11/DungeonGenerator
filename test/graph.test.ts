import { describe, it, expect } from "vitest";
import { generateGraph } from "../src/generator/graph";
import { assignRoomTypes } from "../src/generator/rooms";
import { embedGraph } from "../src/generator/embed";
import { makeRng } from "../src/rng";

describe("dungeon graph", () => {
  it("produces the requested size range for each preset", () => {
    for (const size of ["small", "medium", "large", "huge"] as const) {
      const rng = makeRng(42);
      const g = generateGraph(size, rng);
      expect(g.nodes.size).toBeGreaterThan(0);
      const ranges = { small: [5, 10], medium: [10, 18], large: [18, 28], huge: [30, 45] };
      const [lo, hi] = ranges[size]!;
      expect(g.nodes.size).toBeGreaterThanOrEqual(lo);
      expect(g.nodes.size).toBeLessThanOrEqual(hi);
    }
  });

  it("has exactly one entrance and one boss", () => {
    const g = generateGraph("medium", makeRng(1));
    const nodes = [...g.nodes.values()];
    expect(nodes.filter((n) => n.isEntrance).length).toBe(1);
    expect(nodes.filter((n) => n.isBoss).length).toBe(1);
  });

  it("assigns room types respecting boss/entrance rules", () => {
    const rng = makeRng(7);
    const g = generateGraph("medium", rng);
    assignRoomTypes(g, "normal", rng);
    for (const n of g.nodes.values()) {
      if (n.isEntrance) expect(n.roomType).toBe("empty");
      if (n.isBoss || n.isMiniBoss) expect(n.roomType).toBe("combat");
    }
  });

  it("embeds rectangles without overlap for a medium dungeon", () => {
    const rng = makeRng(1234);
    const g = generateGraph("medium", rng);
    assignRoomTypes(g, "normal", rng);
    embedGraph(g, rng);
    const rects = [...g.nodes.values()].filter((n) => n.rect).map((n) => n.rect!);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = !(
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
        );
        expect(overlap).toBe(false);
      }
    }
  });
});
