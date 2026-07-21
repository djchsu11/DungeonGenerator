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

export interface EncounterHint {
  /** Distinct creature entries grouped by name, in descending count order. */
  groups: Array<{ name: string; count: number }>;
}

export function generateReadAloud(
  node: DungeonNode,
  roomType: RoomType,
  archetype: ArchetypeDef,
  rng: Rng,
  encounter?: EncounterHint,
): string {
  const wb = archetype.wordBank;
  if (node.isEntrance) {
    const base = rng.pick(wb.entranceDescriptions);
    return `${base}\n\n**This is the party's entry point into the dungeon.**`;
  }
  if (node.isBoss) {
    const climax = rng.pick(wb.climaxDescriptions);
    const detail = rng.pick(wb.featureDetails);
    const enemyLine = encounter && encounter.groups.length > 0 ? " " + monsterHint(encounter, rng, true) : "";
    return `${climax} ${detail}${enemyLine}`;
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
  const enemyLine = encounter && encounter.groups.length > 0 ? " " + monsterHint(encounter, rng, false) : "";
  return `${opener} ${sensory} ${ambient}${extra}${enemyLine}`;
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function pluralize(name: string, count: number): string {
  if (count <= 1) return name;
  if (/s$/i.test(name)) return name;
  if (/(ch|sh|x|z)$/i.test(name)) return name + "es";
  if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + "ies";
  return name + "s";
}

function countPhrase(count: number, name: string): string {
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  if (count === 1) return `${articleFor(name)} ${name}`;
  const numWord = count >= 1 && count <= 10 ? words[count - 1]! : String(count);
  return `${numWord} ${pluralize(name, count)}`;
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function monsterHint(enc: EncounterHint, rng: Rng, boss: boolean): string {
  const phrases = enc.groups.map((g) => countPhrase(g.count, g.name.toLowerCase()));
  const listing = joinList(phrases);
  if (boss) {
    // Boss rooms hint at a leader without naming, then mention any minions.
    if (enc.groups.length === 1 && enc.groups[0]!.count === 1) {
      return rng.weighted([
        { weight: 2, value: `A commanding figure waits at the far end — plainly the master of this place.` },
        { weight: 2, value: `At the far end, a lone figure watches your approach.` },
        { weight: 1, value: `You are not alone: something large and deliberate stirs ahead.` },
      ]);
    }
    return rng.weighted([
      { weight: 2, value: `A commanding figure waits at the far end, flanked by ${listing}.` },
      { weight: 2, value: `The room's master watches from a raised spot; ${listing} stand ready around them.` },
      { weight: 1, value: `You are not alone: ${listing} guard a figure of clear authority.` },
    ]);
  }
  return rng.weighted([
    { weight: 3, value: `You spot ${listing} within.` },
    { weight: 2, value: `${cap(listing)} move in the gloom ahead.` },
    { weight: 2, value: `The room is not empty — ${listing} await.` },
    { weight: 1, value: `Something stirs: ${listing}.` },
  ]);
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
