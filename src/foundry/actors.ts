/**
 * Place tokens for encounters and Loot Actors into the scene.
 * Respects PF2e creature size for token dimensions and clamps token
 * positions to interior room tiles (leaving a 1-tile buffer for walls).
 */
import type { DungeonPlan, RoomContent } from "../types.js";
import { MODULE_ID } from "../types.js";
import { getGoldCoinUuid } from "../pf2e/adapter.js";

const GRID_PX = 100;

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

function tileSizeForActor(actor: any): number {
  const raw = actor?.system?.traits?.size?.value ?? "med";
  return SIZE_TO_TILES[String(raw).toLowerCase()] ?? 1;
}

async function importActor(uuid: string, targetName?: string): Promise<any | null> {
  try {
    const src = await fromUuid(uuid);
    if (!src) return null;
    const data = src.toObject();
    if (targetName) data.name = targetName;
    const [created] = await Actor.createDocuments([data]);
    return created ?? null;
  } catch (e) {
    console.warn(`[dungeongen] Failed to import actor ${uuid}`, e);
    return null;
  }
}

/**
 * Allocate grid-aligned positions for tokens inside a room, honoring each
 * token's tile size. Returns positions in *pixels* aligned to the top-left
 * corner of each token. Positions are guaranteed to sit fully inside the
 * room's interior (1-tile buffer against walls). If not enough non-overlapping
 * slots exist for the requested sizes, remaining tokens are packed at the
 * last available slot (best-effort — GM can rearrange).
 */
function packTokens(
  roomX: number,
  roomY: number,
  roomW: number,
  roomH: number,
  sizes: number[],
): Array<[number, number]> {
  const buffer = 1;
  const innerX = roomX + buffer;
  const innerY = roomY + buffer;
  const innerW = Math.max(1, roomW - buffer * 2);
  const innerH = Math.max(1, roomH - buffer * 2);
  const occupied: boolean[][] = Array.from({ length: innerH }, () => Array(innerW).fill(false));
  const positions: Array<[number, number]> = [];

  const order = sizes.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const result: Array<[number, number] | null> = sizes.map(() => null);

  const tryPlaceAt = (col: number, row: number, size: number): boolean => {
    if (col + size > innerW || row + size > innerH) return false;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (occupied[row + dy]![col + dx]!) return false;
      }
    }
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        occupied[row + dy]![col + dx] = true;
      }
    }
    return true;
  };

  const spiralOrder: Array<[number, number]> = [];
  const cx = Math.floor(innerW / 2);
  const cy = Math.floor(innerH / 2);
  for (let r = 0; r <= Math.max(innerW, innerH); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = cx + dx;
        const y = cy + dy;
        if (c >= 0 && c < innerW && y >= 0 && y < innerH) {
          spiralOrder.push([c, y]);
        }
      }
    }
  }

  for (const { s, i } of order) {
    const size = Math.min(s, Math.min(innerW, innerH));
    let placed = false;
    for (const [col, row] of spiralOrder) {
      if (tryPlaceAt(col, row, size)) {
        result[i] = [(innerX + col) * GRID_PX, (innerY + row) * GRID_PX];
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Clamp fallback so the token FOOTPRINT (top-left + size) never
      // extends past the room's inner bounds. Overlap with another token
      // is acceptable; falling outside the room walls is not.
      const maxCol = Math.max(0, innerW - size);
      const maxRow = Math.max(0, innerH - size);
      const col = Math.min(maxCol, Math.max(0, cx - Math.floor(size / 2)));
      const row = Math.min(maxRow, Math.max(0, cy - Math.floor(size / 2)));
      result[i] = [(innerX + col) * GRID_PX, (innerY + row) * GRID_PX];
      console.warn(
        `[dungeongen] Room too small to fit all tokens without overlap; overlapping placed near center (clamped in-bounds).`,
      );
    }
  }

  for (const p of result) positions.push(p!);
  return positions;
}

function isMagicItem(obj: any): boolean {
  if (!obj) return false;
  if (obj.type === "treasure") return false;
  const traits: string[] = obj?.system?.traits?.value ?? [];
  return traits.includes("magical") || traits.includes("invested");
}

function markUnidentified(obj: any): void {
  if (!obj?.system) return;
  obj.system.identification = obj.system.identification ?? {};
  obj.system.identification.status = "unidentified";
  // PF2e populates default unidentified name/description from item type — no
  // need to override those; setting status alone is enough for the sheet to
  // display the item as "Unidentified Wand", "Unidentified Scroll", etc.
}

/**
 * Neutralize an item so it sits inertly in the loot pile: nothing worn,
 * nothing held, nothing invested, no active effects on the container.
 * Without this, PF2e will happily "apply" a +1 rune, invested runestone,
 * or bracers-of-armor rule element to the chest actor, causing the chest
 * to gain the item's benefits instead of simply containing the item.
 */
function makeInertLoot(obj: any): void {
  if (!obj) return;
  obj.system = obj.system ?? {};
  obj.system.equipped = obj.system.equipped ?? {};
  obj.system.equipped.carryType = "stowed";
  obj.system.equipped.handsHeld = 0;
  obj.system.equipped.invested = false;
  obj.system.equipped.inSlot = false;

  // Strip embedded ActiveEffects — Foundry auto-creates matching effects on
  // the parent actor when an item with effects is added, which is exactly
  // how the chest ends up gaining the item's status.
  obj.effects = [];

  // Some PF2e items (talismans, some consumables, granted-effect gear) ship
  // system-side flags that mark them as auto-applying. Clear the persistent
  // ones so the item stays a plain container payload.
  obj.flags = obj.flags ?? {};
  obj.flags.pf2e = obj.flags.pf2e = { ...(obj.flags.pf2e ?? {}) };
  delete obj.flags.pf2e.grantedBy;
  delete obj.flags.pf2e.itemGrants;
  delete obj.flags.pf2e.rulesSelections;

  // Weapon-specific: drop equipped/held state, unset any wielder-derived
  // properties like backstabber toggles.
  if (obj.type === "weapon" && obj.system) {
    obj.system.equipped.handsHeld = 0;
  }
  // Armor-specific: mark as unequipped (an equipped item auto-provides its
  // AC/traits to the actor).
  if (obj.type === "armor" && obj.system) {
    obj.system.equipped.inSlot = false;
  }
}

async function makeLootActor(room: RoomContent): Promise<any | null> {
  if (!room.loot || (room.loot.items.length === 0 && room.loot.gp === 0)) return null;
  const items: any[] = [];
  for (const it of room.loot.items) {
    try {
      const src = await fromUuid(it.uuid);
      if (src) {
        const obj = src.toObject();
        makeInertLoot(obj);
        if (isMagicItem(obj)) markUnidentified(obj);
        items.push(obj);
      }
    } catch {
      /* skip bad uuid */
    }
  }
  if (room.loot.gp > 0) {
    const goldUuid = getGoldCoinUuid();
    let added = false;
    if (goldUuid) {
      try {
        const goldSrc = await fromUuid(goldUuid);
        if (goldSrc) {
          const goldObj = goldSrc.toObject();
          if (goldObj.system) goldObj.system.quantity = room.loot.gp;
          makeInertLoot(goldObj);
          items.push(goldObj);
          added = true;
        }
      } catch (e) {
        console.warn(`[${MODULE_ID}] Failed to import Gold Pieces item ${goldUuid}`, e);
      }
    }
    if (!added) {
      items.push({
        name: "Gold Pieces",
        type: "treasure",
        system: {
          quantity: room.loot.gp,
          price: { value: { gp: 1 } },
          stackGroup: "coins",
          equipped: { carryType: "stowed", handsHeld: 0, invested: false, inSlot: false },
        },
      });
    }
  }
  const data: any = {
    name: room.node.isBoss ? "Boss's Hoard" : room.loot.fromDefeated ? "Defeated Enemy's Cache" : "Treasure",
    type: "loot",
    // "Loot" sheet type keeps the actor as a passive container — items are
    // listed for players to loot rather than being merchant inventory or
    // applied to the actor as a creature.
    system: {
      lootSheetType: "Loot",
    },
    items,
  };
  const [created] = await Actor.createDocuments([data]);
  return created ?? null;
}

export async function placeTokens(plan: DungeonPlan, scene: any): Promise<void> {
  const tokens: any[] = [];
  let importedCount = 0;
  let placementErrors = 0;

  for (const room of plan.rooms) {
    if (!room.node.rect) continue;
    const r = room.node.rect;

    if (room.encounter && room.encounter.creatures.length > 0) {
      const actors: any[] = [];
      const sizes: number[] = [];
      for (let i = 0; i < room.encounter.creatures.length; i++) {
        const slot = room.encounter.creatures[i]!;
        const overrideName = i === 0 && room.encounter.bossName ? room.encounter.bossName : undefined;
        const actor = await importActor(slot.uuid, overrideName);
        if (!actor) continue;
        actors.push(actor);
        sizes.push(tileSizeForActor(actor));
        importedCount++;
      }
      const positions = packTokens(r.x, r.y, r.w, r.h, sizes);
      for (let i = 0; i < actors.length; i++) {
        try {
          const size = sizes[i]!;
          const [px, py] = positions[i]!;
          const tokenObj = actors[i].prototypeToken.toObject();
          tokenObj.actorId = actors[i].id;
          tokenObj.x = px;
          tokenObj.y = py;
          tokenObj.width = size;
          tokenObj.height = size;
          tokenObj.hidden = false;
          tokenObj.disposition = -1;
          tokenObj.elevation = 0;
          tokenObj.name = actors[i].name ?? tokenObj.name;
          tokenObj.flags = { ...(tokenObj.flags ?? {}), [MODULE_ID]: { roomId: room.node.id } };
          tokens.push(tokenObj);
        } catch (e) {
          placementErrors++;
          console.error(`[${MODULE_ID}] Failed to build encounter token for ${actors[i]?.name}`, e);
        }
      }
    }

    if (room.loot && (room.loot.items.length > 0 || room.loot.gp > 0)) {
      try {
        const lootActor = await makeLootActor(room);
        if (lootActor) {
          const lx = Math.max(r.x + 1, r.x + r.w - 2) * GRID_PX;
          const ly = Math.max(r.y + 1, r.y + r.h - 2) * GRID_PX;
          const tokenObj = lootActor.prototypeToken.toObject();
          tokenObj.actorId = lootActor.id;
          tokenObj.x = lx;
          tokenObj.y = ly;
          tokenObj.width = 1;
          tokenObj.height = 1;
          tokenObj.hidden = true;
          tokenObj.disposition = 0;
          tokenObj.elevation = 0;
          tokenObj.name = lootActor.name;
          tokenObj.flags = { ...(tokenObj.flags ?? {}), [MODULE_ID]: { roomId: room.node.id } };
          tokens.push(tokenObj);
        }
      } catch (e) {
        placementErrors++;
        console.error(`[${MODULE_ID}] Failed to build loot token for room ${room.node.id}`, e);
      }
    }

    if (room.hazard) {
      try {
        const hz = await importActor(room.hazard.uuid);
        if (hz) {
          const size = tileSizeForActor(hz);
          const cxTile = r.x + Math.floor((r.w - size) / 2);
          const cyTile = r.y + Math.floor((r.h - size) / 2);
          const tokenObj = hz.prototypeToken.toObject();
          tokenObj.actorId = hz.id;
          tokenObj.x = cxTile * GRID_PX;
          tokenObj.y = cyTile * GRID_PX;
          tokenObj.width = size;
          tokenObj.height = size;
          tokenObj.hidden = true;
          tokenObj.disposition = -1;
          tokenObj.elevation = 0;
          tokenObj.name = hz.name;
          tokenObj.flags = { ...(tokenObj.flags ?? {}), [MODULE_ID]: { roomId: room.node.id } };
          tokens.push(tokenObj);
        }
      } catch (e) {
        placementErrors++;
        console.error(`[${MODULE_ID}] Failed to build hazard token for room ${room.node.id}`, e);
      }
    }
  }

  console.info(
    `[${MODULE_ID}] placeTokens: imported ${importedCount} actors, prepared ${tokens.length} tokens, ${placementErrors} errors.`,
  );
  if (tokens.length > 0) {
    try {
      const created = await scene.createEmbeddedDocuments("Token", tokens);
      console.info(`[${MODULE_ID}] Created ${created?.length ?? 0} tokens on scene ${scene?.id}.`);
    } catch (e) {
      console.error(`[${MODULE_ID}] scene.createEmbeddedDocuments('Token', ...) failed`, e, tokens);
    }
  }
}
