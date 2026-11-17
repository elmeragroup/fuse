/**
 * Unit under test: `KIT_PARITY`, the kit's parity ledger. Oracles: the public components, which are
 * the folders under `packages/fuse/src/components` that `@elmeragroup/fuse`'s exports map publishes
 * as a subpath, and the kit inventory's sets (`test/kit-inventory.ts`), which never reads the kit.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import fusePackage from "../../fuse/package.json" with { type: "json" };
import { KIT_PARITY } from "../src/components/kit-parity.ts";
import type { KitParityRow } from "../src/components/kit-parity.ts";
import { KIT_PAGES } from "./kit-inventory.ts";

const COMPONENTS = fileURLToPath(new URL("../../fuse/src/components", import.meta.url));

/** The component folders the Fuse package publishes as a subpath, such as `button` for `./button`. */
function publicComponents(): readonly string[] {
  const subpaths = new Set(Object.keys(fusePackage.exports));
  return readdirSync(COMPONENTS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && subpaths.has(`./${entry.name}`))
    .map((entry) => entry.name)
    .toSorted();
}

/** The kit sets a row names: the sets that draw it, or the sets designers compose it from. */
function namedSets(row: KitParityRow): readonly string[] {
  switch (row.kind) {
    case "sets":
    case "partial":
      return row.sets;
    case "composed":
      return row.from;
    case "issue":
    case "excluded":
      return [];
  }
}

describe("the kit parity ledger", () => {
  it("has one row for each public Fuse component, and none for anything else", () => {
    expect(Object.keys(KIT_PARITY).toSorted()).toEqual(publicComponents());
  });

  it("names only sets the kit builds", () => {
    const built = new Set(KIT_PAGES.flatMap((page) => page.sets.map((set) => set.key)));
    const unbuilt = Object.entries(KIT_PARITY).flatMap(([component, row]) =>
      namedSets(row)
        .filter((key) => !built.has(key))
        .map((key) => `${component}: ${key}`)
    );
    expect(unbuilt).toEqual([]);
  });
});
