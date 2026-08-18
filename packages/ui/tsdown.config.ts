import { defineConfig } from "tsdown";

import { entries } from "./scripts/entries.ts";

export default defineConfig({
  entry: entries.sourceFiles,
  root: "src",
  outDir: "dist",
  format: "esm",
  platform: "browser",
  unbundle: true,
  dts: true,
  clean: true,
  sourcemap: true,
  // Keep validateTheme's runtime NODE_ENV branch (theming.md §7.6).
  define: {
    "process.env.NODE_ENV": "process.env.NODE_ENV",
  },
  deps: {
    neverBundle: true,
    onlyImport: [...entries.runtimeDependencies],
  },
  // Package-shape gates run against the packed artifact in package:check
  // (architecture.md §4). In-repo exports point at src/ for workspace consumers.
  publint: false,
  attw: false,
});
