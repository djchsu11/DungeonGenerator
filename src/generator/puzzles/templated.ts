/**
 * Six procedural puzzle templates.
 * Each template picks parameters via the RNG and formats a puzzle description
 * with GM notes and a solution summary. DCs scale to party level.
 */
import type { PuzzleContent, Rng } from "../../types.js";
import { standardDCForLevel, type PuzzleProvider } from "./provider.js";

interface Template {
  id: string;
  title: string;
  generate(partyLevel: number, rng: Rng): { readAloud: string; gmNotes: string; solution: string };
}

const ELEMENTS = ["fire", "water", "earth", "air", "light", "shadow"];
const COLORS = ["red", "blue", "green", "yellow", "black", "white"];
const CREATURES_RIDDLE = ["a dragon", "a lich", "a beholder", "a phoenix", "a hydra"];
const RIDDLES: Array<{ q: string; a: string }> = [
  { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "an echo" },
  { q: "The more you take, the more you leave behind. What am I?", a: "footsteps" },
  { q: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?", a: "a map" },
  { q: "I have keys but no locks. I have space but no room. You can enter, but not go outside. What am I?", a: "a keyboard" },
  { q: "The more of me there is, the less you see. What am I?", a: "darkness" },
  { q: "I fly without wings, I cry without eyes. What am I?", a: "a cloud" },
  { q: "I'm tall when I'm young, and short when I'm old. What am I?", a: "a candle" },
];

const templates: Template[] = [
  {
    id: "riddle-door",
    title: "The Riddling Door",
    generate(_level, rng) {
      const r = rng.pick(RIDDLES);
      return {
        readAloud:
          `A heavy stone door bars the way. Carved into its face are words that seem to shift as you read them:\n\n"${r.q}"`,
        gmNotes:
          `The door opens when the correct answer is spoken aloud in Common. Speaking a wrong answer causes the door to spike ` +
          `outward for 2d6 force damage (basic Reflex save). A successful DC {DC} Society, Occultism, or Arcana check gives a hint.`,
        solution: r.a,
      };
    },
  },
  {
    id: "pressure-plate-sequence",
    title: "The Pressure Plate Sequence",
    generate(_level, rng) {
      const len = rng.int(4, 6);
      const seq = Array.from({ length: len }, () => rng.pick(COLORS));
      const clue = seq.slice(0, 2).join(", ") + ", ..., " + seq.slice(-1)[0];
      return {
        readAloud:
          `The floor is tiled with ${COLORS.length} colors of glazed stones. A row of dusty tiles is embedded in the wall — recently pressed. ` +
          `The wall panel shows: ${clue}. A locked chest stands against the far wall.`,
        gmNotes:
          `The sequence, in order, is: ${seq.join(" → ")}. Stepping on the correct sequence unlocks the chest. Wrong tiles trigger ` +
          `a 1st-level (or party-level appropriate) trap effect. A DC {DC} Perception spot check reveals the smudges suggesting order.`,
        solution: seq.join(" → "),
      };
    },
  },
  {
    id: "elemental-braziers",
    title: "The Elemental Braziers",
    generate(_level, rng) {
      const order = rng.shuffle(ELEMENTS).slice(0, 4);
      const clueLine = order.map((e, i) => `${i + 1}. ${e}`).join(", ");
      return {
        readAloud:
          `Four braziers, one for each of the classic elements, ring a stone door. Above them, faded text reads:\n` +
          `"As dawn to dusk, as breath to grave — light us in the way the world was made."`,
        gmNotes:
          `The correct lighting order is: ${clueLine}. When lit correctly the door opens; incorrect order deals ${
            "1d6"
          } damage of the wrongly-first element and extinguishes all braziers. DC {DC} Nature or Religion recognizes the order.`,
        solution: clueLine,
      };
    },
  },
  {
    id: "mirror-light-beam",
    title: "The Mirror Chamber",
    generate(_level, rng) {
      const mirrors = rng.int(3, 5);
      return {
        readAloud:
          `A single shaft of daylight (or magical light) enters through a slit high in the wall. ${mirrors} adjustable mirrors on pedestals ` +
          `stand around the room. A crystal receptacle in the far wall glows faintly, waiting.`,
        gmNotes:
          `Players must rotate mirrors to redirect the beam into the receptacle. Each mirror requires a DC 10 (or DC {DC} if precarious) ` +
          `check to adjust cleanly; a failure means a wasted turn. Solving opens the exit and reveals a treasure niche in the receptacle.`,
        solution: "Route the beam through all mirrors into the receptacle.",
      };
    },
  },
  {
    id: "weight-scale",
    title: "The Balance of Truth",
    generate(_level, rng) {
      const target = rng.int(3, 7);
      return {
        readAloud:
          `A great brass scale dominates the room. On one pan rests a heavy stone marked with the numeral ${target}. On the other, ` +
          `empty. Along the wall stand alcoves holding smaller weights of varied sizes.`,
        gmNotes:
          `Each weight has a numeric value 1-4 written faintly. Players must sum weights to exactly ${target}. On correct balance a hidden ` +
          `door opens. Placing an incorrect combination triggers a wave of force (DC {DC} basic Fortitude, ${
            "2d6"
          } bludgeoning). Multiple valid combinations exist.`,
        solution: `Place weights summing exactly to ${target}.`,
      };
    },
  },
  {
    id: "guardian-riddle",
    title: "The Guardian's Question",
    generate(_level, rng) {
      const guardian = rng.pick(CREATURES_RIDDLE);
      const r = rng.pick(RIDDLES);
      return {
        readAloud:
          `A stone statue of ${guardian} bars your path. Its jaw grinds open and, in a voice like grinding stone, it asks:\n\n` +
          `"${r.q}"`,
        gmNotes:
          `Correct answer: the guardian steps aside and remains dormant. Wrong answer: it attacks (use a construct or animated ` +
          `statue of party level as a mini-boss encounter). DC {DC} Occultism recalls the guardian's traditional riddles.`,
        solution: r.a,
      };
    },
  },
];

export const templatedPuzzleProvider: PuzzleProvider = {
  id: "templated",
  generate(partyLevel: number, rng: Rng): PuzzleContent {
    const dc = standardDCForLevel(partyLevel);
    const t = rng.pick(templates);
    const out = t.generate(partyLevel, rng);
    return {
      providerId: `templated:${t.id}`,
      title: t.title,
      readAloud: out.readAloud,
      gmNotes: out.gmNotes.replace(/\{DC\}/g, String(dc)),
      level: partyLevel,
      dc,
      solutionSummary: out.solution,
    };
  },
};
