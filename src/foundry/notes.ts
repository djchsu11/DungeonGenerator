/**
 * Place room-number map notes (pins) on the generated scene.
 *
 * Notes are hidden from players (`hidden: true`) so only the GM sees the
 * numbered pins. Each note links to the corresponding room page in the
 * dungeon's journal — clicking the pin opens that page.
 */
import type { DungeonPlan } from "../types.js";
import { MODULE_ID } from "../types.js";

const GRID_PX = 100;

export async function placeRoomNotes(
  plan: DungeonPlan,
  scene: any,
  journal: any,
): Promise<void> {
  if (!scene || !journal) return;

  const pages: any[] = Array.from(journal.pages?.contents ?? journal.pages ?? []);
  const pageByName: Map<string, any> = new Map();
  for (const p of pages) if (p?.name) pageByName.set(p.name, p);

  const notes: any[] = [];
  plan.rooms.forEach((room, i) => {
    if (!room.node.rect) return;
    const roomNumber = i + 1;
    const r = room.node.rect;
    const cx = (r.x + r.w / 2) * GRID_PX;
    const cy = (r.y + r.h / 2) * GRID_PX;

    const pageName = `Room ${roomNumber} — ${room.node.roomType}`;
    const page = pageByName.get(pageName);

    notes.push({
      x: cx,
      y: cy,
      entryId: journal.id,
      pageId: page?.id ?? null,
      text: String(roomNumber),
      icon: "icons/svg/circle.svg",
      iconSize: 40,
      iconTint: "#ffcc33",
      fontSize: 32,
      textAnchor: 2,
      textColor: "#ffffff",
      hidden: true,
      elevation: 0,
      flags: { [MODULE_ID]: { roomId: room.node.id, roomNumber } },
    });

    if (room.node.isEntrance) {
      notes.push({
        x: cx,
        y: cy - 60,
        entryId: journal.id,
        pageId: page?.id ?? null,
        text: "ENTRANCE",
        icon: "icons/svg/door-steel.svg",
        iconSize: 64,
        iconTint: "#66ff66",
        fontSize: 28,
        textAnchor: 1,
        textColor: "#ffffff",
        hidden: false,
        elevation: 0,
        flags: { [MODULE_ID]: { roomId: room.node.id, entrance: true } },
      });
    }
  });

  if (notes.length === 0) return;
  try {
    const created = await scene.createEmbeddedDocuments("Note", notes);
    console.info(`[${MODULE_ID}] Created ${created?.length ?? 0} room notes on scene ${scene?.id}.`);
  } catch (e) {
    console.error(`[${MODULE_ID}] scene.createEmbeddedDocuments('Note', ...) failed`, e);
  }
}
