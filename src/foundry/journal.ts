/**
 * Build the Journal folder for a generated dungeon:
 *   - Overview page (metadata + summary)
 *   - One page per room with prose, encounter links, hazards, loot, puzzles.
 */
import { archetypeById } from "../archetypes/index.js";
import type { DungeonPlan, RoomContent } from "../types.js";
import { MODULE_ID } from "../types.js";

function uuidLink(uuid: string, label?: string): string {
  return `@UUID[${uuid}]${label ? `{${label}}` : ""}`;
}

function roomIndexLabel(index: number): string {
  return `Room ${index + 1}`;
}

function encounterHtml(room: RoomContent): string {
  if (!room.encounter) return "";
  const rows = room.encounter.creatures
    .map((c) => `<tr><td>${uuidLink(c.uuid, c.name)}</td><td>${c.level}</td><td>${c.xp} XP</td></tr>`)
    .join("");
  return (
    `<h3>Encounter</h3>` +
    `<p><strong>Threat:</strong> ${room.encounter.threat} — <strong>XP:</strong> ${room.encounter.xpSpent} / ${room.encounter.xpBudget}</p>` +
    (room.encounter.bossName
      ? `<p><em>Named leader:</em> <strong>${room.encounter.bossName}</strong> — ${room.encounter.bossFeature ?? ""}</p>`
      : "") +
    `<table><thead><tr><th>Creature</th><th>Level</th><th>XP</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

function hazardHtml(room: RoomContent): string {
  if (!room.hazard) return "";
  return `<h3>Hazard</h3><p>${uuidLink(room.hazard.uuid, room.hazard.name)} — Level ${room.hazard.level}</p>`;
}

function puzzleHtml(room: RoomContent): string {
  if (!room.puzzle) return "";
  return (
    `<h3>Puzzle: ${room.puzzle.title}</h3>` +
    `<p><strong>DC ${room.puzzle.dc}</strong></p>` +
    `<p><em>GM notes:</em> ${room.puzzle.gmNotes}</p>` +
    `<p><em>Solution:</em> ${room.puzzle.solutionSummary}</p>`
  );
}

function lootHtml(room: RoomContent): string {
  if (!room.loot || (room.loot.items.length === 0 && room.loot.gp === 0)) return "";
  const items = room.loot.items
    .map((it) => `<li>${uuidLink(it.uuid, it.name)} (Level ${it.level}, ${it.category})</li>`)
    .join("");
  return (
    `<h3>Loot</h3>` +
    (room.loot.gp > 0 ? `<p><strong>${room.loot.gp} gp</strong></p>` : "") +
    (items ? `<ul>${items}</ul>` : "")
  );
}

function overviewHtml(plan: DungeonPlan): string {
  const arch = archetypeById(plan.input.archetype);
  const combatCount = plan.rooms.filter((r) => r.encounter).length;
  const hazardCount = plan.rooms.filter((r) => r.hazard).length;
  const puzzleCount = plan.rooms.filter((r) => r.puzzle).length;
  const lootCount = plan.rooms.filter((r) => r.loot).length;
  return (
    `<h1>${plan.name}</h1>` +
    `<p><strong>Archetype:</strong> ${arch.label} — <strong>Party level:</strong> ${plan.input.partyLevel} (party of ${plan.input.partySize}) — <strong>Size:</strong> ${plan.input.size}</p>` +
    (plan.input.familyId ? `<p><strong>Monster family:</strong> ${plan.input.familyId}</p>` : "") +
    `<h2>Summary</h2>` +
    `<ul>` +
    `<li>${plan.rooms.length} rooms total</li>` +
    `<li>${combatCount} combat encounters — ${plan.totalXp} total XP</li>` +
    `<li>${hazardCount} hazards, ${puzzleCount} puzzles</li>` +
    `<li>${lootCount} loot caches totaling ~${plan.totalLootGp} gp</li>` +
    `</ul>` +
    `<h2>Room Directory</h2>` +
    `<ol>` +
    plan.rooms
      .map(
        (r, i) =>
          `<li>${roomIndexLabel(i)}: ${r.node.roomType}${r.node.isBoss ? " (BOSS)" : r.node.isMiniBoss ? " (mini-boss)" : r.node.isEntrance ? " (entrance)" : ""}</li>`,
      )
      .join("") +
    `</ol>`
  );
}

function roomPageHtml(room: RoomContent, index: number): string {
  const flags: string[] = [];
  if (room.node.isEntrance) flags.push("Entrance");
  if (room.node.isBoss) flags.push("BOSS");
  if (room.node.isMiniBoss) flags.push("Mini-boss");
  if (room.node.isDeadEnd) flags.push("dead-end");
  const readAloudParts: string[] = [`<p><em>${room.readAloud}</em></p>`];
  if (room.puzzle?.readAloud) {
    readAloudParts.push(`<p><em>${room.puzzle.readAloud}</em></p>`);
  }
  return (
    `<h2>${roomIndexLabel(index)}${flags.length ? " — " + flags.join(", ") : ""}</h2>` +
    `<h3>Read-aloud</h3>${readAloudParts.join("")}` +
    encounterHtml(room) +
    hazardHtml(room) +
    puzzleHtml(room) +
    lootHtml(room) +
    `<h3>GM Notes</h3><p>${room.gmNotes}</p>`
  );
}

export async function buildJournal(plan: DungeonPlan, folder: any | null): Promise<any> {
  const pages: any[] = [
    {
      name: "Overview",
      type: "text",
      text: { content: overviewHtml(plan), format: 1 },
    },
    ...plan.rooms.map((room, i) => ({
      name: `${roomIndexLabel(i)} — ${room.node.roomType}`,
      type: "text",
      text: { content: roomPageHtml(room, i), format: 1 },
    })),
  ];
  const data: any = {
    name: plan.name,
    folder: folder?.id ?? null,
    pages,
    flags: { [MODULE_ID]: { version: 1 } },
  };
  const journal = await JournalEntry.create(data);
  return journal;
}
