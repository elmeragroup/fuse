/**
 * How the build sizes and spaces a box from its flex and limit declarations: `flex: none`, logical padding, percentage limits and auto margins between two layers. The unit under test is `buildComponentSet` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that says what the
 * browser draws, or the Figma plugin typings that say what Figma draws, under the coverage contract,
 * where a declaration that does not reach Figma is `unmapped` and one with nothing to draw is
 * `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  buildChip,
  chip,
  fixed,
  fixedSize,
  frameOf,
  literal,
  notesOf,
  part,
  rest,
  UNLIMITED,
} from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { SetManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

// Oracle: CSS Flexbox 1 §7.1.1, where `flex: none` is `0 0 auto`: the item neither grows nor
// shrinks from its own size, which a fixed or hugging Figma layer keeps.
describe("flex: none", () => {
  it("drops on a flex item, which keeps its own size", async () => {
    const { variant, coverage } = await buildChip(
      "flex w-[100px]",
      [{ slot: "chip-dot", classes: "flex-none size-[16px]" }],
      {
        parts: [part()],
      }
    );
    expect(frameOf(variant?.root)?.sizing).toEqual(fixedSize(literal(16), literal(16)));
    expect(notesOf(coverage, "flex-none").map(([property, outcome]) => [property, outcome])).toEqual([
      ["flex", "dropped"],
    ]);
  });
});

// Oracle: CSS Logical Properties 1 §4. On the horizontal, left-to-right page the kit draws, the
// inline start is the left and the inline end the right, so `ps-*` and `pe-*` pad those sides.
describe("logical padding", () => {
  it("pads the left for the inline start and the right for the inline end", async () => {
    const { variant, coverage } = await buildChip("flex ps-[8px] pe-[12px]");
    expect([variant?.root.paddingLeft, variant?.root.paddingRight]).toEqual([literal(8), literal(12)]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });
});

// Oracle: CSS 2.1 §10.4 and the capture's `underMaxWidth` fact. A maximum the box's width stays
// under never moves it, which the capture proves by measuring the box as wide with its maximum 24px
// lower; a percentage maximum the build cannot resolve then drops instead of staying unmapped.
describe("a percentage maximum the capture measured", () => {
  it("drops where the box is as wide with its maximum 24px lower", async () => {
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "flex w-fit p-[4px] max-w-full", measured: { underMaxWidth: true } })
    );
    expect(variant?.root.limits).toEqual(UNLIMITED);
    expect(notesOf(coverage, "max-w-full").map(([property, outcome]) => [property, outcome])).toEqual([
      ["max-width", "dropped"],
    ]);
  });

  it("stays unmapped without the measurement", async () => {
    const { coverage } = await buildChip("flex w-fit p-[4px] max-w-full");
    expect(notesOf(coverage, "max-w-full").map(([property, outcome]) => [property, outcome])).toEqual([
      ["max-width", "unmapped"],
    ]);
  });
});

// Oracle: CSS 2.1 §10.4. A fixed width resolves against its limits, lowered to the maximum and
// raised to the minimum, and a percentage limit takes the containing block's width: in a 320px
// preview, `max-w-full` is 320px and `min-w-40` 160px, so a 200px box keeps its width and a 400px
// box is 320px wide.
describe("a percentage limit beside a fixed width", () => {
  it("drops limits that never move the width", async () => {
    const { variant, coverage } = await buildChip("flex w-[200px] min-w-40 max-w-full", [], {
      previewWidth: 320,
    });
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(200)));
    expect(
      coverage
        .filter((row) => ["min-width", "max-width"].includes(row.property))
        .map((row) => [row.property, row.outcome])
    ).toEqual([
      ["min-width", "dropped"],
      ["max-width", "dropped"],
    ]);
  });

  it("folds a maximum that lowers the width into it", async () => {
    const { variant } = await buildChip("flex w-[400px] max-w-full", [], { previewWidth: 320 });
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(320)));
  });
});

// Oracle: CSS Flexbox 1 §8.1 and the capture's `freeAlongMain` fact. An auto margin between two items
// of a flex box takes the free space along its direction before `justify-content` does, so the items
// sit at the box's two ends, as `space-between` places two items: a column's `mt-auto` on its last
// item, a row's `me-auto` on its first and its `ms-auto` on its last. Where the items and the gap
// overflow the box there is no free space, the margin takes none, and Chromium keeps the second item
// after the first (a 100px column with two 40px items 30px apart puts the second at 70px, where
// `space-between` puts it at 60px). Where they fill it exactly, as two 40px items 20px apart in a
// 100px row, the margin takes nothing either. So without the capture's measurement of the room in
// every mode the margin stays unmapped.
describe("an auto margin between two layers", () => {
  const TWO: Partial<SetManifest> = {
    parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })],
  };

  /** Build a chip whose root wins `classes` around the two parts, with the facts measured of the root. */
  function buildTwo(classes: string, a: string, b: string, measured: MeasuredFacts) {
    return buildCaptured(
      chip(TWO),
      rest({
        slot: "chip",
        classes,
        measured,
        children: [
          { slot: "a", classes: a },
          { slot: "b", classes: b },
        ],
      })
    );
  }

  const ROOM: MeasuredFacts = { freeAlongMain: true };

  it("spaces a column's two layers to its ends with mt-auto on the last where the capture measured the room", async () => {
    const { variant, coverage } = await buildTwo(
      "flex flex-col h-[100px]",
      "size-[8px]",
      "size-[8px] mt-auto",
      ROOM
    );
    expect(variant?.root.primaryAlign).toBe("SPACE_BETWEEN");
    expect(notesOf(coverage, "mt-auto").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-top", "literal"],
    ]);
  });

  it.each([
    ["me-auto on the first", "size-[8px] me-auto", "size-[8px]"],
    ["ms-auto on the last", "size-[8px]", "size-[8px] ms-auto"],
  ])("spaces a row's two layers to its ends with %s where the capture measured the room", async (_, a, b) => {
    const { variant } = await buildTwo("flex w-[100px]", a, b, ROOM);
    expect(variant?.root.primaryAlign).toBe("SPACE_BETWEEN");
  });

  it.each([
    [
      "flex flex-col h-[100px] gap-[30px]",
      "flex-none h-[40px] w-[8px]",
      "flex-none h-[40px] w-[8px] mt-auto",
      "mt-auto",
    ],
    ["flex w-[100px]", "size-[8px] me-auto", "size-[8px]", "me-auto"],
    [
      "flex w-[100px] gap-[20px]",
      "flex-none w-[40px] h-[8px]",
      "flex-none w-[40px] h-[8px] ms-auto",
      "ms-auto",
    ],
  ])("leaves %s's auto margin unmapped without the measurement", async (classes, a, b, margin) => {
    const { variant, coverage } = await buildTwo(classes, a, b, {});
    expect(variant?.root.primaryAlign).not.toBe("SPACE_BETWEEN");
    expect(notesOf(coverage, margin).map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Flexbox 1 §9.7. A row's item that grows from a zero basis takes the free space less
// its own margins, so a frame that fills the row, padded by the margins, around the item that fills
// it, draws the same widths. An item at `w-full` is the whole row's width and its margins reach past
// the row (in a 200px row, `mx-[8px]` puts its right edge at 208px), which no filling frame draws.
describe("margins on a row's growing item", () => {
  it("draw as a filling frame padded by the margins, around the item that fills it", async () => {
    const { variant, coverage } = await buildChip(
      "flex w-[200px]",
      [
        { slot: "a", classes: "flex-1 h-[8px] mx-[8px]" },
        { slot: "b", classes: "size-[20px]" },
      ],
      { parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] }
    );
    const frame = frameOf(variant?.root);
    expect([frame?.sizing.horizontal, frame?.paddingLeft, frame?.paddingRight]).toEqual([
      { kind: "fill" },
      literal(8),
      literal(8),
    ]);
    expect(frameOf(frame)?.sizing.horizontal).toEqual({ kind: "fill" });
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("stay unmapped on an item 100% as wide as the row", async () => {
    const { coverage } = await buildChip(
      "flex w-[200px]",
      [{ slot: "chip-dot", classes: "w-full shrink-0 h-[8px] mx-[8px]" }],
      { parts: [part()] }
    );
    expect(notesOf(coverage, "mx-[8px]").map(([, outcome]) => outcome)).toEqual(["unmapped", "unmapped"]);
  });
});

// Oracle: CSS Flexbox 1 §8.1 and §9.7. On the last of three layers, after the row's own text, an auto
// start margin takes the row's free space, and a label that grows would take it first, so the margin
// ends the row with the last layer at any free space of zero or more. A Figma label that fills that
// room draws the same, since a text paints nothing past its characters. Where the layers overflow the
// row, CSS keeps the text at its min-content width and Figma shrinks it, so the margin maps only where
// the capture measured the row fitting its layers in every mode (`fitsAlongMain`), not 24px of room.
describe("an auto start margin after a row's own text", () => {
  /** Build a menu-like row: a dot, its own text and a shortcut with `ml-auto`, with the root's facts. */
  function buildRow(measured: MeasuredFacts) {
    return buildCaptured(
      chip({
        label: {
          key: "label",
          name: "label",
          characters: "Profile",
          textProperty: "Label",
          shownIn: () => true,
        },
        parts: [part(), { ...part({ key: "shortcut", slot: "chip-shortcut" }), after: "label" }],
      }),
      rest({
        slot: "chip",
        classes: "flex w-[160px] items-center gap-[8px] font-sans text-[14px] leading-[20px] text-[#000000]",
        text: "Profile",
        textIndex: 1,
        measured,
        children: [
          { slot: "chip-dot", classes: "size-[8px] shrink-0" },
          { slot: "chip-shortcut", classes: "ml-auto size-[8px] shrink-0" },
        ],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
  }

  it("lets the label fill the room before the last layer where the capture measured the row fitting", async () => {
    const { coverage } = await buildRow({ fitsAlongMain: true });
    expect(notesOf(coverage, "ml-auto").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-left", "literal"],
    ]);
  });

  it("stays unmapped without the measurement that the row fits in every mode", async () => {
    const { coverage } = await buildRow({});
    expect(notesOf(coverage, "ml-auto").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});
