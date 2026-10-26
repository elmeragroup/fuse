/**
 * Unit under test: the Select sets `Select item`, `Select popup` and `Select (open)` as the build
 * produces them. Oracle: the Figma field each cell must carry, read by hand from `select-variants.ts`,
 * `menu-row-classes.ts`, `overlay-classes.ts`, `inner-corner/select.ts` and Base UI's placement in
 * `select.tsx` (side bottom, offset 4, centered), and the widths Chromium measured on the compare page
 * on 2026-10-25: every row and popup 144px wide, and the open Select as wide as its popup.
 *
 * - A row is `w-full` in its 144px popup, at least `row-h` tall, inset by `row-py` and `row-px` with
 *   `row-px + 1.5rem` at its end, `gap-2`, rounded with the popup's `radius-lg`. Its text fills it in
 *   14px type on a 20px line. A selected row's Check, `absolute right-(--row-px)`, sits in that end
 *   room, which the kit draws in flow: the row then pads its end by `row-px`.
 * - `focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground` paints a
 *   highlighted row; `data-disabled:opacity-50` dims a disabled one.
 * - The popup is `bg-popover`, `shadow-md` and `ring-1 ring-foreground/10`, `rounded-lg`, clipping, as
 *   wide as its trigger and at least `min-w-36`, which every demo's trigger is narrower than.
 * - A group pads its rows by `surface-pad-sm` and rounds them with `radius-lg` less that padding.
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
import type { ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

function set(key: string) {
  return spec.componentSets.find((candidate) => candidate.key === key);
}

/** Each layer's key, its kind, and the variant it shows where it is an instance, depth first. */
function outline(layers: readonly ChildLayerSpec[], depth = 0): readonly string[] {
  return layers.flatMap((layer) => [
    `${"  ".repeat(depth)}${layer.key}${layer.kind === "instance" ? ` -> ${layer.variant}` : ""}`,
    ...(layer.kind === "frame" ? outline(layer.children, depth + 1) : []),
  ]);
}

describe("the Select item component set", () => {
  it("holds selected off and on in 3 states on the Select page, its text a property", () => {
    const items = set("select-item");
    expect([items?.name, items?.page, items?.axes, items?.columnAxis, items?.textProperties]).toEqual([
      "Select item",
      "page/select",
      [
        { name: "selected", values: ["off", "on"] },
        { name: "state", values: ["rest", "highlighted", "disabled"] },
      ],
      "state",
      [{ name: "Label", defaultValue: "Apple" }],
    ]);
  });

  it("insets a row that is not selected and keeps the Check's room at its end", () => {
    const root = variantRoot(spec, "select-item/selected=off,state=rest");
    expect(root).toMatchObject({
      sizing: { horizontal: fixed(literal(144)), vertical: HUG },
      limits: { minHeight: density("row-h") },
      paddingTop: density("row-py"),
      paddingRight: density("row-indicator-room"),
      paddingBottom: density("row-py"),
      paddingLeft: density("row-px"),
      itemSpacing: literal(8),
      cornerRadius: token("radius-lg"),
      fill: undefined,
      opacity: 1,
    });
    expect(outline(root.children)).toEqual(["text", "  label"]);
    const [text] = root.children;
    expect(text?.kind === "frame" ? [text.sizing.horizontal, text.children[0]] : undefined).toEqual([
      FILL,
      expect.objectContaining({
        characters: "Apple",
        textProperty: "Label",
        fontSize: literal(14),
        lineHeight: literal(20),
        color: paint("popover-foreground"),
      }),
    ]);
  });

  it("draws a selected row's Check after its text, in the room its end padding kept", () => {
    const root = variantRoot(spec, "select-item/selected=on,state=rest");
    expect([root.paddingRight, root.itemSpacing]).toEqual([density("row-px"), literal(8)]);
    expect(outline(root.children)).toEqual(["text", "  label", "indicator", "  check"]);
    expect(root.children[1]).toMatchObject({
      sizing: { horizontal: fixed(literal(16)), vertical: fixed(literal(16)) },
      children: [{ kind: "icon", icon: "icon/Check", size: literal(16), color: paint("popover-foreground") }],
    });
    expect(root.children[1]).not.toHaveProperty("absolute");
  });

  it("paints a highlighted row accent, its text and Check accent-foreground", () => {
    const root = variantRoot(spec, "select-item/selected=on,state=highlighted");
    const [text, indicator] = root.children;
    expect([
      root.fill,
      text?.kind === "frame" ? text.children[0] : undefined,
      indicator?.kind === "frame" ? indicator.children[0] : undefined,
    ]).toEqual([
      paint("accent"),
      expect.objectContaining({ color: paint("accent-foreground") }),
      expect.objectContaining({ color: paint("accent-foreground") }),
    ]);
  });

  it.each(["off", "on"])("dims a disabled row to half, selected %s", (selected) => {
    expect(variantRoot(spec, `select-item/selected=${selected},state=disabled`)).toMatchObject({
      opacity: 0.5,
      fill: undefined,
    });
  });
});

describe("the Select popup component set", () => {
  it("draws the popup surface 144px wide around Base UI's listbox", () => {
    const popup = set("select-popup");
    expect([popup?.name, popup?.page, popup?.axes]).toEqual([
      "Select popup",
      "page/select",
      [{ name: "content", values: ["flat", "grouped"] }],
    ]);
    const root = variantRoot(spec, "select-popup/content=flat");
    expect(root).toMatchObject({
      name: "select-content",
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(144)), vertical: HUG },
      paddingTop: literal(0),
      paddingRight: literal(0),
      paddingBottom: literal(0),
      paddingLeft: literal(0),
      fill: paint("popover"),
      cornerRadius: token("radius-lg"),
      clips: true,
    });
    // Tailwind's shadow-md, `0 4px 6px -1px` and `0 2px 4px -2px` at 10% black, below the 1px ring,
    // in Figma's order, where a later effect paints on top.
    const black10 = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } };
    expect(root.shadows).toEqual([
      { color: black10, offsetX: 0, offsetY: 2, radius: literal(4), spread: literal(-2) },
      { color: black10, offsetX: 0, offsetY: 4, radius: literal(6), spread: literal(-1) },
      { color: paint("foreground/10"), offsetX: 0, offsetY: 0, radius: literal(0), spread: literal(1) },
    ]);
  });

  it("holds the Basic demo's rows, each filling the popup, their labels set on the instances", () => {
    const root = variantRoot(spec, "select-popup/content=flat");
    const row = "select-item/selected=off,state=rest";
    expect(outline(root.children)).toEqual([
      "list",
      `  item-apple -> ${row}`,
      `  item-banana -> ${row}`,
      `  item-orange -> ${row}`,
      `  item-pear -> ${row}`,
    ]);
    const [list] = root.children;
    const rows = list?.kind === "frame" ? list.children : [];
    expect(
      rows.map((layer) =>
        layer.kind === "instance" ? [layer.sizing, layer.properties, layer.exposed] : undefined
      )
    ).toEqual([
      // Apple is the row set's own label, so its instance sets none.
      [{ horizontal: FILL, vertical: HUG }, undefined, true],
      ...["Banana", "Orange", "Pear"].map((label) => [
        { horizontal: FILL, vertical: HUG },
        { text: { Label: label } },
        true,
      ]),
    ]);
  });

  it("pads each group of the Groups demo and rounds its rows with the group's inner corner", () => {
    const root = variantRoot(spec, "select-popup/content=grouped");
    const row = "select-item/selected=off,state=rest";
    expect(outline(root.children)).toEqual([
      "list",
      "  group-citrus",
      "    label-citrus -> menu-group-label/kind=plain",
      `    item-lemon -> ${row}`,
      `    item-lime -> ${row}`,
      `    item-orange -> ${row}`,
      "  separator",
      "    box -> menu-separator/size=default",
      "  group-berries",
      "    label-berries -> menu-group-label/kind=plain",
      `    item-blueberry -> ${row}`,
      `    item-strawberry -> ${row}`,
    ]);
    const [list] = root.children;
    const [group, separator] = list?.kind === "frame" ? list.children : [];
    const pad = density("surface-pad-sm");
    expect(group).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      paddingTop: pad,
      paddingRight: pad,
      paddingBottom: pad,
      paddingLeft: pad,
    });
    expect(group?.kind === "frame" ? group.children[1] : undefined).toMatchObject({
      overrides: [{ path: [], field: "cornerRadius", value: density("radius-inner/lg-pad-sm") }],
    });
    // The rule spans the popup, which clips its negative margins, 4px from the groups on either side.
    expect(separator).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      paddingTop: literal(4),
      paddingRight: literal(0),
      paddingBottom: literal(4),
      paddingLeft: literal(0),
      children: [{ kind: "instance", sizing: { horizontal: FILL, vertical: fixed(literal(1)) } }],
    });
  });
});

describe("the Select (open) component set", () => {
  it.each(["default", "sm"])(
    "stacks the open trigger at size %s 4px above the popup, centered on it",
    (size) => {
      const root = variantRoot(spec, `select-open/placement=below,size=${size}`);
      expect(root).toMatchObject({
        direction: "VERTICAL",
        sizing: { horizontal: HUG, vertical: HUG },
        itemSpacing: literal(4),
        counterAlign: "CENTER",
        fill: undefined,
        // The popup's shadow reaches past the column.
        clips: false,
      });
      expect(outline(root.children)).toEqual([
        `trigger -> select-trigger/size=${size},state=rest,content=placeholder,open=on`,
        "popup -> select-popup/content=flat",
      ]);
      expect(root.children[1]).toMatchObject({
        sizing: { horizontal: fixed(literal(144)), vertical: HUG },
      });
    }
  );
});
