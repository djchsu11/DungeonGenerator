import { describe, it, expect } from "vitest";
import { _replaceIndexForTest } from "../src/pf2e/adapter";
import { buildEncounter } from "../src/generator/encounters";
import { makeFilter } from "../src/families/resolver";
import { findFamily } from "../src/families/bundles";
import { makeRng } from "../src/rng";

function fakeCreatures() {
  const build = (name: string, level: number, traits: string[]) => ({
    uuid: `Fake.${name}`,
    name,
    level,
    traits,
    rarity: "common" as const,
    kind: "npc",
  });
  return [
    build("Goblin Warrior", 1, ["goblin", "humanoid"]),
    build("Goblin Commando", 3, ["goblin", "humanoid"]),
    build("Hobgoblin Soldier", 1, ["hobgoblin", "humanoid"]),
    build("Bugbear Thug", 2, ["bugbear", "humanoid"]),
    build("Goblin Dog", 1, ["dog", "animal"]),
    build("Skeleton Guard", 2, ["undead", "skeleton"]),
    build("Zombie Shambler", 1, ["undead", "zombie"]),
    build("Ancient Red Dragon", 20, ["dragon", "chromatic"]),
  ];
}

describe("encounter builder", () => {
  it("only picks creatures matching the family bundle", () => {
    _replaceIndexForTest({ creatures: fakeCreatures() });
    const rng = makeRng(11);
    const bundle = findFamily("goblinoids")!;
    const filter = makeFilter(bundle, []);
    const enc = buildEncounter({
      threat: "moderate",
      partyLevel: 2,
      partySize: 4,
      filter,
      rng,
    });
    expect(enc.creatures.length).toBeGreaterThan(0);
    for (const c of enc.creatures) {
      expect(c.name).not.toBe("Skeleton Guard");
      expect(c.name).not.toBe("Zombie Shambler");
      expect(c.name).not.toBe("Ancient Red Dragon");
    }
  });

  it("stays within the XP budget", () => {
    _replaceIndexForTest({ creatures: fakeCreatures() });
    const rng = makeRng(22);
    const filter = makeFilter(null, []);
    const enc = buildEncounter({
      threat: "low",
      partyLevel: 2,
      partySize: 4,
      filter,
      rng,
    });
    expect(enc.xpSpent).toBeLessThanOrEqual(enc.xpBudget);
  });
});
