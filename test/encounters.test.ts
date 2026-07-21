import { describe, it, expect } from "vitest";
import { creatureXp, encounterBudget } from "../src/pf2e/encounters";

describe("pf2e encounter math", () => {
  it("computes base budgets for a party of 4", () => {
    expect(encounterBudget("trivial", 4)).toBe(40);
    expect(encounterBudget("low", 4)).toBe(60);
    expect(encounterBudget("moderate", 4)).toBe(80);
    expect(encounterBudget("severe", 4)).toBe(120);
    expect(encounterBudget("extreme", 4)).toBe(160);
  });

  it("adjusts budgets for larger and smaller parties", () => {
    expect(encounterBudget("moderate", 5)).toBe(100);
    expect(encounterBudget("moderate", 3)).toBe(60);
    expect(encounterBudget("severe", 6)).toBe(180);
  });

  it("assigns creature XP by level offset", () => {
    expect(creatureXp(5, 5)).toBe(40);
    expect(creatureXp(6, 5)).toBe(60);
    expect(creatureXp(4, 5)).toBe(30);
    expect(creatureXp(9, 5)).toBe(160);
    expect(creatureXp(1, 5)).toBe(10);
  });

  it("returns null for creatures outside ±4", () => {
    expect(creatureXp(0, 5)).toBeNull();
    expect(creatureXp(10, 5)).toBeNull();
  });
});
