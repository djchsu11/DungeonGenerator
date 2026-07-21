import { getPuzzles } from "../../pf2e/adapter.js";
import type { PuzzleContent, Rng } from "../../types.js";
import { standardDCForLevel, type PuzzleProvider } from "./provider.js";

/** Puzzle provider that draws from official PF2e system compendium puzzles. */
export const officialPuzzleProvider: PuzzleProvider = {
  id: "official",
  generate(partyLevel: number, rng: Rng): PuzzleContent | null {
    const all = getPuzzles();
    if (all.length === 0) return null;
    const inRange = all.filter((p) => Math.abs(p.level - partyLevel) <= 3);
    const pool = inRange.length > 0 ? inRange : all;
    const p = rng.pick(pool);
    return {
      providerId: "official",
      title: p.name,
      readAloud: `You come upon @UUID[${p.uuid}]{${p.name}}. Read its description from the linked hazard.`,
      gmNotes: `Puzzle drawn from ${p.source ?? "PF2e compendium"}. See the linked hazard for full mechanics.`,
      level: p.level,
      dc: standardDCForLevel(p.level),
      solutionSummary: "See official hazard entry.",
    };
  },
};
