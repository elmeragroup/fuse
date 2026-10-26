import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";

import { entries } from "./scripts/entries.ts";

export default defineConfig({
  entry: entries.sourceFiles,
  root: "src",
  outDir: "dist",
  format: "esm",
  platform: "browser",
  unbundle: true,
  // rolldown-plugin-dts starts tsrs as the API server behind the `typescript` 7.1 client, so
  // tsrs emits Fuse's declarations.
  dts: { tsgo: { path: fileURLToPath(new URL("node_modules/.bin/tsrs", import.meta.url)) } },
  clean: true,
  sourcemap: true,
  // Keep validateTheme's runtime NODE_ENV branch.
  define: {
    "process.env.NODE_ENV": "process.env.NODE_ENV",
  },
  deps: {
    neverBundle: true,
    onlyImport: [...entries.runtimeDependencies],
  },
  // Package-shape gates run against the packed artifact in package:check
  // In-repo exports point at src/ for workspace consumers.
  publint: false,
  attw: false,
});
