# Dungeon Generator for PF2e

A Foundry VTT module that generates full, playable dungeons for Pathfinder 2e.
Give it a party level, optionally a monster family and an environmental
archetype, and it produces a complete Foundry Scene with encounters, hazards,
puzzles, loot, and per-room journal entries — all sized to PF2e's encounter
and treasure math.

## Features (v0.1 MVP)

- **Party-level-aware encounters** using PF2e's XP budget rules (party of 4;
  fixed for MVP).
- **20 curated monster families** (Goblinoids, Undead Horde, Dragons, Fey
  Court, ...) plus raw-trait fallback.
- **6 environmental archetypes**: Cave, Crypt, Ruined Fortress, Sewer,
  Temple, Wizard's Tower — each with its own texture, hazard flavor, torch
  color, and word-bank prose.
- **Graph-seeded topology**: entrance → hub → branches → mini-boss → boss,
  with dead-end side rooms holding puzzles or treasure.
- **6 procedural puzzle templates** + official PF2e puzzle hazards.
- **PF2e-correct treasure** scaled to encounter count and generosity slider.
- **Procedural background PNGs** rendered at generation time from bundled
  seamless textures — masked to the floor polygon.
- **Full Foundry integration**: real Walls & Doors for LoS, ambient lights,
  Token placements, Loot Actors, per-room Journal pages.
- Access via **sidebar button**, **`/dungeon` chat command**, or the JS API
  `game.dungeongen.generate(...)`.

## Requirements

- Foundry VTT **v13**
- PF2e system **v6.0.0** or later

## Install

Copy this manifest URL into Foundry → *Add-on Modules → Install Module*:

```
https://github.com/dclark/DungeonGenerator/releases/latest/download/module.json
```

Also works on Forge via the same manifest URL.

## Usage

### From the sidebar

Open the *Scenes* directory → click **Generate Dungeon** → fill in the form
→ Generate.

### From chat

```
/dungeon --level 5 --family goblinoids --size medium
/dungeon --level 12 --family draconic --archetype cave --puzzles frequent
```

Run `/dungeon` alone (or `/dungeon help`) to open the modal.

### From macros / other modules

```js
const result = await game.dungeongen.generate({
  partyLevel: 4,
  familyId: "undead-horde",
  archetype: "crypt",
  size: "medium",
  puzzleDensity: "normal",
  lootGenerosity: "standard",
});
console.log(result.dungeonName, result.totalXp, "XP", result.totalGp, "gp");
```

## Development

```bash
npm install
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run lint         # eslint
npm run build        # emits ./dist
```

To develop against a local Foundry, symlink `dist/` into
`Data/modules/dungeongen/`, then `npm run dev` to auto-rebuild.

## License

MIT.

Includes no Paizo IP directly — all monster, hazard, and treasure data is
loaded at runtime from the installed [PF2e system](https://github.com/foundryvtt/pf2e).

## Roadmap (post-MVP)

- Loot filtering by monster family (goblin-themed magic items).
- Adjustable party size and "Export as Adventure" doc.
- Secret doors, custom seeded dungeons, save-as-preset.
- Multi-level megadungeons.
- Tile-based rendering + custom-tileset support.
- Non-rectangular rooms; per-archetype layout algorithms (BSP for crypts,
  cellular automata for caves).
