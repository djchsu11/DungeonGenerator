/**
 * Inject a "Generate Dungeon" button into the Scenes directory sidebar.
 */
import { openDungeonModal } from "./modal.js";
import { MODULE_ID } from "../types.js";

export function registerSidebarButton(): void {
  Hooks.on("renderSceneDirectory", (_app: any, html: any) => {
    const $html = html?.[0] ? html : html.jquery ? html : null;
    const root: HTMLElement =
      $html?.[0] ??
      (html instanceof HTMLElement ? html : (html?.element as HTMLElement | undefined));
    if (!root) return;
    if (root.querySelector(`.${MODULE_ID}-generate-btn`)) return;

    const header = root.querySelector(".header-actions") ?? root.querySelector("header") ?? root;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${MODULE_ID}-generate-btn`;
    btn.innerHTML = `<i class="fa-solid fa-dungeon"></i> Generate Dungeon`;
    btn.style.marginTop = "4px";
    btn.style.width = "100%";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openDungeonModal();
    });
    header.appendChild(btn);
  });
}
