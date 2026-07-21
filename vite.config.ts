import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "fs";

const moduleId = "dungeongen";

// Copy static assets (module.json, lang, templates, textures) into dist.
function copyStatic() {
  return {
    name: "copy-static",
    closeBundle() {
      const outDir = resolve(__dirname, "dist");
      mkdirSync(outDir, { recursive: true });

      copyFileSync(
        resolve(__dirname, "module.json"),
        resolve(outDir, "module.json"),
      );

      const copyTree = (from: string, to: string) => {
        if (!existsSync(from)) return;
        mkdirSync(to, { recursive: true });
        for (const entry of readdirSync(from, { withFileTypes: true })) {
          const src = resolve(from, entry.name);
          const dst = resolve(to, entry.name);
          if (entry.isDirectory()) copyTree(src, dst);
          else copyFileSync(src, dst);
        }
      };

      copyTree(resolve(__dirname, "src/lang"), resolve(outDir, "lang"));
      copyTree(
        resolve(__dirname, "src/ui/templates"),
        resolve(outDir, "templates"),
      );
      copyTree(
        resolve(__dirname, "src/assets/textures"),
        resolve(outDir, "assets/textures"),
      );

      const cssSrc = resolve(__dirname, "src/dungeongen.css");
      if (existsSync(cssSrc)) copyFileSync(cssSrc, resolve(outDir, "dungeongen.css"));
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/module.ts"),
      formats: ["es"],
      fileName: () => `${moduleId}.js`,
    },
    rollupOptions: {
      output: {
        assetFileNames: "[name][extname]",
        entryFileNames: `${moduleId}.js`,
      },
    },
  },
  plugins: [copyStatic()],
});
