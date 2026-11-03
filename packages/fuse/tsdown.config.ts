import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";

import { entries } from "./scripts/entries.ts";

/**
 * Keeps each chart namespace an ES module namespace in `dist`. Rolldown turns `export * as Chart`
 * into a getter object, which no consumer bundler can shake part by part, but it emits an
 * external module's namespace re-export as written. Each parts module is its own entry, so the
 * external specifier points at its emitted sibling.
 */
const chartNamespaces = {
  name: "fuse-chart-namespaces",
  resolveId(id: string, importer: string | undefined) {
    if (
      importer === undefined ||
      !/[\\/]components[\\/]chart[\\/][a-z-]+-namespace\.(?:d\.)?ts$/u.test(importer)
    )
      return null;
    if (!/^\.\/[a-z-]+-parts$/u.test(id)) return null;
    return { id: `${id}.js`, external: true };
  },
};

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
  plugins: [chartNamespaces],
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
