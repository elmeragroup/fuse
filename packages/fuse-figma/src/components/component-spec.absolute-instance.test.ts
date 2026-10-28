/**
 * An instance part placed absolutely, as a Sidebar menu badge sits over the end of its menu row.
 * Unit under test: `buildSetsInOrder`, through the fixture build, on a `relative` list item that holds
 * a row instance in its flow and a badge instance out of it. Oracle: CSS 2.1 §10.3.7 and §10.6.4, where
 * an absolute box with `right` set and `left` auto ends `right` from its containing block's padding
 * edge, and `top` places its top that far below the padding edge, and probe N11, where Figma keeps a
 * MAX instance's end inset and a CENTER instance's offset from its parent's centre as the instance
 * and the parent resize, a density switch included. A `top` that is one length in every mode keeps the
 * instance's top that far below the padding edge whatever the parent's height, which Figma's MIN keeps,
 * measured from the frame's top edge, so across the parent's top border too, as an overlay's corner
 * close sits 16px in from its popup's top right (`absolute top-4 right-4`).
 */
import { describe, expect, it } from "vitest";

import { fixed, FILL, HUG, literal } from "../../test/built-kit";
import { buildFixtures, chip } from "../../test/fixture-sets";
import type { ComponentDefinition, InstanceDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";

const VARIABLES = makeVariableIndex([
  { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  { ref: { collection: "Fuse density", name: "row-h" }, webSyntax: "var(--row-h)", minimum: 32, maximum: 36 },
]);

const ROW_H = { kind: "variable", variable: { collection: "Fuse density", name: "row-h" } } as const;

/** A menu row as tall as `row-h`, filling its item. */
const ROW = chip("flex h-(--row-h) w-full items-center", { key: "row", name: "Row", slot: "row" });

/** The Sidebar menu badge's box and place, with its count, at the given offsets. */
function badge(offsets: string): ComponentDefinition {
  return chip(
    `font-sans text-[12px] leading-[16px] text-[#000000] absolute ${offsets} flex h-5 min-w-5 items-center justify-center px-1`,
    {
      key: "badge",
      name: "Badge",
      slot: "badge",
      label: { key: "label", name: "label", characters: "24", textProperty: "Count", shownIn: () => true },
    }
  );
}

/** The badge's offsets in Fuse: 4px from the end, its 20px centred on a `row-h` row. */
const SIDEBAR_OFFSETS = "right-1 top-[calc(var(--row-h)/2-0.625rem)]";

const instanceOf = (key: string, of: ComponentDefinition): InstanceDefinition => ({
  kind: "instance",
  key,
  of,
  cell: () => ({ state: "rest" }),
  shownIn: () => true,
});

/** A `relative` list item 240px wide that holds the row and the badge. */
function item(inner: ComponentDefinition, classes = "relative w-[240px]"): ComponentDefinition {
  return chip(classes, {
    key: "item",
    name: "Item",
    slot: "item",
    element: { tag: "li", attributes: {} },
    elementDefaults: [{ className: "user agent style sheet, li", property: "display", value: "list-item" }],
    parts: [instanceOf("row", ROW), instanceOf("badge", inner)],
  });
}

async function buildItem(inner: ComponentDefinition, classes?: string) {
  const [, , built] = await buildFixtures([ROW, inner, item(inner, classes)], { variables: VARIABLES });
  return { root: built?.componentSet.variants[0]?.root, coverage: built?.coverage ?? [] };
}

/** The property, outcome and detail of the badge's coverage rows in the item's set, by property. */
const badgeRows = (coverage: readonly CoverageRow[]) =>
  coverage
    .filter((row) => row.part === "badge")
    .map((row) => [row.property, row.outcome, row.detail])
    .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : left > right ? 1 : 0));

/** The outcome and detail of the item's own `relative`. */
const itemPosition = (coverage: readonly CoverageRow[]) =>
  coverage
    .filter((row) => row.part === "item" && row.property === "position")
    .map((row) => [row.outcome, row.detail]);

/** Why an item that holds a placed instance drops its `relative`. */
const ANCHORS =
  "it anchors the absolute instance it holds, whose MAX × CENTER constraints place it against this frame (N11)";

describe("an absolute instance part", () => {
  it("ends 4px from its item's end and centres on the row in every mode, MAX × CENTER", async () => {
    const { root, coverage } = await buildItem(badge(SIDEBAR_OFFSETS));
    expect(
      root?.children.map((layer) => [layer.name, layer.kind === "instance" ? layer.sizing : undefined])
    ).toEqual([
      ["row", { horizontal: FILL, vertical: fixed(ROW_H) }],
      ["badge", { horizontal: HUG, vertical: fixed(literal(20)) }],
    ]);
    const [, placed] = root?.children ?? [];
    expect(placed?.kind === "instance" ? placed.absolute : undefined).toEqual({
      constraints: { horizontal: "MAX", vertical: "CENTER" },
      endInset: 4,
      centerOffset: 0,
    });
    expect(badgeRows(coverage)).toEqual([]);
    expect(itemPosition(coverage)).toEqual([["dropped", ANCHORS]]);
  });

  // A top that is a quarter of `row-h`, 8px or 9px, keeps no one length below the item's top, and puts
  // the badge's centre 8px or 9px above the row's centre, so it keeps no one offset from the centre.
  it("stays unmapped where its top keeps neither one length nor one offset from the item's centre", async () => {
    const { root, coverage } = await buildItem(badge("right-1 top-[calc(var(--row-h)/4)]"));
    const [, placed] = root?.children ?? [];
    const detail =
      "the absolute instance's top keeps neither one length below its parent's top nor one offset from its parent's centre in every mode, which MIN or CENTER keeps";
    expect(placed?.kind === "instance" ? placed.absolute : "not an instance").toBeUndefined();
    expect(badgeRows(coverage)).toEqual([
      ["position", "unmapped", `in the badge instance, ${detail}`],
      ["right", "unmapped", `in the badge instance, ${detail}`],
      ["top", "unmapped", `in the badge instance, ${detail}`],
    ]);
    expect(itemPosition(coverage)).toEqual([
      ["dropped", "it only anchors positioned descendants, which auto layout does not need"],
    ]);
  });

  // `top-4 right-4` puts the instance 16px from the item's end and its top 16px below the item's top
  // whatever the item's height, as the overlay corner close sits in its popup.
  it("ends 16px from its item's end and sits 16px below its top in every mode, MAX × MIN", async () => {
    const { root, coverage } = await buildItem(badge("right-4 top-4"));
    const [, placed] = root?.children ?? [];
    expect(placed?.kind === "instance" ? placed.absolute : undefined).toEqual({
      constraints: { horizontal: "MAX", vertical: "MIN" },
      endInset: 16,
      topInset: 16,
    });
    expect(badgeRows(coverage)).toEqual([]);
    expect(itemPosition(coverage)).toEqual([
      [
        "dropped",
        "it anchors the absolute instance it holds, whose MAX × MIN constraints place it against this frame",
      ],
    ]);
  });

  // CSS offsets an absolute box from its containing block's padding edge, inside the border, and Figma
  // places a layer from its frame's top edge, so the inset counts the item's 2px top border.
  it("counts its item's top border into the top inset", async () => {
    const { root } = await buildItem(
      badge("right-4 top-4"),
      "relative w-[240px] border-t-2 border-[#000000]"
    );
    const [, placed] = root?.children ?? [];
    expect(placed?.kind === "instance" ? placed.absolute : undefined).toEqual({
      constraints: { horizontal: "MAX", vertical: "MIN" },
      endInset: 16,
      topInset: 18,
    });
  });

  // The box around the item stacks its blocks, so its stacking reads what every instance below it
  // paints, the placed badge included (`stacking.ts`).
  it("places the badge where a box that stacks blocks holds the item as a part", async () => {
    const inner = badge(SIDEBAR_OFFSETS);
    const list = chip("block w-[240px]", {
      key: "list",
      name: "List",
      slot: "list",
      parts: [
        {
          key: "item",
          slot: undefined,
          element: { tag: "li", attributes: {} },
          shownIn: () => true,
          classesFor: () => "relative",
          label: undefined,
          iconsFor: () => [],
          elementDefaults: [
            { className: "user agent style sheet, li", property: "display", value: "list-item" },
          ],
          parts: [instanceOf("row", ROW), instanceOf("badge", inner)],
        },
      ],
    });
    const [, , built] = await buildFixtures([ROW, inner, list], { variables: VARIABLES });
    expect(itemPosition(built?.coverage ?? [])).toEqual([["dropped", ANCHORS]]);
    const [item] = built?.componentSet.variants[0]?.root.children ?? [];
    const [, placed] = item?.kind === "frame" ? item.children : [];
    expect(placed?.kind === "instance" ? placed.absolute : undefined).toEqual({
      constraints: { horizontal: "MAX", vertical: "CENTER" },
      endInset: 4,
      centerOffset: 0,
    });
  });
});
