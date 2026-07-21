/**
 * Place tokens for encounters and Loot Actors into the scene.
 * Respects PF2e creature size for token dimensions and clamps token
 * positions to interior room tiles (leaving a 1-tile buffer for walls).
 */
import type { DungeonPlan, RoomContent } from "../types.js";
import { MODULE_ID } from "../types.js";

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
      const col = Math.min(innerW - 1, Math.max(0, cx));
      const row = Math.min(innerH - 1, Math.max(0, cy));
      result[i] = [(innerX + col) * GRID_PX, (innerY + row) * GRID_PX];
      console.warn(
        `[dungeongen] Room too small to fit all tokens without overlap; overlapping placed near center.`,
      );
    }
  }

  for (const p of result) positions.push(p!);
  return positions;
}

async function makeLootActor(room: RoomContent): Promise<any | null> {
  if (!room.loot || (room.loot.items.length === 0 && room.loot.gp === 0)) return null;
  const items: any[] = [];
  for (const it of room.loot.items) {
    try {
      const src = await fromUuid(it.uuid);
      if (src) items.push(src.toObject());
    } catch {
      /* skip bad uuid */
    }
  }
  if (room.loot.gp > 0) {
    items.push({
      name: "Gold Pieces",
      type: "treasure",
      system: {
        quantity: room.loot.gp,
        price: { value: { gp: 1 } },
        stackGroup: "coins",
      },
    });
  }
  const data: any = {
    name: room.node.isBoss ? "Boss's Hoard" : room.loot.fromDefeated ? "Defeated Enemy's Cache" : "Treasure",
    type: "loot",
    system: {
      lootSheetType: "Merchant",
    },
    items,
  };
  const [created] = await Actor.createDocuments([data]);
  return created ?? null;
}

export async function placeTokens(plan: DungeonPlan, scene: any): Promise<void> {
  const tokens: any[] = [];

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
      }
      const positions = packTokens(r.x, r.y, r.w, r.h, sizes);
      for (let i = 0; i < actors.length; i++) {
        const size = sizes[i]!;
        const [px, py] = positions[i]!;
        const tokenSrc = await actors[i].getTokenDocument({
          x: px,
          y: py,
          width: size,
          height: size,
          hidden: false,
          disposition: -1,
          flags: { [MODULE_ID]: { roomId: room.node.id } },
        });
        tokens.push(tokenSrc.toObject());
      }
    }

    if (room.loot && (room.loot.items.length > 0 || room.loot.gp > 0)) {
      const lootActor = await makeLootActor(room);
      if (lootActor) {
        const lx = Math.min(r.x + r.w - 2, r.x + r.w - 1) * GRID_PX;
        const ly = Math.min(r.y + r.h - 2, r.y + r.h - 1) * GRID_PX;
        const tokenSrc = await lootActor.getTokenDocument({
          x: lx,
          y: ly,
          width: 1,
          height: 1,
          hidden: room.loot.fromDefeated,
          disposition: 0,
          flags: { [MODULE_ID]: { roomId: room.node.id } },
        });
        tokens.push(tokenSrc.toObject());
      }
    }

    if (room.hazard) {
      const hz = await importActor(room.hazard.uuid);
      if (hz) {
        const size = tileSizeForActor(hz);
        const cxTile = r.x + Math.floor((r.w - size) / 2);
        const cyTile = r.y + Math.floor((r.h - size) / 2);
        const tokenSrc = await hz.getTokenDocument({
          x: cxTile * GRID_PX,
          y: cyTile * GRID_PX,
          width: size,
          height: size,
          hidden: true,
          disposition: -1,
          flags: { [MODULE_ID]: { roomId: room.node.id } },
        });
        tokens.push(tokenSrc.toObject());
      }
    }
  }

  if (tokens.length > 0) {
    await scene.createEmbeddedDocuments("Token", tokens);
  }
}
