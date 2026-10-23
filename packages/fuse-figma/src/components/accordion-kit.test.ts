/**
 * Unit under test: the Accordion item component set as the build produces it. Oracle: the Fuse
 * variable or literal each Figma field of a cell must carry, read by hand from `accordionVariants`
 * in `accordion-variants.ts`, the shells in `inner-corner/accordion.ts`, the focus ring in
 * `styles/utils.ts`, the state faces in `state-face.ts`, Tailwind's spacing scale, the host type in
 * `host-type.ts`, and the docs Basic demo's first item:
 *
 * - The item is a block `<div>` 384px wide, the preview width, which stacks its header and, while
 *   open, its panel down it, each as wide as the item. It pads `surface-pad-md` on every side.
 *   `default` fills it `primary-soft` on `rounded-sm`, or the `lg` and `xl` rungs. `card` fills it
 *   `card` and strokes it 1px with `card-border` on `rounded-lg`, or `rounded-xl` at `xl`.
 * - The header is a flex row, and the trigger's `flex-1` fills it. The trigger spaces its label and
 *   caret to its ends with an 8px gap between. The label is `Shipping` at Medium in the host's
 *   16px with its 24px line, and the caret a 16px CaretDown. Both take the item's text color:
 *   `primary-soft-foreground` in `default`, `foreground` in `card`.
 * - An open item's trigger carries `data-panel-open`, so the caret's
 *   `group-data-[panel-open]/accordion-trigger:rotate-180` turns it half a turn, and Base UI mounts
 *   the panel, whose height its own `--accordion-panel-height: auto` leaves hugging its text. The
 *   panel clips, and in `card` fills `card` and rounds with the item's inner corner: the `lg` rung
 *   less the 1px border and `surface-pad-md` (`radius-inner/lg-border-pad-md`) at `none` and `lg`,
 *   and the `xl` rung's at `xl`. Its text sits below `surface-gap-lg` plus 6px
 *   (`accordion-panel-pt`), fills the panel and wraps there, in the host's 16/24 Regular.
 * - Hover underlines the label, focus rings the trigger 2px in `--ring`, which the `default` item
 *   sets to `primary-soft-foreground`, and a disabled item dims the trigger to 50%.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  FILL,
  fixed,
  HUG,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { CoverageRow } from "./coverage";
import type { ChildLayerSpec, ComponentRootSpec, FrameLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];
let coverage: readonly CoverageRow[];

beforeAll(async () => {
  ({ spec, coverage } = await builtKit());
});

const VARIANTS = ["default", "card"];
const RADII = ["none", "lg", "xl"];
const OPENS = ["off", "on"];
const STATES = ["rest", "hover", "focus", "disabled"];

function item(variant: string, radius: string, open: string, state: string): ComponentRootSpec {
  return variantRoot(spec, `accordion-item/variant=${variant},radius=${radius},open=${open},state=${state}`);
}

/** The frame of a layer's children that carries a name, or a failure naming it. */
function frame(box: { readonly children: readonly ChildLayerSpec[] }, name: string): FrameLayerSpec {
  const found = box.children.find((child) => child.name === name);
  if (found?.kind !== "frame") {
    throw new Error(`no frame ${name}`);
  }
  return found;
}

/** The trigger, inside the header. */
function trigger(root: ComponentRootSpec): FrameLayerSpec {
  return frame(frame(root, "accordion-header"), "accordion-trigger");
}

/** The item's fill, stroke and corner per variant and radius. */
const LOOKS = [
  ["default", "none", paint("primary-soft"), undefined, token("radius-sm")],
  ["default", "lg", paint("primary-soft"), undefined, token("radius-lg")],
  ["default", "xl", paint("primary-soft"), undefined, token("radius-xl")],
  ["card", "none", paint("card"), { color: paint("card-border"), weight: literal(1) }, token("radius-lg")],
  ["card", "lg", paint("card"), { color: paint("card-border"), weight: literal(1) }, token("radius-lg")],
  ["card", "xl", paint("card"), { color: paint("card-border"), weight: literal(1) }, token("radius-xl")],
] as const;

/** The text color of each variant, which the label, the caret and the panel's text take. */
const TEXT_COLORS = { default: paint("primary-soft-foreground"), card: paint("foreground") } as const;

describe("the Accordion item component set", () => {
  it("crosses two variants, three radii, closed and open, in four states, 48 cells, with a Label and a Content property", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "accordion-item");
    expect([set?.name, set?.page]).toEqual(["Accordion item", "page/accordion"]);
    expect(set?.axes).toEqual([
      { name: "variant", values: VARIANTS },
      { name: "radius", values: RADII },
      { name: "open", values: OPENS },
      { name: "state", values: STATES },
    ]);
    expect(set?.columnAxis).toBe("state");
    expect(new Set(set?.variants.map((cell) => cell.key)).size).toBe(48);
    expect([set?.textProperties, set?.booleanProperties, set?.swapProperties]).toEqual([
      [
        { name: "Label", defaultValue: "Shipping" },
        { name: "Content", defaultValue: "Delivered within 3–5 business days." },
      ],
      undefined,
      [],
    ]);
  });

  it.each(LOOKS)(
    "stacks the %s item at radius %s 384px wide, padded surface-pad-md, with its fill, stroke and corner",
    (variant, radius, fill, stroke, corner) => {
      const root = item(variant, radius, "on", "rest");
      expect([root.direction, root.sizing, root.itemSpacing, root.clips]).toEqual([
        "VERTICAL",
        { horizontal: fixed(literal(384)), vertical: HUG },
        literal(0),
        true,
      ]);
      expect([root.paddingTop, root.paddingRight, root.paddingBottom, root.paddingLeft]).toEqual(
        Array.from({ length: 4 }, () => density("surface-pad-md"))
      );
      expect([root.fill, root.stroke, root.cornerRadius]).toEqual([fill, stroke, corner]);
      expect(root.children.map((child) => [child.name, child.kind === "frame" && child.sizing])).toEqual([
        ["accordion-header", { horizontal: FILL, vertical: HUG }],
        ["accordion-content", { horizontal: FILL, vertical: HUG }],
      ]);
    }
  );

  it.each(VARIANTS)(
    "fills the %s header with the trigger, its label and caret at its ends in the item's text color",
    (variant) => {
      const button = trigger(item(variant, "none", "off", "rest"));
      expect([button.sizing, button.primaryAlign, button.counterAlign, button.itemSpacing]).toEqual([
        { horizontal: FILL, vertical: HUG },
        "SPACE_BETWEEN",
        "CENTER",
        literal(8),
      ]);
      const color = TEXT_COLORS[variant === "card" ? "card" : "default"];
      expect(button.children).toMatchObject([
        {
          kind: "text",
          characters: "Shipping",
          textProperty: "Label",
          fontFamily: token("font-sans"),
          fontStyle: "Medium",
          fontSize: literal(16),
          lineHeight: literal(24),
          color,
          underline: undefined,
        },
        { kind: "icon", name: "Caret", icon: "icon/CaretDown", size: literal(16), color },
      ]);
    }
  );

  it("turns the caret half a turn and shows the panel only while the item is open", () => {
    const caret = (root: ComponentRootSpec) => trigger(root).children.find((child) => child.kind === "icon");
    for (const radius of RADII) {
      for (const state of STATES) {
        const closed = item("default", radius, "off", state);
        const open = item("default", radius, "on", state);
        expect([caret(closed)?.rotation, caret(open)?.rotation]).toEqual([undefined, 180]);
        expect(closed.children.map((child) => child.name)).toEqual(["accordion-header"]);
        expect(open.children.map((child) => child.name)).toEqual(["accordion-header", "accordion-content"]);
      }
    }
  });

  it.each([
    ["default", "none", undefined, literal(0)],
    ["card", "none", paint("card"), density("radius-inner/lg-border-pad-md")],
    ["card", "lg", paint("card"), density("radius-inner/lg-border-pad-md")],
    ["card", "xl", paint("card"), density("radius-inner/xl-border-pad-md")],
  ])(
    "clips the %s panel at radius %s with its fill and inner corner, and wraps its text below accordion-panel-pt",
    (variant, radius, fill, corner) => {
      const panel = frame(item(variant, radius, "on", "rest"), "accordion-content");
      expect([panel.clips, panel.fill, panel.cornerRadius]).toEqual([true, fill, corner]);
      const inner = frame(panel, "content-inner");
      expect([inner.sizing, inner.paddingTop, inner.paddingBottom]).toEqual([
        { horizontal: FILL, vertical: HUG },
        density("accordion-panel-pt"),
        literal(0),
      ]);
      expect(inner.children).toMatchObject([
        {
          kind: "text",
          characters: "Delivered within 3–5 business days.",
          textProperty: "Content",
          fontStyle: "Regular",
          fontSize: literal(16),
          lineHeight: literal(24),
          color: TEXT_COLORS[variant === "card" ? "card" : "default"],
          sizing: { horizontal: FILL, vertical: HUG },
          truncation: undefined,
        },
      ]);
    }
  );

  it("underlines the label on hover, rings the trigger in the item's ring on focus, and dims it when disabled", () => {
    const label = (root: ComponentRootSpec) => trigger(root).children.find((child) => child.kind === "text");
    expect(label(item("default", "none", "off", "hover"))).toMatchObject({
      underline: { offset: undefined },
    });
    const ring = (color: string) => ({
      color: paint(color),
      offsetX: 0,
      offsetY: 0,
      radius: literal(0),
      spread: literal(2),
    });
    expect([
      trigger(item("default", "none", "off", "focus")).shadows,
      trigger(item("card", "none", "off", "focus")).shadows,
      trigger(item("card", "none", "off", "rest")).shadows,
    ]).toEqual([[ring("primary-soft-foreground")], [ring("ring")], []]);
    const disabled = item("card", "lg", "on", "disabled");
    expect([
      disabled.opacity,
      trigger(disabled).opacity,
      trigger(item("card", "lg", "on", "rest")).opacity,
    ]).toEqual([1, 0.5, 1]);
  });

  it("reads the panel's height from Base UI's style and drops its animation", () => {
    const reasons = (className: string) =>
      new Set(
        coverage
          .filter((row) => row.component === "Accordion item" && row.className === className)
          .map((row) => `${row.property} ${row.outcome}: ${row.detail}`)
      );
    expect(reasons("h-(--accordion-panel-height)")).toEqual(
      new Set(["height literal: the box hugs its content"])
    );
    expect(reasons("data-starting-style:h-0")).toEqual(
      new Set(["height dropped: no cell of the matrix shows `data-starting-style`"])
    );
    expect(reasons("inline style")).toEqual(
      new Set([
        "--accordion-panel-height literal: the box hugs its content",
        "--accordion-panel-width dropped: a custom property passes its value down, and no part or icon below reads it",
        "animation-name dropped: Figma components do not animate",
      ])
    );
  });
});
