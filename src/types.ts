export const MODULE_ID = "dungeongen";

export type DungeonSize = "small" | "medium" | "large" | "huge";
export type ArchetypeId =
  | "cave"
  | "crypt"
  | "fortress"
  | "sewer"
  | "temple"
  | "tower";
export type Lighting = "well-lit" | "torchlit" | "dark";
export type LootGenerosity = "stingy" | "standard" | "generous";
export type PuzzleDensity = "none" | "rare" | "normal" | "frequent";
export type RoomType =
  | "combat"
  | "puzzle"
  | "hazard"
  | "loot"
  | "empty"
  | "special";
export type Threat = "trivial" | "low" | "moderate" | "severe" | "extreme";

export interface GenerationInput {
  partyLevel: number;
  partySize?: number; // defaults to 4
  familyId?: string | null; // curated bundle id
  familyTraits?: string[]; // raw-trait fallback when no bundle chosen
  archetype?: ArchetypeId | null; // if omitted, inferred from family
  size: DungeonSize;
  lighting?: Lighting;
  lootGenerosity?: LootGenerosity;
  puzzleDensity?: PuzzleDensity;
  climaxThreat?: "severe" | "extreme";
  name?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DungeonNode {
  id: string;
  roomType: RoomType;
  depth: number; // 0 = entrance
  isBoss: boolean;
  isMiniBoss: boolean;
  isDeadEnd: boolean;
  isEntrance: boolean;
  threat?: Threat;
  rect?: Rect; // filled in after spatial embedding
}

export interface DungeonEdge {
  from: string;
  to: string;
  hasDoor: boolean;
}

export interface DungeonGraph {
  nodes: Map<string, DungeonNode>;
  edges: DungeonEdge[];
}

export interface EncounterCreatureSlot {
  uuid: string;
  name: string;
  level: number;
  xp: number; // cost against party
  sizeTiles: number; // 1 medium/small, 2 large, 3 huge, 4 gargantuan
}

export interface EncounterContent {
  threat: Threat;
  xpBudget: number;
  xpSpent: number;
  creatures: EncounterCreatureSlot[];
  bossName?: string; // for boss/mini-boss rooms
  bossFeature?: string;
}

export interface HazardContent {
  uuid: string;
  name: string;
  level: number;
}

export interface PuzzleContent {
  providerId: string;
  title: string;
  readAloud: string;
  gmNotes: string;
  level: number;
  dc: number;
  solutionSummary: string;
}

export interface LootItem {
  uuid: string;
  name: string;
  level: number;
  category: "permanent" | "consumable";
}

export interface LootContent {
  items: LootItem[];
  gp: number;
  fromDefeated: boolean; // dropped on monster vs in a chest
}

export interface RoomContent {
  node: DungeonNode;
  readAloud: string;
  gmNotes: string;
  encounter?: EncounterContent;
  hazard?: HazardContent;
  puzzle?: PuzzleContent;
  loot?: LootContent;
}

export interface DungeonPlan {
  name: string;
  input: Required<
    Omit<GenerationInput, "familyId" | "familyTraits" | "archetype" | "name">
  > & {
    familyId: string | null;
    familyTraits: string[];
    archetype: ArchetypeId;
    name: string;
  };
  graph: DungeonGraph;
  rooms: RoomContent[];
  totalXp: number;
  totalLootGp: number;
}

export interface Rng {
  next(): number; // [0,1)
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(items: readonly { value: T; weight: number }[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
}
