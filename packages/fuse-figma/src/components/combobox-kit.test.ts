/**
 * Unit under test: the Combobox sets `Combobox item`, `Combobox empty`, `Combobox popup` and
 * `Combobox (open)` as the build produces them. Oracle: the Figma field each cell must carry, read by hand from
 * `combobox-variants.ts`, `menu-row-classes.ts`, `overlay-classes.ts` and `inner-corner/listbox.ts`,
 * and the widths Chromium measured on the compare page on 2026-10-25 under a 384px input: every popup
 * 412px wide, every row 404px.
 *
 * - A row is `w-full` in its list, at least `row-h` tall, inset by `row-py` and `row-px` with
 *   `row-px + 1.5rem` at its end, `gap-2`, rounded with the list's inner corner, `radius-md` less
 *   `surface-pad-sm`. Its text is its own, in 14px type on a 20px line. A selected row's Check,
 *   `absolute right-(--row-px)` after the text, sits in that end room, which the kit draws in flow:
 *   the row then pads its end by `row-px`.
 * - `data-highlighted:bg-accent data-highlighted:text-accent-foreground
 *   data-highlighted:**:text-accent-foreground` paints a highlighted row; `data-disabled:opacity-50`
 *   dims a disabled one.
 * - The empty message is `w-full` in the popup, padded as a row, `text-center` in `muted-foreground`.
 * - The popup is `bg-popover`, `rounded-md`,
 *   `overflow-hidden`, padding nothing, `min-w-[calc(var(--anchor-width)+--spacing(7))]`. Its list
 *   pads `surface-pad-sm` and caps at `min(--spacing(72) - --spacing(9), …)`, 252px, scrolling past
 *   it; an empty list pads nothing, so it is 0 tall.
 * - The open Combobox is Base UI's placement: the popup `side="bottom"`, `sideOffset={6}`,
 *   `align="start"` in `combobox.tsx`, below the input that `w-auto` stretches across its 384px host.
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

describe("the Combobox item component set", () => {
  it("holds selected off and on in 3 states on the Combobox page, its text a property", () => {
    const items = set("combobox-item");
    expect([items?.name, items?.page, items?.axes, items?.columnAxis, items?.textProperties]).toEqual([
      "Combobox item",
      "page/combobox",
      [
        { name: "selected", values: ["off", "on"] },
        { name: "state", values: ["rest", "highlighted", "disabled"] },
      ],
      "state",
      [{ name: "Label", defaultValue: "Apple" }],
    ]);
  });

  it("insets a row that is not selected, keeps the Check's room at its end and fills it with its text", () => {
    const root = variantRoot(spec, "combobox-item/selected=off,state=rest");
    expect(root).toMatchObject({
      direction: "HORIZONTAL",
      sizing: { horizontal: fixed(literal(404)), vertical: HUG },
      limits: { minHeight: density("row-h") },
      paddingTop: density("row-py"),
      paddingRight: density("row-indicator-room"),
      paddingBottom: density("row-py"),
      paddingLeft: density("row-px"),
      itemSpacing: literal(8),
      cornerRadius: density("radius-inner/md-pad-sm"),
      fill: undefined,
      opacity: 1,
    });
    expect(outline(root.children)).toEqual(["label"]);
    expect(root.children[0]).toMatchObject({
      characters: "Apple",
      textProperty: "Label",
      fontSize: literal(14),
      lineHeight: literal(20),
      color: paint("popover-foreground"),
      sizing: { horizontal: FILL },
    });
  });

  it("draws a selected row's Check after its text, in the room its end padding kept", () => {
    const root = variantRoot(spec, "combobox-item/selected=on,state=rest");
    expect([root.paddingRight, root.itemSpacing]).toEqual([density("row-px"), literal(8)]);
    expect(outline(root.children)).toEqual(["label", "indicator", "  check"]);
    expect(root.children[1]).toMatchObject({
      sizing: { horizontal: fixed(literal(16)), vertical: fixed(literal(16)) },
      children: [{ kind: "icon", icon: "icon/Check", size: literal(16), color: paint("popover-foreground") }],
    });
    expect(root.children[1]).not.toHaveProperty("absolute");
  });

  it("paints a highlighted row accent, its text and Check accent-foreground", () => {
    const root = variantRoot(spec, "combobox-item/selected=on,state=highlighted");
    const [label, indicator] = root.children;
    expect([root.fill, label, indicator?.kind === "frame" ? indicator.children[0] : undefined]).toEqual([
      paint("accent"),
      expect.objectContaining({ color: paint("accent-foreground") }),
      expect.objectContaining({ color: paint("accent-foreground") }),
    ]);
  });

  it.each(["off", "on"])("dims a disabled row to half, selected %s", (selected) => {
    expect(variantRoot(spec, `combobox-item/selected=${selected},state=disabled`)).toMatchObject({
      opacity: 0.5,
      fill: undefined,
    });
  });
});

describe("the Combobox empty component set", () => {
  it("centers the message across the popup, padded as a row, in muted-foreground", () => {
    const root = variantRoot(spec, "combobox-empty/content=empty");
    expect(root).toMatchObject({
      sizing: { horizontal: fixed(literal(412)), vertical: HUG },
      paddingTop: density("row-py"),
      paddingRight: density("row-px"),
      paddingBottom: density("row-py"),
      paddingLeft: density("row-px"),
      fill: undefined,
    });
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({
      characters: "No results.",
      textProperty: "Text",
      fontSize: literal(14),
      lineHeight: literal(20),
      color: paint("muted-foreground"),
      sizing: { horizontal: FILL, vertical: HUG },
      align: { horizontal: "CENTER" },
    });
  });
});

describe("the Combobox popup component set", () => {
  it("draws the popup surface as wide as the input plus 28px, its list padding the rows", () => {
    const popup = set("combobox-popup");
    expect([popup?.name, popup?.page, popup?.axes]).toEqual([
      "Combobox popup",
      "page/combobox",
      [{ name: "content", values: ["flat", "grouped", "empty"] }],
    ]);
    const root = variantRoot(spec, "combobox-popup/content=flat");
    expect(root).toMatchObject({
      name: "combobox-content",
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(412)), vertical: HUG },
      paddingTop: literal(0),
      paddingRight: literal(0),
      paddingBottom: literal(0),
      paddingLeft: literal(0),
      fill: paint("popover"),
      cornerRadius: token("radius-md"),
      clips: true,
    });
    const pad = density("surface-pad-sm");
    expect(root.children[0]).toMatchObject({
      name: "combobox-list",
      sizing: { horizontal: FILL, vertical: HUG },
      limits: { maxHeight: literal(252) },
      clips: true,
      paddingTop: pad,
      paddingRight: pad,
      paddingBottom: pad,
      paddingLeft: pad,
    });
  });

  it("holds the Basic demo's rows, each filling the list, their labels set on the instances", () => {
    const root = variantRoot(spec, "combobox-popup/content=flat");
    const row = "combobox-item/selected=off,state=rest";
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
        layer.kind === "instance"
          ? [layer.sizing, layer.properties, layer.overrides, layer.exposed]
          : undefined
      )
    ).toEqual([
      // Apple is the row set's own label, so its instance sets none, and every row rounds as the set does.
      [{ horizontal: FILL, vertical: HUG }, undefined, undefined, true],
      ...["Banana", "Orange", "Pear"].map((label) => [
        { horizontal: FILL, vertical: HUG },
        { text: { Label: label } },
        undefined,
        true,
      ]),
    ]);
  });

  it("holds the Groups demo's groups, the separator spanning the list between padded sections", () => {
    const root = variantRoot(spec, "combobox-popup/content=grouped");
    const row = "combobox-item/selected=off,state=rest";
    expect(outline(root.children)).toEqual([
      "list",
      "  section-0",
      "    group-citrus",
      "      label-citrus -> menu-group-label/kind=plain",
      `      item-lemon -> ${row}`,
      `      item-lime -> ${row}`,
      `      item-orange -> ${row}`,
      "  separator",
      "    box -> menu-separator/size=default",
      "  section-2",
      "    group-berries",
      "      label-berries -> menu-group-label/kind=plain",
      `      item-blueberry -> ${row}`,
      `      item-strawberry -> ${row}`,
    ]);
    const [list] = root.children;
    const [section, separator] = list?.kind === "frame" ? list.children : [];
    const pad = density("surface-pad-sm");
    // The separator's `-mx-(--surface-pad-sm)` cancels the list's padding across.
    expect(list).toMatchObject({ paddingTop: pad, paddingRight: literal(0), paddingLeft: literal(0) });
    expect(section).toMatchObject({ paddingRight: pad, paddingLeft: pad, paddingTop: literal(0) });
    expect(separator).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      paddingTop: literal(4),
      paddingBottom: literal(4),
      children: [{ kind: "instance", sizing: { horizontal: FILL, vertical: fixed(literal(1)) } }],
    });
  });

  it("shows the empty message alone, the list that holds no row and pads nothing drawn in no layer", () => {
    // CSS draws the empty list 0 tall, and Figma keeps an empty auto-layout frame at its last height (PE4).
    const root = variantRoot(spec, "combobox-popup/content=empty");
    expect(outline(root.children)).toEqual(["empty -> combobox-empty/content=empty"]);
    expect(root.children[0]).toMatchObject({ sizing: { horizontal: FILL, vertical: HUG }, exposed: true });
  });
});

describe("the Combobox (open) component set", () => {
  it("stacks the open input 6px above the popup, aligned to its start, the popup 28px wider", () => {
    const root = variantRoot(spec, "combobox-open/placement=below");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(384)), vertical: HUG },
      itemSpacing: literal(6),
      counterAlign: "MIN",
      fill: undefined,
      // The popup reaches past the column's end, and its shadow past the column.
      clips: false,
    });
    expect(outline(root.children)).toEqual([
      "input -> input-group/form=caret open,state=rest",
      "popup -> combobox-popup/content=flat",
    ]);
    expect(
      root.children.map((layer) => (layer.kind === "instance" ? layer.sizing.horizontal : undefined))
    ).toEqual([FILL, fixed(literal(412))]);
  });
});
