/**
 * Adapter over the installed `pf2e` system compendiums.
 *
 * Builds an in-memory index of creatures, hazards, and items on first use.
 * All queries return lightweight IndexEntry records; full documents can be
 * loaded lazily via `fromUuid(entry.uuid)` when we actually need to place them.
 */

export interface IndexEntry {
  uuid: string;
  name: string;
  level: number;
  traits: string[];
  rarity: "common" | "uncommon" | "rare" | "unique";
  source?: string;
  /** Creature/hazard/item type — free-form. */
  kind: string;
  /** Occupied tiles per side on a square grid (1 for medium/small/tiny). */
  sizeTiles: number;
}

interface Indexes {
  creatures: IndexEntry[];
  hazards: IndexEntry[];
  puzzles: IndexEntry[]; // subset of hazards with the "puzzle" trait
  items: IndexEntry[];
  goldCoinUuid: string | null;
  ready: boolean;
}

const state: Indexes = {
  creatures: [],
  hazards: [],
  puzzles: [],
  items: [],
  goldCoinUuid: null,
  ready: false,
};

function pf2eGame(): any {
  return typeof game !== "undefined" ? game : {};
}

/** Whether we're running inside a real Foundry client with pf2e loaded. */
export function isFoundryReady(): boolean {
  const g = pf2eGame();
  return !!(g && g.packs && g.system?.id === "pf2e");
}

async function loadPackIndex(packName: string): Promise<any[]> {
  const g = pf2eGame();
  const pack = g.packs?.get(packName);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({
      fields: ["system.details", "system.traits", "system.level", "system.category"],
    });
    return Array.from(idx.values());
  } catch (e) {
    console.warn(`[dungeongen] Failed to index pack ${packName}`, e);
    return [];
  }
}

const SIZE_TO_TILES: Record<string, number> = {
  tiny: 1,
  sm: 1,
  small: 1,
  med: 1,
  medium: 1,
  lg: 2,
  large: 2,
  huge: 3,
  grg: 4,
  gargantuan: 4,
};

function sizeTilesFor(raw: any, traits: string[]): number {
  const explicit = raw?.system?.traits?.size?.value;
  if (explicit && SIZE_TO_TILES[String(explicit).toLowerCase()]) {
    return SIZE_TO_TILES[String(explicit).toLowerCase()]!;
  }
  for (const key of Object.keys(SIZE_TO_TILES)) {
    if (traits.includes(key)) return SIZE_TO_TILES[key]!;
  }
  return 1;
}

function normalizeEntry(raw: any, packName: string): IndexEntry | null {
  if (!raw?.name) return null;
  const level =
    raw.system?.details?.level?.value ??
    raw.system?.level?.value ??
    raw.system?.level ??
    0;
  const traits: string[] =
    raw.system?.traits?.value ?? raw.system?.traits?.rarity ? [] : [];
  const traitList: string[] = Array.isArray(raw.system?.traits?.value)
    ? raw.system.traits.value.map((t: string) => String(t).toLowerCase())
    : [];
  const rarity = (raw.system?.traits?.rarity ?? "common") as IndexEntry["rarity"];
  const finalTraits = traitList.length ? traitList : traits;
  return {
    uuid: raw.uuid ?? `Compendium.${packName}.${raw._id}`,
    name: raw.name,
    level: Number(level) || 0,
    traits: finalTraits,
    rarity,
    source: packName,
    kind: raw.type ?? "",
    sizeTiles: sizeTilesFor(raw, finalTraits),
  };
}

async function buildIndex(): Promise<void> {
  const g = pf2eGame();
  if (!g?.packs) return;

  const creaturePacks: any[] = [];
  const hazardPacks: any[] = [];
  const itemPacks: any[] = [];

  for (const pack of g.packs.values()) {
    const docType = pack.metadata?.type ?? pack.documentName;
    const id: string = pack.metadata?.id ?? pack.collection ?? "";
    if (!id.startsWith("pf2e.")) continue;
    if (docType === "Actor" && (id.includes("bestiary") || id.includes("npc"))) creaturePacks.push(pack);
    else if (docType === "Actor" && id.includes("hazard")) hazardPacks.push(pack);
    else if (docType === "Item" && (id.includes("equipment") || id.includes("treasure") || id.includes("consumable"))) itemPacks.push(pack);
  }

  const creatures: IndexEntry[] = [];
  const hazards: IndexEntry[] = [];
  const items: IndexEntry[] = [];

  for (const pack of creaturePacks) {
    const raw = await loadPackIndex(pack.metadata.id);
    for (const r of raw) {
      const e = normalizeEntry(r, pack.metadata.id);
      if (e) creatures.push(e);
    }
  }
  for (const pack of hazardPacks) {
    const raw = await loadPackIndex(pack.metadata.id);
    for (const r of raw) {
      const e = normalizeEntry(r, pack.metadata.id);
      if (e) hazards.push(e);
    }
  }
  for (const pack of itemPacks) {
    const raw = await loadPackIndex(pack.metadata.id);
    for (const r of raw) {
      const e = normalizeEntry(r, pack.metadata.id);
      if (e) items.push(e);
    }
  }

  state.creatures = creatures;
  state.hazards = hazards;
  state.puzzles = hazards.filter((h) => h.traits.includes("puzzle"));
  state.items = items;
  const gold = items.find((it) => /^gold pieces?$/i.test(it.name));
  state.goldCoinUuid = gold?.uuid ?? null;
  state.ready = true;

  console.info(
    `[dungeongen] Indexed ${creatures.length} creatures, ${hazards.length} hazards ` +
      `(${state.puzzles.length} puzzles), ${items.length} items. gold=${state.goldCoinUuid ?? "not found"}`,
  );
}

let buildPromise: Promise<void> | null = null;
export async function ensureIndex(): Promise<void> {
  if (state.ready) return;
  if (!buildPromise) buildPromise = buildIndex();
  return buildPromise;
}

export function getCreatures(): readonly IndexEntry[] {
  return state.creatures;
}

export function getHazards(): readonly IndexEntry[] {
  return state.hazards;
}

export function getPuzzles(): readonly IndexEntry[] {
  return state.puzzles;
}

export function getItems(): readonly IndexEntry[] {
  return state.items;
}

/** UUID of the PF2e "Gold Pieces" treasure item, or null if not indexed yet. */
export function getGoldCoinUuid(): string | null {
  return state.goldCoinUuid;
}

/** For unit-test injection. */
export function _replaceIndexForTest(idx: Partial<Indexes>): void {
  Object.assign(state, idx, { ready: true });
}
