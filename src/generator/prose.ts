/**
 * Prose builder: templated room descriptions from archetype word banks.
 */
import type { ArchetypeDef } from "../archetypes/index.js";
import type { DungeonNode, Rng, RoomType } from "../types.js";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sizeAdj(node: DungeonNode): string {
  if (!node.rect) return "modest";
  const area = node.rect.w * node.rect.h;
  if (area >= 100) return "cavernous";
  if (area >= 70) return "large";
  if (area >= 40) return "moderately sized";
  return "cramped";
}

export interface RoomProse {
  readAloud: string;
  gmNotes: string;
}

export function generateReadAloud(
  node: DungeonNode,
  roomType: RoomType,
  archetype: ArchetypeDef,
  rng: Rng,
): string {
  const wb = archetype.wordBank;
  if (node.isEntrance) {
    return rng.pick(wb.entranceDescriptions);
  }
  if (node.isBoss) {
    const climax = rng.pick(wb.climaxDescriptions);
    const detail = rng.pick(wb.featureDetails);
    return `${climax} ${detail}`;
  }

  const chamber = rng.pick(wb.chamberNouns);
  const size = sizeAdj(node);
  const wallAdj = rng.pick(wb.wallAdjectives);
  const floorAdj = rng.pick(wb.floorAdjectives);
  const smell = rng.pick(wb.smellNouns);
  const sound = rng.pick(wb.soundNouns);
  const detail = rng.pick(wb.featureDetails);

  const opener = rng.weighted([
    { weight: 3, value: `A ${size} ${chamber} opens before you.` },
    { weight: 2, value: `The ${chamber} beyond is ${size} and quiet.` },
    { weight: 2, value: `You step into a ${size} ${chamber}.` },
  ]);
  const sensory = rng.weighted([
    { weight: 2, value: `${cap(wallAdj)} walls rise above a ${floorAdj} floor.` },
    { weight: 2, value: `The floor is ${floorAdj}; the walls are ${wallAdj}.` },
    { weight: 1, value: `${cap(floorAdj)} underfoot, ${wallAdj} walls to either side.` },
  ]);
  const ambient = rng.weighted([
    { weight: 2, value: `The air carries the scent of ${smell}, and you hear ${sound}.` },
    { weight: 1, value: `You catch ${sound} on the still air, along with the smell of ${smell}.` },
    { weight: 1, value: `${cap(smell)} hangs on the air. ${cap(sound)} disturbs the silence.` },
  ]);

  let extra = "";
  if (roomType === "empty" || rng.chance(0.4)) extra = " " + detail;
  return `${opener} ${sensory} ${ambient}${extra}`;
}

export function generateGmNotes(
  roomType: RoomType,
  archetype: ArchetypeDef,
  _rng: Rng,
  extras: string[] = [],
): string {
  const parts: string[] = [];
  parts.push(`Archetype: ${archetype.label}. Room type: ${roomType}.`);
  if (extras.length) parts.push(...extras);
  return parts.join(" ");
}

const BOSS_ADJECTIVES = [
  "the Foul", "the Cruel", "the Ancient", "the Bloody", "the Sunken",
  "the Broken", "the Whispering", "the Wretched", "the Cursed", "the Deathless",
  "the Nine-Toed", "the Split-Tongued", "the Iron-Jawed",
];
const BOSS_FEATURES = [
  "a scar bisecting one eye",
  "a necklace of small yellowed teeth",
  "a badly-set broken nose",
  "hands stained with old dye",
  "unusually still, watchful eyes",
  "a persistent limp on the left",
  "an ornate but ill-fitting helm",
  "voice pitched too high for their frame",
  "a crude tattoo across one cheek",
  "a mane of matted, oiled hair",
];
const BOSS_NAMES_A = [
  "Zar", "Bal", "Mor", "Grim", "Karn", "Vos", "Xul", "Mal", "Dre", "Skarn", "Ur",
];
const BOSS_NAMES_B = [
  "grik", "thak", "goth", "vurk", "mesh", "trok", "shen", "vok", "gash", "ren",
];

export function generateBossIdentity(rng: Rng): { name: string; feature: string } {
  const name = `${rng.pick(BOSS_NAMES_A)}${rng.pick(BOSS_NAMES_B)} ${rng.pick(BOSS_ADJECTIVES)}`;
  const feature = rng.pick(BOSS_FEATURES);
  return { name, feature };
}
