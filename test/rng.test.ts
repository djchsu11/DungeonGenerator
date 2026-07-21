import { describe, it, expect } from "vitest";
import { makeRng } from "../src/rng";

describe("rng", () => {
  it("is deterministic given a seed", () => {
    const a = makeRng(1234);
    const b = makeRng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBeCloseTo(b.next(), 10);
  });

  it("int stays within bounds", () => {
    const r = makeRng(1);
    for (let i = 0; i < 1000; i++) {
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("pick returns an element", () => {
    const r = makeRng(2);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it("weighted respects weights loosely", () => {
    const r = makeRng(3);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i++) {
      const v = r.weighted([
        { value: "a" as const, weight: 1 },
        { value: "b" as const, weight: 9 },
      ]);
      counts[v]++;
    }
    expect(counts.b).toBeGreaterThan(counts.a * 4);
  });

  it("shuffle preserves elements", () => {
    const r = makeRng(4);
    const arr = [1, 2, 3, 4, 5];
    const s = r.shuffle(arr).sort();
    expect(s).toEqual(arr);
  });
});
