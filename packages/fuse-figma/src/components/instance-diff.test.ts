/**
 * Unit under test: `diffInstance` on a root's alignment along its direction. Oracle: probe LD1, run
 * in a real Figma file on 2026-11-19. An instance of a Button-like component that fills a vertical
 * auto layout, its `primaryAxisAlignItems` overridden from CENTER to MIN, listed the field in its
 * `overrides` and kept MIN through a variant switch, a TEXT property change, a density switch and
 * nesting in another component's instance. The probe covered an instance that fills along its own
 * direction and nothing else: an instance that hugs or takes a fixed length there, and a frame below
 * the root, stay unmapped. The alignment places the root's layers, so where another difference
 * stays unmapped, it does too.
 */
import { describe, expect, it } from "vitest";

import { diffInstance } from "./instance-diff.ts";
import { NO_LIMITS } from "./kit-spec.ts";
import type { BoxSpec, ComponentRootSpec, FrameLayerSpec, SizingSpec } from "./kit-spec.ts";

const ZERO = { kind: "literal", value: 0 } as const;

/** The box fields every root and frame here shares. */
const BOX: Omit<BoxSpec, "sizing" | "children"> = {
  direction: "HORIZONTAL",
  limits: NO_LIMITS,
  clips: false,
  paddingTop: ZERO,
  paddingRight: ZERO,
  paddingBottom: ZERO,
  paddingLeft: ZERO,
  itemSpacing: ZERO,
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  cornerRadius: ZERO,
  shadows: [],
  opacity: 1,
  fill: undefined,
  stroke: undefined,
};

/** A row 36px tall that fills across, as a `w-full` Button fills its list row. */
const FILLS: SizingSpec = {
  horizontal: { kind: "fill" },
  vertical: { kind: "fixed", length: { kind: "literal", value: 36 } },
};

/** The variant's root: a row that hugs its width and centres what it holds. */
const VARIANT: ComponentRootSpec = {
  ...BOX,
  name: "button",
  sizing: { ...FILLS, horizontal: { kind: "hug" } },
  children: [],
};

/** The root built in place, at the start of its row, with the given fields. */
function inPlace(fields: Partial<ComponentRootSpec> = {}): ComponentRootSpec {
  return { ...VARIANT, sizing: FILLS, primaryAlign: "MIN", ...fields };
}

describe("a root's alignment along its direction, built in place", () => {
  it("becomes an override on an instance that fills along its direction", () => {
    const diff = diffInstance(inPlace(), VARIANT);
    expect([diff.overrides, diff.unmapped]).toEqual([
      [{ path: [], field: "primaryAlign", value: "MIN" }],
      [],
    ]);
  });

  it.each([
    ["that hugs along its direction", inPlace({ sizing: VARIANT.sizing })],
    [
      "that takes a fixed length along its direction",
      inPlace({
        sizing: { ...FILLS, horizontal: { kind: "fixed", length: { kind: "literal", value: 200 } } },
      }),
    ],
    ["in a column that fills only across", inPlace({ direction: "VERTICAL" })],
  ])("stays unmapped on an instance %s", (_, root) => {
    const diff = diffInstance(root, { ...VARIANT, direction: root.direction });
    expect(diff.overrides).toEqual([]);
    expect(diff.unmapped.map(({ path, field }) => [path, field])).toEqual([[[], "primaryAlign"]]);
  });

  it("stays unmapped beside a difference no instance field carries", () => {
    const diff = diffInstance(inPlace({ paddingLeft: { kind: "literal", value: 8 } }), VARIANT);
    expect(diff.overrides).toEqual([]);
    expect(diff.unmapped.map(({ field }) => field).toSorted()).toEqual(["paddingLeft", "primaryAlign"]);
  });

  it("stays unmapped on a frame below the root", () => {
    const frame = (primaryAlign: BoxSpec["primaryAlign"]): FrameLayerSpec => ({
      ...BOX,
      kind: "frame",
      key: "inner",
      name: "inner",
      sizing: FILLS,
      primaryAlign,
      children: [],
    });
    const diff = diffInstance(inPlace({ primaryAlign: "CENTER", children: [frame("MIN")] }), {
      ...VARIANT,
      children: [frame("CENTER")],
    });
    expect(diff.overrides).toEqual([]);
    expect(diff.unmapped.map(({ path, field }) => [path, field])).toEqual([[["inner"], "primaryAlign"]]);
  });
});
