import type { Rng } from "./types.js";

/** Mulberry32 seeded PRNG. Fast, deterministic, small state. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed?: number): Rng {
  const s = seed ?? Math.floor(Math.random() * 0xffffffff);
  const next = mulberry32(s);
  const api: Rng = {
    next,
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error("pick from empty array");
      return arr[Math.floor(next() * arr.length)]!;
    },
    weighted<T>(items: readonly { value: T; weight: number }[]): T {
      if (items.length === 0) throw new Error("weighted pick from empty list");
      const total = items.reduce((acc: number, i) => acc + i.weight, 0);
      let r = next() * total;
      for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item.value;
      }
      return items[items.length - 1]!.value;
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    chance(p: number) {
      return next() < p;
    },
  };
  return api;
}
