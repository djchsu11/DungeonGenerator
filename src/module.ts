/**
 * Module entry point. Registers hooks, exposes the API on `game.dungeongen`,
 * and validates the pf2e system is loaded.
 */
import { api } from "./api.js";
import { registerSidebarButton } from "./ui/sidebar.js";
import { registerChatCommand } from "./ui/chat.js";
import { MODULE_ID } from "./types.js";
import { ensureIndex, isFoundryReady } from "./pf2e/adapter.js";

Hooks.once("init", () => {
  console.info(`[${MODULE_ID}] init`);
  try {
    if (typeof Handlebars !== "undefined" && !Handlebars.helpers?.eq) {
      Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
    }
  } catch (e) {
    console.warn(`[${MODULE_ID}] Could not register Handlebars helper`, e);
  }
  registerSidebarButton();
  registerChatCommand();
});

Hooks.once("ready", async () => {
  console.info(`[${MODULE_ID}] ready`);
  if (!isFoundryReady()) {
    console.warn(`[${MODULE_ID}] Foundry or PF2e system not detected; module inactive.`);
    return;
  }
  (game as any).dungeongen = api;
  try {
    await ensureIndex();
  } catch (e) {
    console.error(`[${MODULE_ID}] Failed to build compendium index`, e);
    ui?.notifications?.warn(
      "Dungeon Generator: failed to index PF2e compendiums. Generation may fail.",
    );
  }
});
