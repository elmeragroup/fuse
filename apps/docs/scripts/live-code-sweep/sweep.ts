/**
 * The Live code sweep: renders every component demo on the server once per offered value of
 * every settable prop at every site, one edit at a time, and records what throws. It is the
 * oracle for edits that put a demo in a state it cannot render, which the stage's safety net
 * (`LiveCodeBoundary`) reverts. Run it with `pnpm --filter docs live-code:sweep`. It takes about
 * 20 seconds and writes `.scratch/live-code-sweep/results.json`.
 */

import type { ComponentType } from "react";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";

import type { PropValue } from "../../src/lib/live-code/edits";
import { allowedValues } from "../../src/lib/live-code/schema";
import { findSites, readLensedImports } from "../../src/lib/live-code/sites";
import { LiveCodeStore } from "../../src/lib/live-code/store";
import { demoComponents, liveCodeDemoFiles, renderStage } from "../lib/live-code-render.ts";
import { openLiveCodeSchemas } from "../lib/live-code-schemas.ts";

/** One edit the sweep applies: a value at one site of one demo. */
type Combination = {
  readonly demo: string;
  readonly loc: string;
  readonly part: string;
  readonly prop: string;
  readonly value: PropValue;
};

/** What rendering a demo did: nothing, or the first line of what it threw. */
function rendered(Demo: ComponentType, store: LiveCodeStore): string | null {
  try {
    renderStage(Demo, store);
    return null;
  } catch (error) {
    return (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).split("\n")[0] ?? "";
  }
}

describe("Live code sweep", () => {
  it("renders every offered value of every settable prop at every site, one at a time", async () => {
    const started = performance.now();
    const throwing: (Combination & { readonly error: string })[] = [];
    const baseline: { demo: string; error: string }[] = [];
    let combinations = 0;
    // React logs each server render error it recovers from; the sweep records them instead.
    const consoleError = console.error;
    console.error = () => undefined;
    try {
      for (const file of liveCodeDemoFiles()) {
        const source = readFileSync(file.path, "utf8");
        const sites = findSites(source);
        if (sites.length === 0) continue;
        const modules = new Map(
          readLensedImports(source).flatMap((declaration) =>
            declaration.imports.map((entry) => [entry.imported, declaration.module] as const)
          )
        );
        const demo = file.name;
        const { schemaOf } = openLiveCodeSchemas();
        const components = (await demoComponents(file.path)).values();
        for (const Demo of components) {
          const before = rendered(Demo, new LiveCodeStore());
          if (before !== null) {
            baseline.push({ demo, error: before });
            continue;
          }
          for (const site of sites) {
            const module = modules.get(site.part.split(".")[0] ?? "");
            const schema = module === undefined ? undefined : schemaOf(module, site.part);
            const passed = new Set(site.attributes.map((attribute) => attribute.name));
            for (const spec of schema ?? []) {
              const values: readonly PropValue[] =
                spec.kind === "boolean" ? [true, false] : allowedValues(spec, passed, undefined);
              for (const value of values) {
                combinations += 1;
                const store = new LiveCodeStore();
                store.set(site.loc, spec.name, value);
                const error = rendered(Demo, store);
                if (error !== null) {
                  throwing.push({ demo, loc: site.loc, part: site.part, prop: spec.name, value, error });
                }
              }
            }
          }
        }
      }
    } finally {
      console.error = consoleError;
    }
    const seconds = Math.round((performance.now() - started) / 100) / 10;
    const out = join(import.meta.dirname, "../../../../.scratch/live-code-sweep");
    mkdirSync(out, { recursive: true });
    writeFileSync(
      join(out, "results.json"),
      `${JSON.stringify({ seconds, combinations, baseline, throwing }, null, 2)}\n`
    );
  });
});
