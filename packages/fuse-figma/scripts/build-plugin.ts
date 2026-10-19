/**
 * Build the Fuse components plugin. It builds the kit spec from the Fuse recipes, writes the
 * spec and its coverage table to `plugin/dist/` for review, and bundles the plugin's main
 * thread with the spec inlined. Import `plugin/manifest.json` into the Figma desktop app
 * under Plugins → Development to run it.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "rolldown";

import { buildKit, renderCoverage } from "../src/components/build-kit.ts";

const pluginDir = fileURLToPath(new URL("../plugin/", import.meta.url));
const distDir = `${pluginDir}dist/`;
const specPath = `${distDir}spec.json`;
const coveragePath = `${distDir}coverage.md`;
const codePath = `${distDir}code.js`;

const { spec, coverage } = await buildKit();
mkdirSync(distDir, { recursive: true });
writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`);
writeFileSync(coveragePath, renderCoverage(coverage));

// Figma runs the main thread as one classic script, so the bundle is an IIFE with no
// imports, and the spec arrives as an inlined literal.
await build({
  input: `${pluginDir}src/code.ts`,
  platform: "neutral",
  transform: { define: { __FUSE_KIT__: JSON.stringify(spec) } },
  output: { file: codePath, format: "iife" },
});

const totals = new Map<string, number>();
for (const row of coverage) {
  totals.set(row.outcome, (totals.get(row.outcome) ?? 0) + 1);
}
const summary = [...totals].map(([outcome, count]) => `${count} ${outcome}`).join(", ");
const variants = spec.componentSets.reduce((sum, set) => sum + set.variants.length, 0);

console.log(`Plugin: ${codePath}`);
console.log(`Spec: ${specPath} (${spec.componentSets.length} component sets, ${variants} variants)`);
console.log(`Coverage: ${coveragePath} (${summary})`);
console.log(`Manifest: ${pluginDir}manifest.json`);
