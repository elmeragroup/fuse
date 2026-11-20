/**
 * Unit under test: `diffInstance`, here on a root's alignment, a stroke's sides and a label's face.
 * Each block names its oracle. The alignment's is probe LD1, run
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
import type { BoxSpec, ComponentRootSpec, FrameLayerSpec, SizingSpec, TextLayerSpec } from "./kit-spec.ts";

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

// Oracle: the Figma plugin typings, where an instance layer's `strokeTopWeight`,
// `strokeRightWeight`, `strokeBottomWeight` and `strokeLeftWeight` are fields of its own that
// `overrides` lists, beside the stroke's paints. A chip segment's `border-0 border-s` keeps only the
// start edge of Button's 1px border, which four weights draw. A dashed stroke's pattern and a bound
// weight are no such fields, so they stay unmapped.
describe("a root's stroke on some sides, built in place", () => {
  const CLEAR = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } } as const;
  const BORDER = { kind: "literal", color: { r: 0.9, g: 0.9, b: 0.9, a: 1 } } as const;
  const START = { top: 0, right: 0, bottom: 0, left: 1 };
  const ONE = { kind: "literal", value: 1 } as const;

  it("overrides the four weights and the color of a variant's stroke on every side", () => {
    const diff = diffInstance(
      inPlace({ primaryAlign: "CENTER", sizing: VARIANT.sizing, stroke: { color: BORDER, sides: START } }),
      {
        ...VARIANT,
        stroke: { color: CLEAR, weight: ONE },
      }
    );
    expect([diff.overrides, diff.unmapped]).toEqual([
      [
        { path: [], field: "strokeSides", sides: START },
        { path: [], field: "strokeColor", color: BORDER },
      ],
      [],
    ]);
  });

  it.each([
    ["dashed", { color: CLEAR, weight: ONE, dashPattern: [3, 2] }],
    [
      "bound",
      { color: CLEAR, weight: { kind: "variable", variable: { collection: "Fuse tokens", name: "w" } } },
    ],
  ] as const)("stays unmapped over a %s stroke on every side", (_, stroke) => {
    const diff = diffInstance(
      inPlace({ primaryAlign: "CENTER", sizing: VARIANT.sizing, stroke: { color: CLEAR, sides: START } }),
      {
        ...VARIANT,
        stroke,
      }
    );
    expect([diff.overrides, diff.unmapped.map(({ field }) => field)]).toEqual([[], ["stroke"]]);
  });
});

// Oracle: the Figma plugin typings, where an instance's text has a `fontName` of its own that
// `overrides` lists, and CSS Fonts 4 §2.2, where a chip operator's `font-normal`, weight 400, takes
// the family's Regular face where Button's label takes Medium. A weight bound to a variable picks
// its face in each mode, which one font on the instance would not follow, so it stays unmapped.
describe("a label's face, built in place", () => {
  const LABEL: TextLayerSpec = {
    kind: "text",
    key: "label",
    name: "label",
    characters: "is",
    textProperty: "Label",
    fontFamily: { kind: "variable", variable: { collection: "Fuse tokens", name: "font-sans" } },
    fontStyle: "Medium",
    fontSize: { kind: "literal", value: 14 },
    lineHeight: { kind: "literal", value: 20 },
    color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
    underline: undefined,
    sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
    align: { horizontal: "CENTER", vertical: "TOP" },
    truncation: undefined,
  };
  const WEIGHT = {
    variable: { collection: "Fuse tokens", name: "font-weight-label" },
    faces: ["Regular", "Medium"],
  } as const;
  const held = (label: TextLayerSpec): ComponentRootSpec => ({ ...VARIANT, children: [label] });
  const built = (label: TextLayerSpec): ComponentRootSpec =>
    inPlace({ primaryAlign: "CENTER", sizing: VARIANT.sizing, children: [label] });

  it("overrides a literal weight's face in the same family", () => {
    const diff = diffInstance(built({ ...LABEL, fontStyle: "Regular" }), held(LABEL));
    expect([diff.overrides, diff.unmapped]).toEqual([
      [{ path: ["label"], field: "fontStyle", style: "Regular" }],
      [],
    ]);
  });

  it("stays unmapped where the variant's weight binds a variable", () => {
    const diff = diffInstance(built({ ...LABEL, fontStyle: "Regular" }), held({ ...LABEL, weight: WEIGHT }));
    expect([diff.overrides, diff.unmapped.map(({ field }) => field)]).toEqual([[], ["fontStyle", "weight"]]);
  });
});
