import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "tsdown";

import { entries } from "./scripts/entries.ts";

/**
 * The tsrs launcher that the tsrs package's `bin` field names. rolldown-plugin-dts picks its
 * generator from the installed `typescript` and only recognizes 7.0, so the config names tsrs.
 */
function tsrsExecutable(): string {
  const manifestPath = createRequire(import.meta.url).resolve("tsrs/package.json");
  // SAFETY: the manifest is the installed tsrs package's own, and every tsrs release names its
  // launcher in `bin.tsrs`. Without the field, `join` throws and the build stops.
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    readonly bin: { readonly tsrs: string };
  };
  return join(dirname(manifestPath), manifest.bin.tsrs);
}

export default defineConfig({
  entry: entries.sourceFiles,
  root: "src",
  outDir: "dist",
  format: "esm",
  platform: "browser",
  unbundle: true,
  dts: { generator: "tsgo", tsgo: { path: tsrsExecutable() } },
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
