/**
 * Build the Fuse components plugin. It builds the kit spec from the Fuse recipes, writes the
 * spec and its coverage table to `plugin/dist/` for review, and bundles the plugin's main
 * thread with the spec inlined. Import `plugin/manifest.json` into the Figma desktop app
 * under Plugins → Development to run it.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, FileSystem } from "effect";
import { fileURLToPath } from "node:url";

import { buildKit, renderCoverage } from "../src/components/build-kit.ts";
import type { BuiltKit } from "../src/components/build-kit.ts";
import { bundlePlugin } from "./plugin-bundle.ts";

const pluginDir = fileURLToPath(new URL("../plugin/", import.meta.url));
const distDir = `${pluginDir}dist/`;
const specPath = `${distDir}spec.json`;
const coveragePath = `${distDir}coverage.md`;
const codePath = `${distDir}code.js`;

/** The lines `figma:plugin` prints: where each file went, and what the spec and coverage hold. */
function summary({ spec, coverage }: BuiltKit): readonly string[] {
  const totals = new Map<string, number>();
  for (const row of coverage) {
    totals.set(row.outcome, (totals.get(row.outcome) ?? 0) + 1);
  }
  const outcomes = [...totals].map(([outcome, count]) => `${count} ${outcome}`).join(", ");
  const variants = spec.componentSets.reduce((sum, set) => sum + set.variants.length, 0);
  return [
    `Plugin: ${codePath}`,
    `Spec: ${specPath} (${spec.componentSets.length} component sets, ${variants} variants)`,
    `Coverage: ${coveragePath} (${outcomes})`,
    `Manifest: ${pluginDir}manifest.json`,
  ];
}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const kit = yield* buildKit();
  yield* fs.makeDirectory(distDir, { recursive: true });
  yield* fs.writeFileString(specPath, `${JSON.stringify(kit.spec, null, 2)}\n`);
  yield* fs.writeFileString(coveragePath, renderCoverage(kit.coverage));
  yield* fs.writeFileString(codePath, yield* bundlePlugin(kit.spec));
  for (const line of summary(kit)) {
    yield* Console.log(line);
  }
});

program.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
