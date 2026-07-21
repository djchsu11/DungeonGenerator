/**
 * Place tokens for encounters and Loot Actors into the scene.
 */
import type { DungeonPlan, RoomContent } from "../types.js";
import { MODULE_ID } from "../types.js";

const GRID_PX = 100;

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

function scatterPositions(count: number, cx: number, cy: number, w: number, h: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (count === 1) {
    out.push([cx, cy]);
    return out;
  }
  const radius = Math.min(w, h) * 0.3;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    out.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  return out;
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
    const cx = (r.x + r.w / 2) * GRID_PX;
    const cy = (r.y + r.h / 2) * GRID_PX;

    if (room.encounter && room.encounter.creatures.length > 0) {
      const positions = scatterPositions(room.encounter.creatures.length, cx, cy, r.w * GRID_PX, r.h * GRID_PX);
      for (let i = 0; i < room.encounter.creatures.length; i++) {
        const slot = room.encounter.creatures[i]!;
        const overrideName = i === 0 && room.encounter.bossName ? room.encounter.bossName : undefined;
        const actor = await importActor(slot.uuid, overrideName);
        if (!actor) continue;
        const tokenSrc = await actor.getTokenDocument({
          x: positions[i]![0] - GRID_PX / 2,
          y: positions[i]![1] - GRID_PX / 2,
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
        const tokenSrc = await lootActor.getTokenDocument({
          x: (r.x + r.w - 1) * GRID_PX,
          y: (r.y + r.h - 1) * GRID_PX,
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
        const tokenSrc = await hz.getTokenDocument({
          x: cx - GRID_PX / 2,
          y: cy - GRID_PX / 2,
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
