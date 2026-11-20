/**
 * How the build sizes and spaces a box from its flex and limit declarations: `flex: none`, logical padding, percentage limits, auto margins between two layers and a row's stretch. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
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
describe("a two-layer row's one-word text before an ml-auto icon", () => {
  it("fills the room the icon leaves, so a longer typed label wraps there", async () => {
    const { variant } = await buildCaptured(
      chip({
        label: {
          key: "label",
          name: "label",
          characters: "Share",
          textProperty: "Label",
          shownIn: () => true,
        },
        iconsFor: () => [{ ...ICON, side: "end" }],
      }),
      rest({
        slot: "chip",
        classes:
          "flex w-[120px] items-center gap-[8px] px-[8px] font-sans text-[14px] leading-[20px] text-[#000000]",
        text: "Share",
        textIndex: 0,
        measured: { freeAlongMain: true },
        children: [{ tag: "svg", classes: "ml-auto size-[16px] shrink-0" }],
      }),
      FONT_SANS
    );
    expect([textOf(variant?.root)?.sizing.horizontal, variant?.root.primaryAlign]).toEqual([FILL, "MIN"]);
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
