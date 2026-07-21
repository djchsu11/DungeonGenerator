import type { ArchetypeId } from "../types.js";

export interface ArchetypeDef {
  id: ArchetypeId;
  label: string;
  /** Which bundled seamless texture (in assets/textures) to use as the floor. */
  textureFile: string;
  /** Default lighting flavor when user picks "torchlit". */
  torchColor: string;
  /** Preferred hazard traits (soft filter). */
  hazardTraits: string[];
  /** Nouns/adjectives for prose generation. */
  wordBank: ArchetypeWords;
}

export interface ArchetypeWords {
  chamberNouns: string[];
  corridorNouns: string[];
  featureAdjectives: string[];
  wallAdjectives: string[];
  floorAdjectives: string[];
  smellNouns: string[];
  soundNouns: string[];
  featureDetails: string[];
  entranceDescriptions: string[];
  climaxDescriptions: string[];
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  cave: {
    id: "cave",
    label: "Cave",
    textureFile: "cave.png",
    torchColor: "#ffb56b",
    hazardTraits: ["environmental", "rockfall", "trap"],
    wordBank: {
      chamberNouns: ["cavern", "grotto", "hollow", "gallery", "vault", "chamber"],
      corridorNouns: ["passage", "crawlway", "tunnel", "cleft"],
      featureAdjectives: ["damp", "mossy", "jagged", "narrow", "cramped", "echoing"],
      wallAdjectives: ["dripping", "slick", "crystal-veined", "moss-covered", "sooty"],
      floorAdjectives: ["uneven", "slippery", "gravelly", "puddled", "littered with bones"],
      smellNouns: ["mildew", "damp earth", "old smoke", "bat guano"],
      soundNouns: ["dripping water", "distant echoes", "the flutter of unseen wings"],
      featureDetails: [
        "A shallow pool reflects the ceiling's teeth.",
        "Stalactites drip with slow purpose.",
        "A patch of luminous fungus glows faintly.",
        "Cracks in the wall exhale a cold breath.",
        "Old carvings, half-worn, mark the stone.",
      ],
      entranceDescriptions: [
        "The cavern mouth yawns wide, cool air spilling out to meet you.",
        "A narrow cleft in the hillside opens into darkness beyond.",
      ],
      climaxDescriptions: [
        "The cavern opens vast and terrible; something ancient claims this place.",
        "This chamber pulses with the presence of the deep's true master.",
      ],
    },
  },
  crypt: {
    id: "crypt",
    label: "Crypt",
    textureFile: "crypt.png",
    torchColor: "#7cd3ff",
    hazardTraits: ["magical", "curse", "trap"],
    wordBank: {
      chamberNouns: ["ossuary", "burial chamber", "mausoleum", "sanctum", "vault", "chapel"],
      corridorNouns: ["hallway", "gallery", "processional", "colonnade"],
      featureAdjectives: ["silent", "shadowed", "cold", "vaulted", "solemn"],
      wallAdjectives: ["cobwebbed", "moss-flecked", "carved with names", "cracked", "soot-stained"],
      floorAdjectives: ["dust-thick", "flagstoned", "littered with bones", "cracked", "swept clean"],
      smellNouns: ["dust", "old candle wax", "stale incense", "grave soil"],
      soundNouns: ["a distant sigh", "silence heavier than sound", "the click of settling stone"],
      featureDetails: [
        "Sarcophagi lie in silent rows.",
        "A guttered candle stump still holds a wick.",
        "A statue of a robed figure watches with worn eyes.",
        "Faded murals record a forgotten lineage.",
        "A single flower, impossibly fresh, rests on the floor.",
      ],
      entranceDescriptions: [
        "Weathered stone steps descend past a broken lintel into cold silence.",
        "A pair of iron-bound doors stand ajar, their carvings almost worn smooth.",
      ],
      climaxDescriptions: [
        "The great sepulcher stretches before you, its lord's rest disturbed.",
        "At the heart of the crypt, the honored dead are honored no longer.",
      ],
    },
  },
  fortress: {
    id: "fortress",
    label: "Ruined Fortress",
    textureFile: "fortress.png",
    torchColor: "#ffcf6b",
    hazardTraits: ["trap", "mechanical"],
    wordBank: {
      chamberNouns: ["barracks", "hall", "armory", "guard room", "keep", "solar"],
      corridorNouns: ["corridor", "hall", "gallery"],
      featureAdjectives: ["ruined", "scorched", "sturdy", "cold", "battle-scarred"],
      wallAdjectives: ["pockmarked", "banner-hung", "graffitied", "crumbling", "arrow-scored"],
      floorAdjectives: ["strewn with rushes", "blood-stained", "cracked flagstone", "littered with debris"],
      smellNouns: ["old smoke", "iron", "leather", "unwashed bodies"],
      soundNouns: ["distant hammering", "boots on stone", "a wind through broken shutters"],
      featureDetails: [
        "A shattered weapon rack lies against the wall.",
        "An old banner hangs, faded past recognition.",
        "A rough brazier still holds cold ash.",
        "A cot has been recently disturbed.",
        "A war-map is scrawled upon the floor.",
      ],
      entranceDescriptions: [
        "The gatehouse is half-collapsed but still holds its threat.",
        "A splintered portcullis frames the way in.",
      ],
      climaxDescriptions: [
        "The great hall is claimed by a new warlord — and their court.",
        "This throne room has known better rulers.",
      ],
    },
  },
  sewer: {
    id: "sewer",
    label: "Sewer",
    textureFile: "sewer.png",
    torchColor: "#a8ff8f",
    hazardTraits: ["disease", "environmental", "trap"],
    wordBank: {
      chamberNouns: ["cistern", "junction", "chamber", "outflow", "reservoir"],
      corridorNouns: ["tunnel", "conduit", "channel", "pipe"],
      featureAdjectives: ["dank", "reeking", "slime-coated", "flooded", "echoing"],
      wallAdjectives: ["slime-slick", "moss-eaten", "brickwork sagging", "mold-blackened"],
      floorAdjectives: ["ankle-deep in filth", "grated", "wet stone", "sludge-caked"],
      smellNouns: ["sewage", "rotting refuse", "chemical tang", "wet rot"],
      soundNouns: ["running water", "dripping", "the scuttle of rats", "distant splashing"],
      featureDetails: [
        "Rusted grates disgorge sluggish water.",
        "A tide-line of refuse marks the wall.",
        "Fungus blooms in unhealthy patches.",
        "Bones tangle in a heap of debris.",
      ],
      entranceDescriptions: [
        "A stinking iron grate has been pried aside.",
        "The tunnel mouth belches warm, fouled air.",
      ],
      climaxDescriptions: [
        "The great cistern lies beyond — and something has made it home.",
        "At the sewer's heart, a bloated presence rules its filth-court.",
      ],
    },
  },
  temple: {
    id: "temple",
    label: "Temple",
    textureFile: "temple.png",
    torchColor: "#c8a8ff",
    hazardTraits: ["magical", "curse", "trap"],
    wordBank: {
      chamberNouns: ["shrine", "sanctuary", "hall", "sacristy", "cloister", "reliquary"],
      corridorNouns: ["nave", "aisle", "hall", "processional"],
      featureAdjectives: ["hushed", "sacred", "defiled", "opulent", "cold"],
      wallAdjectives: ["frescoed", "gilt-worked", "smashed", "candle-blackened", "banner-hung"],
      floorAdjectives: ["mosaic-set", "polished stone", "dust-veiled", "blood-marked", "carpet-runnered"],
      smellNouns: ["incense", "melted wax", "ash", "old perfume"],
      soundNouns: ["a distant chant", "the trickle of a font", "wind through high arches"],
      featureDetails: [
        "An overturned altar rests amid shattered censers.",
        "A ruined mural depicts the god this place once served.",
        "Prayer beads litter the floor, snapped and scattered.",
        "A statue's face has been deliberately effaced.",
      ],
      entranceDescriptions: [
        "The temple doors, once grand, hang broken on their hinges.",
        "A porch of graven images opens onto the sanctum beyond.",
      ],
      climaxDescriptions: [
        "The inner sanctum burns with unholy purpose.",
        "The altar's new master waits for you here.",
      ],
    },
  },
  tower: {
    id: "tower",
    label: "Wizard's Tower",
    textureFile: "tower.png",
    torchColor: "#8fe0ff",
    hazardTraits: ["magical", "trap", "arcane"],
    wordBank: {
      chamberNouns: ["study", "laboratory", "conservatory", "orrery", "library", "workshop"],
      corridorNouns: ["stair", "spiral", "gallery", "hall"],
      featureAdjectives: ["cluttered", "arcane", "smoke-hazed", "orderly", "opulent"],
      wallAdjectives: ["shelved", "scroll-lined", "glyph-etched", "wood-paneled", "silver-inlaid"],
      floorAdjectives: ["chalk-scribed", "carpeted", "scorched", "runed", "polished"],
      smellNouns: ["ozone", "old ink", "burning herbs", "beeswax"],
      soundNouns: ["a low hum", "the clink of glass", "distant chanting", "clockwork ticking"],
      featureDetails: [
        "An orrery slowly turns without visible power.",
        "Spellbooks lie open, their pages fluttering by themselves.",
        "A summoning circle glows faintly, unused.",
        "Alchemical apparatus bubbles quietly.",
      ],
      entranceDescriptions: [
        "The tower door swings open of its own accord.",
        "An arch of glowing sigils marks the entrance.",
      ],
      climaxDescriptions: [
        "The master's sanctum crowns the tower — and they are home.",
        "The final laboratory hums with dangerous power.",
      ],
    },
  },
};

export function archetypeById(id: ArchetypeId): ArchetypeDef {
  return ARCHETYPES[id];
}

export const ARCHETYPE_LIST: ArchetypeDef[] = Object.values(ARCHETYPES);
