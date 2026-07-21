import type { Rng } from "../types.js";

const ADJ = [
  "Whispering", "Sundered", "Forgotten", "Hollow", "Shattered", "Silent",
  "Bloodied", "Weeping", "Broken", "Cursed", "Sleeping", "Iron", "Fallen",
  "Shrouded", "Verdant", "Ashen", "Drowned", "Buried", "Restless", "Hungering",
];
const NOUN = [
  "Warrens", "Vault", "Depths", "Hollows", "Sepulcher", "Keep", "Sanctum",
  "Reach", "Deep", "Crypt", "Halls", "Undercroft", "Delve", "Barrows",
  "Catacomb", "Reliquary", "Foundry", "Tomb", "Wellspring", "Labyrinth",
];

export function generateDungeonName(rng: Rng): string {
  return `The ${rng.pick(ADJ)} ${rng.pick(NOUN)}`;
}
