import type { PuzzleContent, Rng } from "../../types.js";
import { officialPuzzleProvider } from "./official.js";
import { templatedPuzzleProvider } from "./templated.js";
import type { PuzzleProvider } from "./provider.js";

const providers: PuzzleProvider[] = [officialPuzzleProvider, templatedPuzzleProvider];

export function registerProvider(p: PuzzleProvider): void {
  providers.push(p);
}

export function generatePuzzle(partyLevel: number, rng: Rng): PuzzleContent {
  const shuffled = rng.shuffle(providers);
  for (const p of shuffled) {
    const result = p.generate(partyLevel, rng);
    if (result) return result;
  }
  return {
    providerId: "fallback",
    title: "A Curious Contraption",
    readAloud:
      "A strange mechanism whirs in the center of the room, its purpose unclear. It responds to touch, but not obviously to any pattern.",
    gmNotes:
      "This is a placeholder puzzle. Choose an appropriate mechanic for your table (riddle, sequence, elemental balance) at your discretion.",
    level: partyLevel,
    dc: 15 + partyLevel,
    solutionSummary: "GM discretion.",
  };
}

export type { PuzzleProvider };
