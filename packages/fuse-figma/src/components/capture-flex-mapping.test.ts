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
// item, and a row's `me-auto` on its first. Where the items and the gap overflow the box there is no
// free space, the margin takes none, and Chromium keeps the second item after the first (a 100px
// column with two 40px items 30px apart puts the second at 70px, where `space-between` puts it at
// 60px), so without the capture's measurement of the room in every mode the margin stays unmapped.
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

  it("spaces a row's two layers to its ends with me-auto on the first where the capture measured the room", async () => {
    const { variant } = await buildTwo("flex w-[100px]", "size-[8px] me-auto", "size-[8px]", ROOM);
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
  ])("leaves %s's auto margin unmapped without the measurement", async (classes, a, b, margin) => {
    const { variant, coverage } = await buildTwo(classes, a, b, {});
    expect(variant?.root.primaryAlign).not.toBe("SPACE_BETWEEN");
    expect(notesOf(coverage, margin).map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});
