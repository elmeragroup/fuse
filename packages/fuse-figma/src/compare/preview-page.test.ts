import { describe, expect, it } from "vitest";

import type { BoxDefinition, ComponentDefinition } from "../components/component-spec.ts";
import { MAX_PAGE_HEIGHT, PAGE_LAYOUT, pageBatches, shownParts } from "./preview-page.ts";

/** A cell of one slot with its resting twin, as a forced cell puts on its page. */
const twinned = () => [{}, {}];

describe("pageBatches", () => {
  it("fills each page with eight rows of six slots and keeps the order", () => {
    // 16px of top margin and eight 464px rows make 3,728px: 48 slots, so 24 cells with twins.
    const items = Array.from({ length: 50 }, (_, index) => index);
    const pages = pageBatches(PAGE_LAYOUT, items, twinned, MAX_PAGE_HEIGHT);
    expect(pages.map((page) => page.length)).toEqual([24, 24, 2]);
    expect(pages.flat()).toEqual(items);
  });

  it("gives a cell taller than the limit a page of its own", () => {
    // A 3,800px root needs a 3,816px row of its own, past 3,728px with any margin.
    const cellsOf = (item: string) => (item === "tall" ? [{ height: 3800 }] : [{}]);
    const pages = pageBatches(PAGE_LAYOUT, ["a", "tall", "b"], cellsOf, MAX_PAGE_HEIGHT);
    expect(pages).toEqual([["a"], ["tall"], ["b"]]);
  });

  it("returns no page for no cells", () => {
    expect(pageBatches(PAGE_LAYOUT, [], twinned, MAX_PAGE_HEIGHT)).toEqual([]);
  });
});

describe("shownParts", () => {
  const extra = { name: "Extra", defaultValue: false };
  const never = () => false;
  const always = () => true;
  const noIcons = () => [];
  // Three parts behind one BOOLEAN: one the cell never shows, one inside a group the cell never
  // shows, and one whose label's text follows the cell's state.
  const row: BoxDefinition & Pick<ComponentDefinition, "name" | "slot"> = {
    name: "Row",
    slot: "row",
    label: undefined,
    iconsFor: noIcons,
    parts: [
      {
        key: "badge",
        slot: "row-badge",
        shownIn: never,
        optional: extra,
        label: {
          key: "badge-text",
          name: "Badge",
          shownIn: always,
          characters: "New",
          textProperty: undefined,
        },
        iconsFor: noIcons,
      },
      {
        key: "group",
        slot: "row-group",
        shownIn: never,
        label: undefined,
        iconsFor: noIcons,
        parts: [
          {
            key: "tip",
            slot: "row-tip",
            shownIn: always,
            optional: extra,
            label: undefined,
            iconsFor: noIcons,
          },
        ],
      },
      {
        key: "hint",
        slot: "row-hint",
        shownIn: always,
        optional: extra,
        label: { key: "hint-text", name: "Hint", shownIn: always, charactersFor: (cell) => cell.state ?? "" },
        iconsFor: noIcons,
      },
    ],
  };

  it("picks only the parts the cell shows, ancestors included, with the text the cell gives them", () => {
    expect(shownParts(row, { state: "hover" }, "Extra", new Set(["Extra"]))).toEqual([
      {
        key: "hint",
        selector: '[data-slot="row"] [data-slot="row-hint"]',
        foundBy: "element",
        text: "hover",
      },
    ]);
  });
});
