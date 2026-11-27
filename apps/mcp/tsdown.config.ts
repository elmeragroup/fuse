import { defineConfig } from "tsdown";

/**
 * Bundles the server and every dependency into one ESM file, `dist/main.mjs`. The image holds Node,
 * that file, `catalog.json` and `skills/`, and no `node_modules`.
 */
export default defineConfig({
  entry: { main: "src/main.ts" },
  outDir: "dist",
  format: "esm",
  platform: "node",
  target: "node26",
  deps: { alwaysBundle: [/.*/u], onlyBundle: false },
  dts: false,
  clean: true,
});
