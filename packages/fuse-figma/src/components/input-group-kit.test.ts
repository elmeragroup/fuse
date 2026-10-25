/**
 * Unit under test: the Input group component set as the build produces it. Oracle: the Fuse variable
 * or literal each Figma field of a cell must carry, read by hand from `inputGroupRootClass` and the
 * field box chrome in `field-box.ts`, the addon and button recipes in `input-group-variants.ts`, the
 * addon shells in `inner-corner/input-group.ts`, the control chrome in `input-group-class.ts`,
 * `inputClass`, `state-face.ts`, the focus ring in `styles/utils.ts`, Tailwind's spacing (0.25rem) and
 * `shadow-xs`, and from CSS: a flex row lays out its items in order-modified document order, a
 * `flex: 1` item grows from a zero basis, `max-height: 100%` lowers the control to the field's content
 * height, and a negative end margin on an addon that paints nothing takes its 4px from the room the
 * addon uses.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  ERROR_RING,
  FILL,
  fixed,
  FOCUS_RING,
  HUG,
  literal,
  paint,
  SHADOW_XS,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ChildLayerSpec, ComponentRootSpec, FrameLayerSpec, InstanceLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

function group(form: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `input-group/form=${form},state=${state}`);
}

function frame(layer: ChildLayerSpec | undefined): FrameLayerSpec | undefined {
  return layer?.kind === "frame" ? layer : undefined;
}

/** The instance the trailing addon of a cell holds. */
function button(form: string, state: string): InstanceLayerSpec | undefined {
  const addon = frame(group(form, state).children.find((layer) => layer.key === "addon-end"));
  const [held] = addon?.children ?? [];
  return held?.kind === "instance" ? held : undefined;
}

const STATES = ["rest", "focus", "disabled", "invalid"];

/** The corner of a button in an addon: the field corner less its border and the addon's padding. */
const ADDON_BUTTON_CORNER = density("radius-inner/field-border-pad-addon-button");

describe("the Input group component set", () => {
  it("holds the three forms Combobox and Command render in four states, with one Text property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "input-group");
    expect(set?.axes).toEqual([
      { name: "form", values: ["caret", "search", "clear"] },
      { name: "state", values: STATES },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(12);
    expect([set?.textProperties, set?.swapProperties]).toEqual([
      [{ name: "Text", defaultValue: "Search…" }],
      [],
    ]);
  });

  it("draws the 384px field box at the md control height around a control and its addon", () => {
    const root = group("caret", "rest");
    expect(root).toEqual(
      expect.objectContaining({
        direction: "HORIZONTAL",
        sizing: { horizontal: fixed(literal(384)), vertical: fixed(density("control-h-md")) },
        cornerRadius: token("radius-field-box"),
        fill: paint("card"),
        stroke: { color: paint("input"), weight: literal(1) },
        shadows: [SHADOW_XS],
        counterAlign: "CENTER",
      })
    );
    expect(root.children.map((layer) => layer.key)).toEqual(["control", "addon-end"]);
  });

  it("fills the room the addon leaves with the control, down to the field's content height, its text the placeholder on one line", () => {
    const control = frame(group("caret", "rest").children[0]);
    expect(control?.sizing).toEqual({ horizontal: FILL, vertical: FILL });
    expect(control?.children[0]).toEqual(
      expect.objectContaining({
        characters: "Search…",
        color: paint("muted-foreground"),
        fontSize: density("control-text"),
        lineHeight: density("control-leading"),
        sizing: { horizontal: FILL, vertical: HUG },
        truncation: { maxLines: 1 },
      })
    );
  });

  it("pads the control 6px on the side its addon sits, and the md control inset on the other", () => {
    const paddings = (form: string) => {
      const control = frame(group(form, "rest").children.find((layer) => layer.key === "control"));
      return [control?.paddingLeft, control?.paddingRight];
    };
    expect(paddings("caret")).toEqual([density("control-px-md"), literal(6)]);
    expect(paddings("clear")).toEqual([density("control-px-md"), literal(6)]);
    expect(paddings("search")).toEqual([literal(6), density("control-px-md")]);
  });

  it("draws Command's search addon before the control, its glyph 16px in muted-foreground", () => {
    const root = group("search", "rest");
    expect(root.children.map((layer) => layer.key)).toEqual(["addon-start", "control"]);
    const addon = frame(root.children[0]);
    expect(addon).toEqual(
      expect.objectContaining({
        sizing: { horizontal: HUG, vertical: HUG },
        paddingLeft: density("control-px-icon-md"),
        paddingRight: literal(0),
        paddingTop: literal(6),
        paddingBottom: literal(6),
      })
    );
    expect(addon?.children[0]).toEqual(
      expect.objectContaining({
        icon: "icon/MagnifyingGlass",
        size: literal(16),
        color: paint("muted-foreground"),
      })
    );
  });

  it("pads a trailing addon that holds a button by addon-px-button at its end and nothing down", () => {
    for (const form of ["caret", "clear"]) {
      const addon = frame(group(form, "rest").children.find((layer) => layer.key === "addon-end"));
      expect([addon?.paddingLeft, addon?.paddingRight, addon?.paddingTop, addon?.paddingBottom]).toEqual([
        literal(0),
        density("addon-px-button"),
        literal(0),
        literal(0),
      ]);
    }
  });

  it("holds the caret and the clear button as ghost icon-sm Icon buttons, rounded with the addon's inner corner and glyphs in muted-foreground", () => {
    for (const [form, icon] of [
      ["caret", "icon/CaretDown"],
      ["clear", "icon/X"],
    ] as const) {
      expect(button(form, "rest")).toEqual(
        expect.objectContaining({
          componentSet: "icon-button",
          variant: "icon-button/variant=ghost,size=icon-sm,state=rest",
          properties: { swap: { Icon: icon } },
          overrides: [
            { path: [], field: "cornerRadius", value: ADDON_BUTTON_CORNER },
            { path: ["icon-only"], field: "glyph", color: paint("muted-foreground") },
          ],
        })
      );
    }
    expect(button("caret", "disabled")?.variant).toBe(
      "icon-button/variant=ghost,size=icon-sm,state=disabled"
    );
  });

  it("rings focus, dims disabled to 50% on the input/50 fill, and strokes and rings invalid with error", () => {
    for (const form of ["caret", "search", "clear"]) {
      expect(group(form, "focus").shadows).toEqual([SHADOW_XS, FOCUS_RING]);
      const disabled = group(form, "disabled");
      expect([disabled.opacity, disabled.fill]).toEqual([0.5, paint("input/50")]);
      const invalid = group(form, "invalid");
      expect([invalid.stroke?.color, invalid.shadows]).toEqual([paint("error"), [SHADOW_XS, ERROR_RING]]);
    }
  });

  it("paints Button's invalid face on Combobox's caret inside an invalid Field", () => {
    const caret = button("caret", "invalid");
    expect(caret?.key).toBe("caret-invalid");
    expect(caret?.overrides).toEqual(
      expect.arrayContaining([
        { path: [], field: "strokeColor", color: paint("error") },
        { path: [], field: "effects", shadows: [ERROR_RING] },
      ])
    );
  });

  // The dense group is 36px and the caret 32px, centred, so the caret's 3px ring reaches 1px past the
  // group's top and bottom, which CSS paints, since `inputGroupRootClass` sets no `overflow`. The
  // comfortable group is 44px against a 36px caret, so the ring stays 1px inside.
  it("records the invalid caret's ring past the group's top and bottom at the dense density only", () => {
    expect(
      coverage
        .filter((row) => row.component === "Input group" && row.property === "effects")
        .map((row) => [row.part, row.value, row.outcome, row.detail])
    ).toEqual([
      [
        "button",
        "1px",
        "dropped",
        "in input-group/form=caret,state=invalid the shadow reaches 1px past the root's top and bottom at Fuse density / Dense, which CSS paints, since the root does not clip, while the root of every Figma variant clips so it can draw its own ring (PR2)",
      ],
    ]);
  });

  it("leaves no class of the set unmapped", () => {
    expect(coverage.filter((row) => row.component === "Input group" && row.outcome === "unmapped")).toEqual(
      []
    );
  });
});
