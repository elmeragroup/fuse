/**
 * The differential oracle of every set the kit switches to its capture: the capture build against
 * the recipe build, field by field and row by row, with each difference classified in
 * `oracles/<set>.json`, and the structural floor the switch must keep.
 *
 * Unit under test: the capture-backed cascade (`capture-cascade.ts`) over the kept capture.
 * Oracle: the recipe cascade's build of the same set, which the set's previews and real-file round
 * trips have checked until the switch, with each difference between them classified by hand.
 */
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { existsSync, readFileSync } from "node:fs";

import { buildComponentSets } from "../components/build-kit.ts";
import type { KitComponentSet } from "../components/build-kit.ts";
import { KIT } from "../components/kit-registry.ts";
import { walkLayers } from "../components/kit-spec.ts";
import { FORBIDDEN_FIELDS } from "./manifest.ts";
import type { InstanceManifest, PartManifest, SetManifest } from "./manifest.ts";
import { classify, decodeOracle } from "./oracle.ts";
import { diffCoverage, diffSpecs } from "./spec-diff.ts";

const SWITCHED = KIT.flatMap(({ manifest }) => (manifest === undefined ? [] : [manifest]));

/** Each build's sets by key, built once for the file. */
const builds = Effect.runPromise(
  Effect.all([buildComponentSets("recipe"), buildComponentSets("switched")]).pipe(
    Effect.map(([recipe, capture]) =>
      [recipe, capture].map(
        (sets) => new Map(sets.map((set): readonly [string, KitComponentSet] => [set.componentSet.key, set]))
      )
    )
  )
);

/** One set as both builds make it. */
async function bothBuilds(key: string): Promise<readonly [KitComponentSet, KitComponentSet]> {
  const [recipe, capture] = await builds;
  const old = recipe?.get(key);
  const now = capture?.get(key);
  if (old === undefined || now === undefined) {
    throw new Error(`the kit builds no set ${key}`);
  }
  return [old, now];
}

/** The field names of a manifest, its label, its parts and the inner manifests its instance parts show. */
function fieldsIn(manifest: SetManifest | PartManifest | InstanceManifest): readonly string[] {
  const inner = "kind" in manifest ? [manifest.of] : (manifest.parts ?? []);
  const label = "label" in manifest && manifest.label !== undefined ? Object.keys(manifest.label) : [];
  return [...Object.keys(manifest), ...label, ...inner.flatMap(fieldsIn)];
}

/**
 * What a set's builds differ on that its oracle file leaves unclassified, and the file's entries that
 * match nothing. A set with no file has no entry, so any difference stays.
 */
async function unclassified(key: string) {
  const [recipe, capture] = await bothBuilds(key);
  const path = new URL(`../../oracles/${key}.json`, import.meta.url);
  const oracle = existsSync(path)
    ? decodeOracle(JSON.parse(readFileSync(path, "utf8")))
    : Result.succeed({ set: key, entries: [] });
  if (Result.isFailure(oracle)) {
    throw oracle.failure;
  }
  return classify(
    {
      fields: diffSpecs(recipe.componentSet, capture.componentSet),
      ...diffCoverage(recipe.coverage, capture.coverage),
    },
    oracle.success
  );
}

// A switched set reaches every set that shows it as an instance, which the recipe cascade still
// builds in place, so every set of the kit takes part.
describe.each(KIT.map(({ definition }) => definition.key))("the switched kit's %s", (key) => {
  it("differs from the recipe build only where oracles/<set>.json classifies it", async () => {
    expect(await unclassified(key)).toEqual({ fields: [], lost: [], added: [], stale: [] });
  });
});

describe.each(SWITCHED.map((manifest) => [manifest.key, manifest] as const))(
  "the capture build of %s",
  (key, manifest) => {
    it("keeps the recipe build's keys, instances and bound rows, and adds no unmapped row", async () => {
      const [recipe, capture] = await bothBuilds(key);
      const instances = (set: KitComponentSet) =>
        set.componentSet.variants.flatMap((variant) =>
          walkLayers(variant.root).flatMap((layer) =>
            layer.kind === "instance" ? [`${variant.key} ${layer.key}`] : []
          )
        );
      const bound = (set: KitComponentSet) => set.coverage.filter((row) => row.outcome === "bound").length;
      expect(capture.componentSet.variants.map((variant) => variant.key)).toEqual(
        recipe.componentSet.variants.map((variant) => variant.key)
      );
      expect(instances(capture)).toEqual(instances(recipe));
      expect(bound(capture)).toBeGreaterThanOrEqual(bound(recipe));
      expect(
        diffCoverage(recipe.coverage, capture.coverage).added.filter((row) => row.outcome === "unmapped")
      ).toEqual([]);
    });

    it("names no field of CSS knowledge in its manifest", () => {
      const forbidden: ReadonlySet<string> = new Set(FORBIDDEN_FIELDS);
      expect(fieldsIn(manifest).filter((name) => forbidden.has(name))).toEqual([]);
    });
  }
);
