/**
 * Which forced-state cells the kit itself draws the same as at rest. The unit under test is
 * `unchangedByDesign`, and the oracle is the fixture set below: a pressed chip fills with muted
 * at rest and on hover, and a focus ring changes it on focus.
 */
import { describe, expect, it } from "vitest";

import type { ComponentRootSpec, VariantSpec } from "../components/kit-spec";
import { unchangedByDesign } from "./unchanged-by-design";

const muted = { kind: "variable", variable: { collection: "Fuse tokens", name: "muted" } } as const;
const zero = { kind: "literal", value: 0 } as const;

const ROOT: ComponentRootSpec = {
  name: "chip",
  width: undefined,
  height: undefined,
  minWidth: undefined,
  paddingTop: zero,
  paddingRight: zero,
  paddingBottom: zero,
  paddingLeft: zero,
  itemSpacing: zero,
  cornerRadius: zero,
  fill: muted,
  stroke: undefined,
  shadows: [],
  opacity: 1,
  children: [],
};

function variant(state: string, root: ComponentRootSpec): VariantSpec {
  return { key: `chip/state=${state},pressed=on`, properties: { state, pressed: "on" }, root };
}

describe("unchangedByDesign", () => {
  it("holds a forced cell whose spec equals its resting twin's, and not one whose spec differs", () => {
    const ring = {
      color: muted,
      offsetX: 0,
      offsetY: 0,
      radius: zero,
      spread: { kind: "literal", value: 2 },
    } as const;
    const set = {
      key: "chip",
      axes: [
        { name: "state", values: ["rest", "hover", "focus"] },
        { name: "pressed", values: ["on"] },
      ],
      variants: [
        variant("rest", ROOT),
        // A copy, so equality is by value as the JSON spec compares.
        variant("hover", { ...ROOT, fill: { ...muted } }),
        variant("focus", { ...ROOT, shadows: [ring] }),
      ],
    };
    expect(unchangedByDesign([set])).toEqual(new Set(["chip/state=hover,pressed=on"]));
  });
});
