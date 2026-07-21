import type { ArchetypeId } from "../types.js";

/**
 * A "monster family" is a curated bundle of creature traits with an optional
 * default archetype. Users can also pick from the family list *or* type in
 * raw traits to fall back on.
 */
export interface FamilyBundle {
  id: string;
  label: string;
  /**
   * A creature is considered "in family" if it has at least one trait in this list.
   * ORed together.
   */
  includeTraits: string[];
  /** Optional traits that boost weight but aren't required. */
  boostTraits?: string[];
  /** Traits that disqualify a creature even if it matches includeTraits. */
  excludeTraits?: string[];
  /** Default archetype if the user doesn't pick one. */
  defaultArchetype?: ArchetypeId;
}

export const FAMILY_BUNDLES: FamilyBundle[] = [
  {
    id: "goblinoids",
    label: "Goblinoids",
    includeTraits: ["goblin", "hobgoblin", "bugbear"],
    boostTraits: ["dog"],
    defaultArchetype: "cave",
  },
  {
    id: "orcs",
    label: "Orcs & Half-Orcs",
    includeTraits: ["orc"],
    defaultArchetype: "fortress",
  },
  {
    id: "gnolls",
    label: "Gnolls",
    includeTraits: ["gnoll"],
    defaultArchetype: "cave",
  },
  {
    id: "kobolds",
    label: "Kobolds",
    includeTraits: ["kobold"],
    boostTraits: ["dragon"],
    defaultArchetype: "cave",
  },
  {
    id: "undead-horde",
    label: "Undead Horde",
    includeTraits: ["undead", "skeleton", "zombie", "ghoul"],
    defaultArchetype: "crypt",
  },
  {
    id: "vampires-and-ghosts",
    label: "Vampires & Ghosts",
    includeTraits: ["vampire", "ghost", "wraith", "spectre"],
    defaultArchetype: "crypt",
  },
  {
    id: "draconic",
    label: "Draconic Lair",
    includeTraits: ["dragon"],
    boostTraits: ["kobold", "reptile"],
    defaultArchetype: "cave",
  },
  {
    id: "fiendish-cult",
    label: "Fiendish Cult",
    includeTraits: ["fiend", "devil", "demon", "human"],
    boostTraits: ["cultist"],
    defaultArchetype: "temple",
  },
  {
    id: "aberrant-depths",
    label: "Aberrant Depths",
    includeTraits: ["aberration"],
    defaultArchetype: "cave",
  },
  {
    id: "fey-court",
    label: "Fey Court",
    includeTraits: ["fey", "sprite"],
    boostTraits: ["plant", "animal"],
    defaultArchetype: "temple",
  },
  {
    id: "elementals",
    label: "Elemental Fury",
    includeTraits: ["elemental", "fire", "water", "earth", "air"],
    defaultArchetype: "tower",
  },
  {
    id: "constructs",
    label: "Construct Workshop",
    includeTraits: ["construct"],
    defaultArchetype: "tower",
  },
  {
    id: "giants",
    label: "Giants & Ogres",
    includeTraits: ["giant", "ogre", "troll"],
    defaultArchetype: "fortress",
  },
  {
    id: "lizardfolk",
    label: "Lizardfolk & Reptiles",
    includeTraits: ["lizardfolk", "reptile", "serpentfolk"],
    defaultArchetype: "sewer",
  },
  {
    id: "duergar",
    label: "Duergar & Derro",
    includeTraits: ["duergar", "derro", "dwarf"],
    excludeTraits: ["good"],
    defaultArchetype: "fortress",
  },
  {
    id: "drow",
    label: "Drow",
    includeTraits: ["drow"],
    boostTraits: ["spider"],
    defaultArchetype: "temple",
  },
  {
    id: "beasts-wild",
    label: "Wild Beasts",
    includeTraits: ["beast", "animal"],
    defaultArchetype: "cave",
  },
  {
    id: "plants-fungi",
    label: "Plants & Fungi",
    includeTraits: ["plant", "fungus"],
    defaultArchetype: "cave",
  },
  {
    id: "oozes",
    label: "Oozes",
    includeTraits: ["ooze"],
    defaultArchetype: "sewer",
  },
];

export function findFamily(id: string | null | undefined): FamilyBundle | null {
  if (!id) return null;
  return FAMILY_BUNDLES.find((f) => f.id === id) ?? null;
}
