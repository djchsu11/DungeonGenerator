/**
 * Chat command: /dungeon --level 5 --family goblin --size medium
 * Parsed loosely; falls back to opening the modal if arguments look wrong.
 */
import { openDungeonModal } from "./modal.js";
import { generate } from "../api.js";
import type { GenerationInput } from "../types.js";

function parseArgs(cmd: string): Partial<GenerationInput> {
  const out: Partial<GenerationInput> = {};
  const tokens = cmd.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (!t.startsWith("--")) continue;
    const key = t.slice(2);
    const val = tokens[i + 1];
    if (!val || val.startsWith("--")) continue;
    switch (key) {
      case "level":
        out.partyLevel = Number(val);
        break;
      case "family":
        out.familyId = val;
        break;
      case "archetype":
        out.archetype = val as any;
        break;
      case "size":
        out.size = val as any;
        break;
      case "lighting":
        out.lighting = val as any;
        break;
      case "loot":
        out.lootGenerosity = val as any;
        break;
      case "puzzles":
        out.puzzleDensity = val as any;
        break;
      case "climax":
        out.climaxThreat = val as any;
        break;
      case "name":
        out.name = val;
        break;
    }
    i++;
  }
  return out;
}

export function registerChatCommand(): void {
  Hooks.on("chatMessage", (_chatLog: any, message: string) => {
    const m = message.trim();
    if (!m.startsWith("/dungeon")) return true;
    const rest = m.slice("/dungeon".length).trim();
    if (rest === "" || rest === "help") {
      openDungeonModal();
      return false;
    }
    const parsed = parseArgs(rest);
    if (!parsed.partyLevel) {
      ui.notifications?.warn("Usage: /dungeon --level <n> [--family <id>] [--size small|medium|large|huge]");
      return false;
    }
    const input: GenerationInput = {
      partyLevel: parsed.partyLevel,
      size: parsed.size ?? "medium",
      familyId: parsed.familyId ?? null,
      familyTraits: [],
      archetype: parsed.archetype ?? null,
      lighting: parsed.lighting ?? "torchlit",
      lootGenerosity: parsed.lootGenerosity ?? "standard",
      puzzleDensity: parsed.puzzleDensity ?? "normal",
      climaxThreat: parsed.climaxThreat ?? "severe",
      name: parsed.name,
    };
    generate(input).catch((err) => {
      console.error("[dungeongen] Chat generation failed", err);
      ui.notifications?.error(`Dungeon generation failed: ${err.message ?? String(err)}`);
    });
    return false;
  });
}
