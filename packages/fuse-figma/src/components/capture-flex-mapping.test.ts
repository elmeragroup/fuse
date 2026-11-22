/**
 * How the build sizes and spaces a box from its flex and limit declarations: `flex: none`, logical padding, percentage limits, auto margins between two layers or on a row's first or last of three and a row's stretch. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
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
  FILL,
  fixed,
  fixedSize,
  frameOf,
  HUG,
  ICON,
  literal,
  notesOf,
  part,
  rest,
  textOf,
  UNLIMITED,
} from "../../test/capture-fixtures";
import type { FixtureOptions } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { SetManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec } from "./kit-spec";

/** A build whose `font-sans` binds the synced family, as every kit label's does. */
const FONT_SANS: FixtureOptions = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

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

// Oracle: CSS 2.1 §10.4 and CSS Flexbox 1 §9.2 step 3 and §9.7, with Chromium's layout of each
// case. In a 320px column, `w-full min-w-full` is 320px, the minimum of the length's own basis,
// which a fill with no minimum draws. A maximum below it loses to the minimum: `w-full min-w-full
// max-w-[200px]` is still 320px, which a fill capped at 200px would not draw, and so is `w-full
// min-w-full max-w-[min(var(--available-width),200px)]` with 800px available. In a 64px row,
// `flex-1 w-[80px] min-w-[80px]` grows from a zero basis and its minimum raises it to 80px, which a
// fill with no minimum would draw at 64px. Beside a 20px layer, `flex-1 w-full min-w-full` is
// raised to the whole 64px row, where a fill would take only the 44px the other layer leaves.
describe("a minimum of the same value as a length that is not fixed", () => {
  it("drops beside a whole 100% that fills a column", async () => {
    const { variant, coverage } = await buildChip(
      "flex flex-col w-[320px]",
      [{ slot: "chip-dot", classes: "w-full min-w-full h-[8px]" }],
      { parts: [part()] }
    );
    const dot = frameOf(variant?.root);
    expect([dot?.sizing.horizontal, dot?.limits]).toEqual([FILL, {}]);
    expect(notesOf(coverage, "min-w-full").map(([property, outcome]) => [property, outcome])).toEqual([
      ["min-width", "dropped"],
    ]);
  });

  it("stays unmapped beside a maximum it overrides", async () => {
    const { coverage } = await buildChip(
      "flex flex-col w-[320px]",
      [{ slot: "chip-dot", classes: "w-full min-w-full max-w-[200px] h-[8px]" }],
      { parts: [part()] }
    );
    expect(notesOf(coverage, "min-w-full").map(([property, outcome]) => [property, outcome])).toEqual([
      ["min-width", "unmapped"],
    ]);
  });

  it("stays unmapped beside a maximum that reads a room the build does not resolve", async () => {
    const { coverage } = await buildChip(
      "flex flex-col w-[320px]",
      [{ slot: "chip-dot", classes: "w-full min-w-full max-w-[min(var(--available-width),200px)] h-[8px]" }],
      { parts: [part()] }
    );
    expect(notesOf(coverage, "min-w-full").map(([property, outcome]) => [property, outcome])).toEqual([
      ["min-width", "unmapped"],
    ]);
  });

  it("stays the fill's minimum beside a zero flex basis", async () => {
    const { variant } = await buildChip(
      "flex w-[64px]",
      [{ slot: "chip-dot", classes: "flex-1 w-[80px] min-w-[80px] h-[8px]" }],
      { parts: [part()] }
    );
    const dot = frameOf(variant?.root);
    expect([dot?.sizing.horizontal, dot?.limits]).toEqual([FILL, { minWidth: literal(80) }]);
  });

  it("stays unmapped on a layer that grows from a zero basis beside another", async () => {
    const { coverage } = await buildChip(
      "flex w-[64px]",
      [
        { slot: "a", classes: "flex-1 w-full min-w-full h-[8px]" },
        { slot: "b", classes: "size-[20px] shrink-0" },
      ],
      { parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] }
    );
    expect(notesOf(coverage, "min-w-full").map(([property, outcome]) => [property, outcome])).toEqual([
      ["min-width", "unmapped"],
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

// Oracle: CSS Flexbox 1 §8.1 and the capture's `freeAlongMain` fact, which the capture measures with
// the row's items packed at its start. On the first of three items, an auto end margin takes the
// row's free space before `justify-content` places them, so in a 200px row of three 20px items 8px
// apart the first sits at x 0 and the others at x 152 and x 180, with `justify-end` set or not, as
// Tour's footer sets Skip, Back and Next. A Figma row packed at its start, holding the first layer
// and a frame that fills the rest (172px) and packs the other two at its end 8px apart, draws them at
// the same x. On the last of the three, an auto start margin takes the same free space before it, so
// the first two sit at x 0 and x 28 and the last at x 180, as a Date range picker's field box sets
// its inputs and its trigger. A row packed at its start, holding a frame that fills the 172px before
// the last layer and packs the other two at its start 8px apart, then the last layer, draws them at
// the same x. A first part whose `flex` shorthand sets a grow factor of 0, as `flex-[0_0_auto]`
// does, keeps its 20px as `flex-none` would (CSS Flexbox 1 §7.2), and so does one whose `grow-0`
// wins `flex-grow` over the `flex-auto` before it (CSS Cascade 4 §6), so the row draws the same. Without
// the measurement the margin may take nothing, so it stays unmapped and the row holds its three
// layers.
describe("an auto margin on the first or the last of a row's three layers", () => {
  const THREE: Partial<SetManifest> = {
    parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" }), part({ key: "c", slot: "c" })],
  };

  /**
   * Build a chip whose row holds three parts, `me-auto` on the first, with the root's facts: 20px
   * squares unless the parts' classes say otherwise.
   */
  function buildThree(
    classes: string,
    measured: MeasuredFacts,
    parts: readonly [string, string, string] = ["size-[20px] me-auto", "size-[20px]", "size-[20px]"]
  ) {
    const [a, b, c] = parts;
    return buildCaptured(
      chip(THREE),
      rest({
        slot: "chip",
        classes,
        measured,
        children: [
          { slot: "a", classes: a },
          { slot: "b", classes: b },
          { slot: "c", classes: c },
        ],
      })
    );
  }

  /** A row's layout and its layers by key, each frame that holds layers with its own layout. */
  type RowLayout = {
    readonly primaryAlign: string | undefined;
    readonly itemSpacing: unknown;
    readonly layers: readonly (
      | string
      | (RowLayout & { readonly key: string; readonly horizontal: unknown })
    )[];
  };

  /** The row's layout and its layers by key, as {@link RowLayout} reads them. */
  function layoutOf(box: BoxSpec | undefined): RowLayout {
    return {
      primaryAlign: box?.primaryAlign,
      itemSpacing: box?.itemSpacing,
      layers: (box?.children ?? []).map((child) =>
        child.kind === "frame" && child.children.length > 0
          ? { key: child.key, horizontal: child.sizing.horizontal, ...layoutOf(child) }
          : child.key
      ),
    };
  }

  /** The three parts' classes with the margin on the first part, and with it on the last. */
  const FIRST_MARGINED = ["size-[20px] me-auto", "size-[20px]", "size-[20px]"] as const;
  const LAST_MARGINED = ["size-[20px]", "size-[20px]", "size-[20px] ms-auto"] as const;

  it.each([
    [
      "me-auto",
      "margin-right",
      FIRST_MARGINED,
      "sets no justify-content",
      "flex w-[200px] items-center gap-[8px]",
    ],
    [
      "me-auto",
      "margin-right",
      FIRST_MARGINED,
      "sets justify-end",
      "flex w-[200px] items-center justify-end gap-[8px]",
    ],
    [
      "ms-auto",
      "margin-left",
      LAST_MARGINED,
      "sets no justify-content",
      "flex w-[200px] items-center gap-[8px]",
    ],
    [
      "ms-auto",
      "margin-left",
      LAST_MARGINED,
      "sets justify-end",
      "flex w-[200px] items-center justify-end gap-[8px]",
    ],
  ] as const)(
    "draws %s's far side in a frame that fills the rest of the row where the row %s",
    async (margin, property, parts, _, classes) => {
      const { variant, coverage } = await buildThree(classes, { freeAlongMain: true }, parts);
      const frame = { horizontal: FILL, itemSpacing: literal(8) };
      expect(layoutOf(variant?.root)).toEqual({
        primaryAlign: "MIN",
        itemSpacing: literal(8),
        layers:
          margin === "me-auto"
            ? ["a", { ...frame, key: "a end", primaryAlign: "MAX", layers: ["b", "c"] }]
            : [{ ...frame, key: "c start", primaryAlign: "MIN", layers: ["a", "b"] }, "c"],
      });
      expect(notesOf(coverage, margin).map(([read, outcome]) => [read, outcome])).toEqual([
        [property, "literal"],
      ]);
      expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
    }
  );

  it.each([
    ["flex shorthand sets a grow factor of 0", "size-[20px] flex-[0_0_auto] me-auto"],
    ["grow-0 wins its flex-grow over flex-auto", "size-[20px] flex-auto grow-0 me-auto"],
  ])("draws the frame where the margined part's %s", async (_, first) => {
    const { variant, coverage } = await buildThree(
      "flex w-[200px] items-center gap-[8px]",
      { freeAlongMain: true },
      [first, "size-[20px]", "size-[20px]"]
    );
    expect(layoutOf(variant?.root).layers).toEqual([
      "a",
      { key: "a end", horizontal: FILL, itemSpacing: literal(8), primaryAlign: "MAX", layers: ["b", "c"] },
    ]);
    expect(notesOf(coverage, "me-auto").map(([read, outcome]) => [read, outcome])).toEqual([
      ["margin-right", "literal"],
    ]);
  });

  // Oracle: CSS Flexbox 1 §9.4 step 15. A row 100px tall has one line 100px tall, so a `self-stretch`
  // item with no height of its own is 100px tall while a 20px item centres in the line, as Chromium
  // lays out the row. A Figma layer that fills a hugging frame's height takes only the frame's, so
  // the frame fills the row's height, and its centred alignment places the 20px layer as the row did.
  it("fills the row's height with the frame where a layer it holds stretches", async () => {
    const { variant, coverage } = await buildThree(
      "flex w-[200px] h-[100px] items-center gap-[8px]",
      { freeAlongMain: true },
      ["size-[20px] me-auto", "w-[20px] self-stretch", "size-[20px]"]
    );
    const frame = variant?.root.children.find((child) => child.key === "a end");
    expect(frame?.kind === "frame" ? [frame.sizing, frame.counterAlign] : undefined).toEqual([
      { horizontal: FILL, vertical: FILL },
      "CENTER",
    ]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  /** The root's facts: none, or the room the capture measured for the margin. */
  const NONE: MeasuredFacts = {};
  const FREE: MeasuredFacts = { freeAlongMain: true };

  // Oracle: CSS Flexbox 1 §8.1, §9.4 and §9.7. Without the measurement the margin may take nothing,
  // on the first part or the last. An auto start margin on the last part shares the free space with
  // the first's, so CSS sets the second part in the middle of the row, at x 90 in Chromium, where no
  // frame that packs the parts at its end draws it. In a row that hugs its height, a `self-stretch`
  // part beside a 40px first part and a 20px last part stretches to 40px, the line's height, as
  // Chromium lays it out, while the frame that hugs the two parts after the first is 20px tall and
  // the part fills only that. A first part that grows up to a 140px cap takes the free space before
  // its margin does, so in a 240px row before two 20px parts 8px apart it grows to 140px and its
  // margin takes the 44px left, which puts the second part at x 192, while a frame that fills beside
  // a part that fills splits the 232px between them. A `flex-auto` after a `grow-0` wins `flex-grow`
  // (CSS Cascade 4 §6), so that part grows the same. Each leaves the margin unmapped and the row's three layers
  // as they are.
  it.each([
    [
      "me-auto",
      "without the measurement",
      "flex w-[200px] items-center justify-end gap-[8px]",
      NONE,
      FIRST_MARGINED,
    ],
    ["ms-auto", "without the measurement", "flex w-[200px] items-center gap-[8px]", NONE, LAST_MARGINED],
    [
      "me-auto",
      "where a later part sets an auto start margin",
      "flex w-[200px] items-center gap-[8px]",
      FREE,
      ["size-[20px] me-auto", "size-[20px]", "size-[20px] ms-auto"],
    ],
    [
      "me-auto",
      "where a part stretches across a row that hugs its height",
      "flex w-[200px] items-center gap-[8px]",
      FREE,
      ["w-[20px] h-[40px] me-auto", "w-[20px] self-stretch", "size-[20px]"],
    ],
    [
      "me-auto",
      "where the first part grows up to a cap",
      "flex w-[240px] items-center gap-[8px]",
      FREE,
      ["h-[20px] flex-1 max-w-[140px] me-auto", "size-[20px]", "size-[20px]"],
    ],
    [
      "me-auto",
      "where the first part's flex-auto wins its flex-grow over the grow-0 before it",
      "flex w-[240px] items-center gap-[8px]",
      FREE,
      ["h-[20px] max-w-[140px] grow-0 flex-auto me-auto", "size-[20px]", "size-[20px]"],
    ],
  ] as const)(
    "leaves %s unmapped and the three layers in the row %s",
    async (margin, _, classes, measured, parts) => {
      const { variant, coverage } = await buildThree(classes, measured, parts);
      expect(variant?.root.children.map((child) => child.key)).toEqual(["a", "b", "c"]);
      expect(notesOf(coverage, margin).map(([, outcome]) => outcome)).toEqual(["unmapped"]);
    }
  );

  // Oracle: CSS Flexbox 1 §8.1 and §9.4. A first part a BOOLEAN property hides takes its auto margin
  // out of the row, so the others follow `justify-content`: with none set, Chromium lays them out at
  // x 0 and x 28, where a frame that packs them at its end keeps them at x 152 and x 180. The margin
  // stays unmapped and the row holds its three layers.
  it("leaves the margin unmapped and the three layers in the row where the first part is optional", async () => {
    const { variant, coverage } = await buildCaptured(
      chip({
        parts: [
          part({ key: "a", slot: "a", optional: { name: "First", defaultValue: true } }),
          part({ key: "b", slot: "b" }),
          part({ key: "c", slot: "c" }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex w-[200px] items-center gap-[8px]",
        measured: FREE,
        children: [
          { slot: "a", classes: "size-[20px] me-auto" },
          { slot: "b", classes: "size-[20px]" },
          { slot: "c", classes: "size-[20px]" },
        ],
      })
    );
    expect(variant?.root.children.map((child) => child.key)).toEqual(["a", "b", "c"]);
    expect(notesOf(coverage, "me-auto").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
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

// Oracle: CSS Box Alignment 3 §5.1.3. A flex row with no `justify-content` packs its layers at its
// start, `normal` acting as `stretch` and so as `flex-start`, so a 16px layer in a row that fills a 200px column sits at
// x 0 with 184px after it, as Data table filter's Trigger starts its bar. Figma's CENTER would put it
// at x 92.
describe("a filling row of fixed layers with no justify-content", () => {
  it("packs its layers at its start", async () => {
    const { variant } = await buildChip(
      "flex flex-col w-[200px]",
      [{ slot: "row", classes: "flex", children: [{ slot: "chip-dot", classes: "size-[16px] shrink-0" }] }],
      { parts: [part({ key: "row", slot: "row", parts: [part()] })] }
    );
    const row = frameOf(variant?.root);
    expect([row?.sizing.horizontal, row?.primaryAlign]).toEqual([FILL, "MIN"]);
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
      FONT_SANS
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

// Oracle: CSS Flexbox 1 §9.7 and §8.1, which Chromium showed on 2026-11-19 for a 120px Dropdown menu
// sub trigger. The row's text is an anonymous item that shrinks to the room the `shrink-0` caret and
// the gap leave, so a typed label of several words wraps between them there and the caret ends the
// row. Only a label that fills that room draws it in Figma, whose hugging text stays on one line, so
// a one-word sample a TEXT property sets fills as a multi-word one does, and the row packs at its start.
// The layer after the label must keep the width it draws, since a Figma layer keeps its size.
// `fixed-icon.chromium.test.ts` measures the CSS facts by hand-derived widths: a 16px svg that can
// shrink narrows once the label wraps, a `flex-shrink` of 0 or a `min-width` of its width keeps it,
// a basis wins over its width, a minimum raises it, a maximum lowers it, a grow widens it, and a 24px
// `border-box` frame with 16px padding on each side is 32px wide. `flex` spells its factors and basis
// as CSS Flexbox 1 §7.1 says: `flex-initial` compiles to `0 auto`, `0 1 auto`, and `0 16px` is
// `0 1 16px`. Where the layer keeps its width, the declarations that hold it are literal, and a limit
// that leaves the width where it is takes no such row. Elsewhere the label's sizing stays unmapped,
// under the row's `display`.
describe("a two-layer row's one-word text before an ml-auto icon", () => {
  const LABEL = {
    key: "label",
    name: "label",
    characters: "Share",
    textProperty: "Label",
    shownIn: () => true,
  };
  const ROW =
    "flex w-[120px] items-center gap-[8px] px-[8px] font-sans text-[14px] leading-[20px] text-[#000000]";

  /**
   * Build the sub trigger's row with a typed one-word label before an icon winning the given classes,
   * named as the given name says.
   */
  function buildSpaced(icon: string, name: string = ICON.name) {
    return buildCaptured(
      chip({ label: LABEL, iconsFor: () => [{ ...ICON, name, side: "end" }] }),
      rest({
        slot: "chip",
        classes: ROW,
        text: "Share",
        textIndex: 0,
        measured: { freeAlongMain: true },
        children: [{ tag: "svg", classes: `ml-auto size-[16px] ${icon}` }],
      }),
      FONT_SANS
    );
  }

  /** Build the row, winning the given classes too, with the label before a frame part of the given tag and classes. */
  function buildBesideFrame(frame: string, { tag = "div", row = "" }: { tag?: string; row?: string } = {}) {
    return buildCaptured(
      chip({ label: LABEL, parts: [{ ...part(), after: "label" }] }),
      rest({
        slot: "chip",
        classes: `justify-between ${ROW} ${row}`,
        text: "Share",
        textIndex: 0,
        measured: { freeAlongMain: true },
        children: [{ tag, slot: "chip-dot", classes: frame }],
      }),
      FONT_SANS
    );
  }

  type Coverage = Awaited<ReturnType<typeof buildSpaced>>["coverage"];

  /** The property and outcome of each row each of the given classes has. */
  function outcomes(coverage: Coverage, classes: string) {
    return classes
      .split(" ")
      .map(
        (className) =>
          [className, notesOf(coverage, className).map(([property, outcome]) => [property, outcome])] as const
      );
  }

  /** Each class and property the coverage notes as both unmapped and literal. */
  function doublyNoted(coverage: Coverage) {
    const noted = (outcome: string) =>
      new Set(
        coverage.filter((row) => row.outcome === outcome).map((row) => `${row.className} ${row.property}`)
      );
    const literal = noted("literal");
    return [...noted("unmapped")].filter((key) => literal.has(key));
  }

  /** Whether the label fills, the row's alignment, and the unmapped rows. */
  function drawn({ variant, coverage }: Awaited<ReturnType<typeof buildSpaced>>) {
    return {
      label: textOf(variant?.root)?.sizing.horizontal,
      unmapped: coverage
        .filter((row) => row.outcome === "unmapped")
        .map((row) => [row.className, row.property]),
    };
  }

  it.each([
    ["shrink-0", "that never shrinks", [["shrink-0", [["flex-shrink", "literal"]]]]],
    ["min-w-[16px]", "whose minimum width is its width", [["min-w-[16px]", [["min-width", "literal"]]]]],
    ["flex-none", "that neither grows nor shrinks", [["flex-none", [["flex", "literal"]]]]],
    ["flex-[0_0_auto]", "whose flex spells out none", [["flex-[0_0_auto]", [["flex", "literal"]]]]],
    [
      "flex-[0_0_16px]",
      "whose flex sets its width as its basis",
      [["flex-[0_0_16px]", [["flex", "literal"]]]],
    ],
    [
      "flex-initial min-w-[16px]",
      "whose flex of 0 auto shrinks no further than its minimum",
      [
        ["flex-initial", [["flex", "literal"]]],
        ["min-w-[16px]", [["min-width", "literal"]]],
      ],
    ],
    [
      "flex-[0_16px] min-w-[16px]",
      "whose two-value flex sets its width as its basis above its minimum",
      [
        ["flex-[0_16px]", [["flex", "literal"]]],
        ["min-w-[16px]", [["min-width", "literal"]]],
      ],
    ],
  ])(
    "fills the room an icon %s leaves, %s, so a longer typed label wraps there",
    async (icon, _case, rows) => {
      const { variant, coverage } = await buildSpaced(icon);
      expect([textOf(variant?.root)?.sizing.horizontal, variant?.root.primaryAlign]).toEqual([FILL, "MIN"]);
      expect(outcomes(coverage, icon)).toEqual(rows);
      expect(doublyNoted(coverage)).toEqual([]);
    }
  );

  it("notes no row for a maximum above the icon's width, which leaves the width where it is", async () => {
    const { variant, coverage } = await buildSpaced("shrink-0 max-w-[100px]");
    expect(textOf(variant?.root)?.sizing.horizontal).toEqual(FILL);
    expect(
      notesOf(coverage, "max-w-[100px]").map(([property, outcome]) => [property, outcome])
    ).not.toContainEqual(["max-width", "literal"]);
  });

  it.each([
    ["", "can shrink"],
    ["shrink-0 basis-[8px]", "starts from an 8px basis"],
    ["min-w-[16px] basis-[32px]", "starts from a 32px basis"],
    ["shrink-0 max-w-[8px]", "stops at an 8px maximum"],
    ["min-w-[24px]", "takes its 24px minimum, where the icon draws its 16px width"],
    ["grow shrink-0", "grows into the room a short label leaves"],
    // `calc(1)` is a number, so the icon grows, and Chromium draws it 58.6px wide beside `Share`.
    ["min-w-[16px] flex-[calc(1)_0]", "grows by a factor of calc(1)"],
    // `calc(16)` is no length, so `flex` is invalid at computed-value time and falls back to `0 1 auto`.
    // Chromium narrows the icon to 4.9px beside a label that wraps.
    ["flex-[0_0_var(--basis)] [--basis:calc(16)]", "starts from a basis of calc(16)"],
    // A border of style `none` is 0px wide (CSS Backgrounds 3 §4.3), so the 8px basis holds, and
    // Chromium draws the icon 8px wide.
    [
      "min-w-0 box-border border-[8px] border-none flex-[0_0_8px]",
      "starts from an 8px basis inside a border of style none",
    ],
  ])("leaves the label's sizing unmapped beside an icon %s that %s", async (icon) => {
    const built = await buildSpaced(icon);
    const { label, unmapped } = drawn(built);
    expect(label).toEqual(HUG);
    expect(unmapped).toContainEqual(["flex", "display"]);
    const rows = outcomes(built.coverage, icon).flatMap(([, each]) => each);
    expect(rows.map(([, outcome]) => outcome)).not.toContain("literal");
  });

  // The minimum sets the frame's own fixed width and holds the room the label fills beside it, so
  // the one declaration notes both, in either order.
  it("fills beside a frame whose 24px minimum folds into its fixed width", async () => {
    const { variant, coverage } = await buildBesideFrame("flex size-[16px] min-w-[24px]");
    expect([textOf(variant?.root)?.sizing.horizontal, variant?.root.primaryAlign]).toEqual([FILL, "MIN"]);
    const frame = variant?.root.children.find((layer) => layer.kind === "frame");
    expect(frame?.kind === "frame" ? frame.sizing.horizontal : undefined).toEqual(fixed(literal(24)));
    // One row notes the frame's own width, and one the room the label fills beside it, in either order.
    const rows = coverage
      .filter((row) => row.className === "min-w-[24px]")
      .map(({ property, outcome, detail }) => ({
        property,
        outcome,
        frame: detail.includes("fixed width"),
        beside: detail.includes("label"),
      }))
      .toSorted((a, b) => Number(a.frame) - Number(b.frame));
    expect(rows).toEqual([
      { property: "min-width", outcome: "literal", frame: false, beside: true },
      { property: "min-width", outcome: "literal", frame: true, beside: false },
    ]);
  });

  // Chromium clamps a 32px basis to the 16px maximum, and the 16px minimum changes nothing. So the
  // maximum holds the icon at its width and the minimum does not.
  it("credits a maximum equal to the minimum that holds the icon's width, and not the minimum", async () => {
    const { variant, coverage } = await buildSpaced("flex-[0_0_32px] min-w-[16px] max-w-[16px]");
    expect(textOf(variant?.root)?.sizing.horizontal).toEqual(FILL);
    expect(outcomes(coverage, "max-w-[16px]")).toEqual([["max-w-[16px]", [["max-width", "literal"]]]]);
    expect(notesOf(coverage, "min-w-[16px]").map(([, outcome]) => outcome)).not.toContain("literal");
    expect(doublyNoted(coverage)).toEqual([]);
  });

  it("reads an icon named as the label as the layer after it, which can shrink", async () => {
    const built = await buildSpaced("", LABEL.name);
    expect(drawn(built)).toEqual({ label: HUG, unmapped: [["flex", "display"]] });
  });

  // Each frame's CSS width can differ from the width it draws, or the build reads none for it, so a
  // typed label of several words that wraps in CSS beside it has no Figma sizing that draws the same.
  // Chromium draws a `box-sizing: initial` frame 20px wide around its 16px width and 4px of padding
  // and an `<input>` 153px wide. A 4px margin takes 4px of the label's room, an `auto` end margin
  // sets the frame right after a short label (CSS Flexbox 1 §8.1), and a wrapping row sets the
  // layer on a second line under a long label (§9.3). A frame's `flex` of `0 1 auto` stays unmapped
  // where the row reads its growth, so the room beside it is not one the build maps either.
  it.each([
    ["flex h-[16px] px-[8px]", "sets no width and can shrink", {}],
    ["flex size-[16px] shrink-0", "sits in a row that wraps", { row: "flex-wrap" }],
    ["flex size-[16px] shrink-0 mr-[4px]", "takes a 4px margin", {}],
    ["flex flex-[0_0_auto] h-[16px] px-[8px] -mr-[4px]", "takes a -4px margin", {}],
    ["block flex-[0_0_auto]", "is an input with no width", { tag: "input" }],
    ["flex size-[16px] px-[2px] flex-[0_0_auto] [box-sizing:initial]", "sizes its content box", {}],
    ["flex flex-[0_0_auto] h-[16px] px-[8px] mr-auto", "sets an auto end margin", {}],
    ["flex size-[16px] flex-[0_1_auto] min-w-[16px]", "sets a flex its row leaves unmapped", {}],
  ])("leaves the label's sizing unmapped beside a frame %s that %s", async (frame, _case, options) => {
    const { label, unmapped } = drawn(await buildBesideFrame(frame, options));
    expect(label).toEqual(HUG);
    expect(unmapped).toContainEqual(["flex", "display"]);
  });

  // A `border-box` frame is never narrower than its padding: 16px on each side makes a 24px frame 32px wide.
  it.each([
    ["box-border flex size-[24px] flex-none", { label: FILL, unmapped: [] }],
    ["box-border flex size-[24px] flex-none px-[16px]", { label: HUG, unmapped: [["flex", "display"]] }],
  ])("sizes the label beside a frame %s", async (frame, expected) => {
    expect(drawn(await buildBesideFrame(frame))).toEqual(expected);
  });

  // A widthless frame that neither grows nor shrinks hugs its text, whichever way its flex says so.
  it.each([
    [
      "flex-none",
      [
        ["flex", "dropped"],
        ["flex", "literal"],
      ],
    ],
    [
      "flex-[0_0_auto]",
      [
        ["flex", "dropped"],
        ["flex", "literal"],
      ],
    ],
    [
      "flex-none shrink-0",
      [
        ["flex", "dropped"],
        ["flex", "literal"],
        ["flex-shrink", "literal"],
      ],
    ],
  ])("fills beside a frame that hugs its text under %s", async (flex, rows) => {
    const built = await buildBesideFrame(`flex whitespace-nowrap ${flex}`);
    expect(drawn(built)).toEqual({ label: FILL, unmapped: [] });
    expect(outcomes(built.coverage, flex).flatMap(([, each]) => each)).toEqual(rows);
  });

  it("reads the width the icon draws, not that of an absolute frame of the same name", async () => {
    const built = await buildCaptured(
      chip({
        label: LABEL,
        iconsFor: () => [{ ...ICON, name: "chip-dot", side: "end" }],
        parts: [{ ...part(), after: "label" }],
      }),
      rest({
        slot: "chip",
        classes: `relative ${ROW}`,
        text: "Share",
        textIndex: 0,
        measured: { freeAlongMain: true },
        children: [
          { tag: "svg", classes: "ml-auto size-[16px] min-w-[24px]" },
          { tag: "div", slot: "chip-dot", classes: "absolute top-[0px] left-[0px] size-[24px]" },
        ],
      }),
      FONT_SANS
    );
    expect(drawn(built)).toEqual({
      label: HUG,
      unmapped: [
        ["flex", "display"],
        ["min-w-[24px]", "min-width"],
      ],
    });
  });
});

// Oracle: CSS Flexbox 1 §8.1, §9.4 step 11 and §9.6 step 13, and the capture's `freeAlongMain` fact.
// Auto margins on all four sides of a column's one item take the free space down the column and the
// room across it, so the item sits in the middle at its fit-content width, and no stretch widens it.
// Chromium sets List detail's 352px pane's `m-auto p-6` text, `Select a customer.`, 40px wide, in the
// middle of the pane's 351px content box, which its 1px `border-s` leaves. A longer text wraps at that
// width less the 48px padding: 303px. So the column centres on both axes, the item hugs, and its text
// wraps at 303. Where the item overflows the column, the margins take nothing and the item sits at
// the start, so without the capture's measurement of the room in every mode they stay unmapped. The
// same holds across: Chromium sets a 400px item in the 352px column at x=0, not centred, so an item
// that sets its width or minimum width, holds a layer, or keeps its text on one line leaves them
// unmapped too.
describe("auto margins on all four sides of a column's one layer", () => {
  /** Build a fixed column around one text part, both winning the given classes. */
  function buildCentred(column: string, item: string, measured: MeasuredFacts) {
    return buildCaptured(
      chip({
        parts: [
          part({
            key: "empty",
            slot: "chip-empty",
            label: {
              key: "text",
              name: "text",
              characters: "Select a customer.",
              textProperty: "Empty",
              shownIn: () => true,
            },
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: column,
        measured,
        children: [
          {
            slot: "chip-empty",
            classes: `${item} font-sans text-[14px] leading-[20px] text-[#000000]`,
            text: "Select a customer.",
          },
        ],
      }),
      FONT_SANS
    );
  }

  const COLUMN = "flex flex-col w-[352px] h-[320px] border-s-[1px] border-[#000000]";
  const ROOM: MeasuredFacts = { freeAlongMain: true };

  it("centres the layer on both axes at its own width, wrapping its text at the column's content width", async () => {
    const { variant, coverage } = await buildCentred(COLUMN, "m-auto p-[24px]", ROOM);
    const item = frameOf(variant?.root);
    expect([variant?.root.primaryAlign, variant?.root.counterAlign]).toEqual(["CENTER", "CENTER"]);
    expect(item?.sizing).toEqual({ horizontal: { kind: "hug" }, vertical: { kind: "hug" } });
    expect(textOf(item)?.maxWidth).toEqual(literal(303));
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("takes a physical left border off the cap as it takes the logical one", async () => {
    const { variant } = await buildCentred(
      "flex flex-col w-[352px] h-[320px] border-l-[1px] border-[#000000]",
      "m-auto p-[24px]",
      ROOM
    );
    expect(textOf(frameOf(variant?.root))?.maxWidth).toEqual(literal(303));
  });

  // A logical inline border beside a physical side, whose order in the cascade decides which wins, or
  // in a vertical writing mode, where it sits above and below (CSS Logical Properties 1 §4.1), leaves
  // the column's content width unread, so the wrapping text's cap stops the build.
  it.each([
    [
      "beside a physical right border",
      "flex flex-col w-[352px] h-[320px] border-s-[1px] border-r-[2px] border-[#000000]",
    ],
    [
      "in a vertical writing mode",
      "flex flex-col w-[352px] h-[320px] border-s-[1px] border-[#000000] [writing-mode:vertical-rl]",
    ],
  ])("leaves the content width unread for a logical border %s", async (_, column) => {
    await expect(buildCentred(column, "m-auto p-[24px]", ROOM)).rejects.toThrow(
      "cannot read in pixels the room the label has under it"
    );
  });

  it.each([
    ["without the measurement of the room", COLUMN, "m-auto p-[24px]", {}],
    ["on a column that sets justify-content", `${COLUMN} justify-start`, "m-auto p-[24px]", ROOM],
    ["on a column that sets align-items", `${COLUMN} items-start`, "m-auto p-[24px]", ROOM],
    ["with auto margins across only", COLUMN, "mx-auto p-[24px]", ROOM],
    ["on a layer that sets its width", COLUMN, "m-auto w-[400px]", ROOM],
    ["on a layer that sets a minimum width", COLUMN, "m-auto p-[24px] min-w-[400px]", ROOM],
    ["on a text that does not wrap", COLUMN, "m-auto p-[24px] whitespace-nowrap", ROOM],
  ])("leaves the margins unmapped %s", async (_, column, item, measured) => {
    const { coverage } = await buildCentred(column, item, measured);
    expect(
      coverage
        .filter((row) => row.property.startsWith("margin-") && row.value === "auto")
        .map((row) => row.outcome)
    ).toContain("unmapped");
  });

  it("leaves them unmapped on a layer that holds a layer of its own", async () => {
    const { coverage } = await buildCaptured(
      chip({ parts: [part({ key: "a", slot: "a", parts: [part({ key: "b", slot: "b" })] })] }),
      rest({
        slot: "chip",
        classes: COLUMN,
        measured: ROOM,
        children: [{ slot: "a", classes: "m-auto", children: [{ slot: "b", classes: "size-[400px]" }] }],
      })
    );
    expect(notesOf(coverage, "m-auto").map(([, outcome]) => outcome)).toEqual([
      "unmapped",
      "unmapped",
      "unmapped",
      "unmapped",
    ]);
  });

  it("leaves them unmapped beside a second layer", async () => {
    // The first layer is the centred case's own text layer, so only the second layer can refuse it.
    const { coverage } = await buildCaptured(
      chip({
        parts: [
          part({
            key: "empty",
            slot: "chip-empty",
            label: {
              key: "text",
              name: "text",
              characters: "Select a customer.",
              textProperty: "Empty",
              shownIn: () => true,
            },
          }),
          part({ key: "b", slot: "b" }),
        ],
      }),
      rest({
        slot: "chip",
        classes: COLUMN,
        measured: ROOM,
        children: [
          {
            slot: "chip-empty",
            classes: "m-auto font-sans text-[14px] leading-[20px] text-[#000000]",
            text: "Select a customer.",
          },
          { slot: "b", classes: "size-[8px]" },
        ],
      }),
      FONT_SANS
    );
    expect(notesOf(coverage, "m-auto").map(([, outcome]) => outcome)).toEqual([
      "unmapped",
      "unmapped",
      "unmapped",
      "unmapped",
    ]);
  });
});

// Oracle: CSS Box Alignment 3 §6.1 and CSS Flexbox 1 §9.4 steps 11 and 15. An item whose
// `align-self` is `auto` takes its row's `align-items`, whose `normal` stretches a flex item: on one
// line, an item of `auto` height with no auto margin down is as tall as the row's content box, as
// Chromium stretches List detail's list and pane down its 320px root. A row that hugs its height
// keeps its items' own heights, since the kit check refuses a layer that fills a hugging parent
// beside none that sets its height.
describe("a row's unset align-items", () => {
  const build = (row: string, item: string) =>
    buildChip(row, [{ slot: "chip-dot", classes: item }], { parts: [part()] });

  it("stretches an item of auto height down a row of a fixed height", async () => {
    const { variant, coverage } = await build("flex h-[80px]", "w-[16px]");
    expect(frameOf(variant?.root)?.sizing).toEqual({ horizontal: fixed(literal(16)), vertical: FILL });
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it.each([
    ["in a row that hugs its height", "flex", "w-[16px]", HUG],
    ["in a row that aligns its items", "flex h-[80px] items-start", "w-[16px]", HUG],
    ["in a row that wraps", "flex h-[80px] flex-wrap", "w-[16px]", HUG],
    ["that aligns itself", "flex h-[80px]", "w-[16px] self-start", HUG],
    ["that sets its height", "flex h-[80px]", "w-[16px] h-[10px]", fixed(literal(10))],
    ["with auto margins down", "flex h-[80px]", "w-[16px] my-auto", HUG],
  ])("keeps an item's own height %s", async (_, row, item, height) => {
    const { variant } = await build(row, item);
    expect(frameOf(variant?.root)?.sizing.vertical).toEqual(height);
  });
});

// Oracle: CSS Flexbox 1 §9.3 step 1 and §9.4, worked by hand, with the capture's `oneFlexLine`
// fact. A wrapping row whose items the capture measured on one line in every mode collects them
// into that one line. A wrapping row sizes the line to its items, here 20px, and `align-content:
// normal` stretches it to the row's definite 36px content height, the one line a row that does not
// wrap has, so a `self-stretch` item of auto height is 36px tall in both and the row draws as a
// Figma row that does not wrap. Without the fact the row may break a line, and with `align-content:
// center` the 20px line sits in the middle of the 36px row, where the stretched item would be 20px
// tall, so the wrap and the stretch stay unmapped. A row that hugs its height is as tall as its one
// line, which the rule does not read.
describe("a wrapping row the capture measured on one line", () => {
  const build = (row: string, measured: MeasuredFacts) =>
    buildCaptured(
      chip({ parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] }),
      rest({
        slot: "chip",
        classes: row,
        measured,
        children: [
          { slot: "a", classes: "w-[20px] self-stretch" },
          { slot: "b", classes: "size-[20px]" },
        ],
      })
    );

  it("drops the wrap and stretches an item down the row's height, as a row that does not wrap", async () => {
    const { variant, coverage } = await build("flex flex-wrap w-[200px] h-[36px]", { oneFlexLine: true });
    expect(
      variant?.root.children.map((child) => [
        child.key,
        child.kind === "frame" ? child.sizing.vertical : child.kind,
      ])
    ).toEqual([
      ["a", FILL],
      ["b", fixed(literal(20))],
    ]);
    expect(notesOf(coverage, "flex-wrap").map(([, outcome]) => outcome)).toEqual(["dropped"]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it.each([
    ["without the measurement", "flex flex-wrap w-[200px] h-[36px]", {}],
    ["that centres its lines", "flex flex-wrap content-center w-[200px] h-[36px]", { oneFlexLine: true }],
    ["that hugs its height", "flex flex-wrap w-[200px]", { oneFlexLine: true }],
  ] as const)("leaves the wrap and the stretch unmapped in a row %s", async (_case, row, measured) => {
    const { coverage } = await build(row, measured);
    expect(coverage.filter((note) => note.outcome === "unmapped").map(({ property }) => property)).toEqual(
      expect.arrayContaining(["flex-wrap", "align-self"])
    );
  });
});
