/**
 * ApplicationV2 modal for triggering dungeon generation.
 */
import { ARCHETYPE_LIST } from "../archetypes/index.js";
import { FAMILY_BUNDLES } from "../families/bundles.js";
import { generate } from "../api.js";
import type { GenerationInput } from "../types.js";
import { MODULE_ID } from "../types.js";

declare const foundry: any;

export function openDungeonModal(): void {
  const AppV2 = foundry.applications.api.ApplicationV2;
  const HandlebarsMixin = foundry.applications.api.HandlebarsApplicationMixin;

  class DungeonGenApp extends HandlebarsMixin(AppV2) {
    static DEFAULT_OPTIONS = {
      id: `${MODULE_ID}-modal`,
      tag: "form",
      window: {
        title: "Generate Dungeon (PF2e)",
        icon: "fa-solid fa-dungeon",
        resizable: false,
      },
      position: { width: 480, height: "auto" as const },
      form: {
        handler: DungeonGenApp.onSubmit,
        submitOnChange: false,
        closeOnSubmit: true,
      },
    };

    static PARTS = {
      form: { template: `modules/${MODULE_ID}/templates/dungeon-form.hbs` },
    };

    async _prepareContext(): Promise<any> {
      return {
        moduleId: MODULE_ID,
        families: FAMILY_BUNDLES,
        archetypes: ARCHETYPE_LIST,
        sizes: [
          { id: "small", label: "Small (5-8 rooms)" },
          { id: "medium", label: "Medium (10-15 rooms)" },
          { id: "large", label: "Large (18-25 rooms)" },
          { id: "huge", label: "Huge (30+ rooms)" },
        ],
        lightings: [
          { id: "well-lit", label: "Well-lit" },
          { id: "torchlit", label: "Torchlit (default)" },
          { id: "dark", label: "Dark" },
        ],
        generosity: [
          { id: "stingy", label: "Stingy" },
          { id: "standard", label: "Standard (default)" },
          { id: "generous", label: "Generous" },
        ],
        puzzleDensity: [
          { id: "none", label: "None" },
          { id: "rare", label: "Rare" },
          { id: "normal", label: "Normal (default)" },
          { id: "frequent", label: "Frequent" },
        ],
        climax: [
          { id: "severe", label: "Severe (default)" },
          { id: "extreme", label: "Extreme (hard mode)" },
        ],
      };
    }

    static async onSubmit(this: any, _event: Event, _form: HTMLFormElement, formData: any): Promise<void> {
      const data = formData.object as Record<string, string>;
      const rawTraits = (data.familyTraits || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const input: GenerationInput = {
        partyLevel: Number(data.partyLevel) || 1,
        partySize: 4,
        familyId: data.familyId || null,
        familyTraits: rawTraits,
        archetype: (data.archetype as any) || null,
        size: (data.size as any) || "medium",
        lighting: (data.lighting as any) || "torchlit",
        lootGenerosity: (data.lootGenerosity as any) || "standard",
        puzzleDensity: (data.puzzleDensity as any) || "normal",
        climaxThreat: (data.climaxThreat as any) || "severe",
        name: data.name?.trim() || undefined,
      };
      try {
        const result = await generate(input);
        ui.notifications?.info(`Generated "${result.dungeonName}" — ${result.totalXp} XP, ${result.totalGp} gp.`);
      } catch (err: any) {
        console.error("[dungeongen] Generation failed", err);
        ui.notifications?.error(`Dungeon generation failed: ${err.message ?? String(err)}`);
      }
    }
  }

  new DungeonGenApp().render(true);
}
