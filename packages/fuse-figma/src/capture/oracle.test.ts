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
import { Schema } from "effect";
import { existsSync, readFileSync } from "node:fs";

import { buildComponentSets } from "../components/build-kit.ts";
import type { KitComponentSet } from "../components/build-kit.ts";
import { matrixCells, variantKey } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { walkLayers } from "../components/kit-spec.ts";
import { keptCapture } from "./captures.ts";
import { MANIFEST_FIELDS, SAMPLE_HOST_WIDTHS } from "./manifest.ts";
import type { IconManifest, InstanceManifest, LabelManifest, PartManifest, SetManifest } from "./manifest.ts";
import { classify, decodeOracle, isExact } from "./oracle.ts";
import type { SetOracle } from "./oracle.ts";
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

/** The host widths a manifest and the manifests its instance parts show name, by set. */
function hostWidthsOf(manifest: SetManifest): readonly { readonly set: string; readonly width: number }[] {
  const seen = new Set<SetManifest>();
  const found: { readonly set: string; readonly width: number }[] = [];
  const visit = (each: SetManifest): void => {
    if (seen.has(each)) {
      return;
    }
    seen.add(each);
    if (each.previewWidth !== undefined) {
      found.push({ set: each.key, width: each.previewWidth });
    }
    const parts = (list: readonly (PartManifest | InstanceManifest)[]): void => {
      for (const part of list) {
        if ("kind" in part) {
          visit(part.of);
        } else {
          parts(part.parts ?? []);
        }
      }
    };
    parts(each.parts ?? []);
  };
  visit(manifest);
  return found;
}

/**
 * Each field of a manifest's objects that its kind's allowlist lacks, as `kind key.field`: the set,
 * its label, its icons in every cell, its parts, and the sets its instance parts show.
 */
function fieldsOutsideAllowlist(manifest: SetManifest): readonly string[] {
  const found: string[] = [];
  const seen = new Set<SetManifest>();
  const check = (
    kind: keyof typeof MANIFEST_FIELDS,
    object: SetManifest | PartManifest | InstanceManifest | LabelManifest | IconManifest,
    name: string
  ): void => {
    const allowed: ReadonlySet<string> = new Set(MANIFEST_FIELDS[kind]);
    for (const field of Object.keys(object)) {
      if (!allowed.has(field)) {
        found.push(`${kind} ${name}.${field}`);
      }
    }
  };
  const box = (
    object: SetManifest | PartManifest,
    name: string,
    cells: readonly Record<string, string>[]
  ): void => {
    if (object.label !== undefined) {
      check("label", object.label, name);
    }
    for (const cell of cells) {
      for (const icon of object.iconsFor(cell)) {
        check("icon", icon, name);
      }
    }
  };
  const part = (each: PartManifest | InstanceManifest, cells: readonly Record<string, string>[]): void => {
    if ("kind" in each) {
      check("instance", each, each.key);
      set(each.of);
      return;
    }
    check("part", each, each.key);
    box(each, each.key, cells);
    for (const below of each.parts ?? []) {
      part(below, cells);
    }
  };
  const set = (each: SetManifest): void => {
    if (seen.has(each)) {
      return;
    }
    seen.add(each);
    const cells = matrixCells(each.axes);
    check("set", each, each.key);
    box(each, each.key, cells);
    for (const below of each.parts ?? []) {
      part(below, cells);
    }
  };
  set(manifest);
  return found;
}

/** A set's oracle file, or no entry for a set with no file, so any difference stays. */
function oracleOf(key: string): SetOracle {
  const path = new URL(`../../oracles/${key}.json`, import.meta.url);
  const oracle = existsSync(path)
    ? decodeOracle(JSON.parse(readFileSync(path, "utf8")))
    : Result.succeed({ set: key, entries: [] });
  if (Result.isFailure(oracle)) {
    throw oracle.failure;
  }
  return oracle.success;
}

/**
 * What a set's builds differ on that its oracle file leaves unclassified, and the file's entries that
 * match nothing.
 */
async function unclassified(key: string) {
  const [recipe, capture] = await bothBuilds(key);
  return classify(
    {
      fields: diffSpecs(recipe.componentSet, capture.componentSet),
      ...diffCoverage(recipe.coverage, capture.coverage),
    },
    oracleOf(key)
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
    it("keeps the recipe build's keys, instances and bound rows, leaves no more unmapped rows and adds none, and names each unshown row", async () => {
      const [recipe, capture] = await bothBuilds(key);
      const instances = (set: KitComponentSet) =>
        set.componentSet.variants.flatMap((variant) =>
          walkLayers(variant.root).flatMap((layer) =>
            layer.kind === "instance" ? [`${variant.key} ${layer.key}`] : []
          )
        );
      const count = (set: KitComponentSet, outcome: string) =>
        set.coverage.filter((row) => row.outcome === outcome).length;
      expect(capture.componentSet.variants.map((variant) => variant.key)).toEqual(
        recipe.componentSet.variants.map((variant) => variant.key)
      );
      expect(instances(capture)).toEqual(instances(recipe));
      expect(count(capture, "bound")).toBeGreaterThanOrEqual(count(recipe, "bound"));
      // `unmapped` keeps its meaning, CSS that wins and maps to nothing. On the same tree the capture
      // build leaves no more of it than the recipe build, and adds none, whatever the Fuse classes are.
      expect(count(capture, "unmapped")).toBeLessThanOrEqual(count(recipe, "unmapped"));
      const added = diffCoverage(recipe.coverage, capture.coverage).added;
      expect(added.filter((row) => row.outcome === "unmapped")).toEqual([]);
      // A state no cell shows is `unshown`, and the oracle names each such row by its part, class and
      // property, so a new one fails the oracle rather than a pattern absorbing it.
      const named = oracleOf(key).entries.flatMap((entry) =>
        entry.kind === "row-added" &&
        entry.match.outcome === "unshown" &&
        [entry.match.part, entry.match.className, entry.match.property].every(
          (field) => field !== undefined && isExact(field)
        )
          ? [
              JSON.stringify([
                entry.match.part,
                entry.match.className?.replaceAll("\\*", "*"),
                entry.match.property,
              ]),
            ]
          : []
      );
      expect(
        added
          .filter((row) => row.outcome === "unshown")
          .map((row) => JSON.stringify([row.part, row.className, row.property]))
          .filter((row) => !named.includes(row))
      ).toEqual([]);
    });

    it("draws every state its matrix names, unlike the cell at rest", () => {
      // A state the capture could not reach would hold the same winners as its resting twin, as a
      // `state-missing` cell of figma:compare does.
      const capture = keptCapture(key);
      if (capture === undefined || Result.isFailure(capture)) {
        throw new Error(`captures/${key}.json does not read`);
      }
      const cells = new Map(capture.success.cells.map((cell) => [cell.key, cell] as const));
      const missing = capture.success.cells.flatMap((cell) => {
        if (cell.cell.state === undefined || cell.cell.state === "rest") {
          return [];
        }
        const rest = cells.get(variantKey(manifest, { ...cell.cell, state: "rest" }));
        return rest !== undefined && JSON.stringify(rest.roots) === JSON.stringify(cell.roots)
          ? [cell.key]
          : [];
      });
      expect(missing).toEqual([]);
    });

    it("names only the allowlist's fields in its manifest", () => {
      expect(fieldsOutsideAllowlist(manifest)).toEqual([]);
    });

    it("sizes its sample's host only with a plain host width", () => {
      // A width computed from a component's own CSS, as a popup's minimum less its padding, must
      // come from the capture, which measures it.
      expect(hostWidthsOf(manifest).filter(({ width }) => !SAMPLE_HOST_WIDTHS.has(width))).toEqual([]);
    });
  }
);

/**
 * The docs' API reference of each anchored composite's popup part: the component's page and the
 * part whose `sideOffset` and `alignItemWithTrigger` defaults the manifest names. Each anchored
 * manifest must have a row, so a new one decides where its placement props come from.
 */
const PLACEMENT_SOURCES: ReadonlyMap<string, { readonly page: string; readonly part: string }> = new Map([
  ["select-open", { page: "select", part: "Select.Content" }],
  ["popover-open", { page: "popover", part: "Popover.Content" }],
  ["dropdown-menu-open", { page: "dropdown-menu", part: "DropdownMenu.Content" }],
  ["combobox-open", { page: "combobox", part: "Combobox.Content" }],
  ["tooltip-open", { page: "tooltip", part: "Tooltip.Content" }],
]);

const ApiReference = Schema.Struct({
  parts: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      props: Schema.Array(
        Schema.Struct({ name: Schema.String, defaultValue: Schema.optionalKey(Schema.NullOr(Schema.String)) })
      ),
    })
  ),
});

/** A prop's declared default in a component's generated API reference, as its JSON text. */
function apiDefault(page: string, part: string, prop: string): string | null | undefined {
  const path = new URL(`../../../../apps/docs/src/app/(docs)/components/${page}/api.json`, import.meta.url);
  const reference = Schema.decodeUnknownSync(ApiReference)(JSON.parse(readFileSync(path, "utf8")));
  return reference.parts.find((each) => each.name === part)?.props.find((each) => each.name === prop)
    ?.defaultValue;
}

describe.each(
  SWITCHED.flatMap((manifest) =>
    manifest.sideOffset === undefined ? [] : [[manifest.key, manifest] as const]
  )
)("the anchored manifest %s", (key, manifest) => {
  it("names its popup's sideOffset as the component's API reference declares it", () => {
    const source = PLACEMENT_SOURCES.get(key);
    expect(source).toBeDefined();
    if (source !== undefined) {
      expect(String(manifest.sideOffset)).toBe(apiDefault(source.page, source.part, "sideOffset"));
    }
  });
});
