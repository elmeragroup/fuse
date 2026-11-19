/**
 * How the build lays out a CSS grid of two columns. The unit under test is `buildComponentSet` on
 * hand-built captures of one-cell `chip` sets (`test/capture-fixtures.ts`). Oracles: CSS Grid 1,
 * under which items with no placement of their own fill the explicit columns row by row in source
 * order (§8.5), and `grid-template-columns: auto minmax(0, 1fr)` gives the first column its content
 * and the second the room left (§7.2, §11.8), which Figma's grid draws as a HUG and a FLEX track (the
 * typings' `GridTrackSize`) only where the capture's `gridHugs` and `gridHolds` facts measured the
 * columns drawing alike in every mode; CSS Box Alignment 3 §6.1, under which the unset alignment
 * stretches an item across its cell on an axis where its length is `auto` and leaves one of its own
 * length at the start; probe PG2 (2026-11-18), under which a Figma HUG track is as long as its layers
 * that do not fill it, so a filling item takes the length the track's widest or tallest item, which
 * the capture measured (`gridWidest`, `gridTallest`), sets at its own length; the typings, under which a FLEX track is invalid on an axis the grid hugs, and
 * the capture's `gridItems` and `gridItem` facts, which number the items its facts name, so the facts
 * read only where the parts are those items in order; Figma places a grid's layers by their layer order, which a positioned item's paint order changes;
 * CSS Flexbox 1 §5.2, under which `flex-wrap` applies to flex containers alone, so a grid's sets
 * nothing; CSS Grid 1 §12.7.1, under which flexible tracks whose shares sum below 1 take only that
 * fraction of the free space, so two `0.25fr` columns of a 200px grid take 50px each where a FLEX
 * track shares the whole width, and a `0fr` track takes none; and the coverage contract, under which a grid the build does not draw keeps its `display`
 * unmapped.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  chip,
  FILL,
  fixedSize,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { LabelManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

const SLOTS = ["a", "b", "c", "d"] as const;

/**
 * Items in two rows: `a` only 20px tall, `b` only 20px wide, and `c` and `d` 20px squares, unless a
 * case gives the first item other classes.
 */
const ITEMS = { a: "h-[20px]", b: "w-[20px]", c: "size-[20px]", d: "size-[20px]" } as const;

/**
 * A grid of the four items in two columns, with the given classes, facts and first item's classes.
 * The capture numbers the items `0` to `3` in source order, as its page function does, unless a case
 * gives other places.
 */
function buildGrid(
  classes: string,
  measured: MeasuredFacts,
  first: string = ITEMS.a,
  places: readonly number[] = [0, 1, 2, 3]
) {
  const items: readonly FixtureElement[] = SLOTS.map((slot, index) => ({
    slot,
    classes: slot === "a" ? first : ITEMS[slot],
    measured: { gridItem: places[index] ?? -1 },
  }));
  return buildCaptured(
    chip({ parts: SLOTS.map((slot) => part({ key: slot, slot })) }),
    rest({ slot: "chip", classes, measured, children: items })
  );
}

const TWO_COLUMNS = "grid grid-cols-[auto_minmax(0,1fr)] gap-x-[10px] gap-y-[4px] w-[200px]";
/**
 * The facts a capture of the grid records: the `auto` column hugs and every column holds its items;
 * `c`, the 20px square, is the widest item of the first column, where `a` has no width of its own;
 * and `a` and `c` are the tallest items of their rows, `a` beside `b`, which has no height of its own.
 */
const MEASURED: MeasuredFacts = {
  gridHugs: [0],
  gridHolds: [0, 1],
  gridWidest: [2, 1],
  gridTallest: [0, 2],
  gridItems: 4,
};

describe("a grid of two columns", () => {
  it("draws a Figma grid of a HUG and a FLEX column, its items row by row", async () => {
    const { variant, coverage } = await buildGrid(TWO_COLUMNS, MEASURED);
    const root = variant?.root;
    expect([root?.direction, root?.grid]).toEqual([
      "GRID",
      {
        columns: [{ kind: "hug" }, { kind: "flex", share: 1 }],
        rows: [{ kind: "hug" }, { kind: "hug" }],
        columnGap: literal(10),
        rowGap: literal(4),
        cells: [
          { key: "a", row: 0, column: 0 },
          { key: "b", row: 0, column: 1 },
          { key: "c", row: 1, column: 0 },
          { key: "d", row: 1, column: 1 },
        ],
      },
    ]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("fills each item's cell on an axis where its length is auto, and keeps its own length elsewhere", async () => {
    const { variant } = await buildGrid(TWO_COLUMNS, MEASURED);
    expect(variant?.root.children.map((child) => (child.kind === "icon" ? undefined : child.sizing))).toEqual(
      [
        { horizontal: FILL, vertical: { kind: "fixed", length: literal(20) } },
        { horizontal: { kind: "fixed", length: literal(20) }, vertical: FILL },
        fixedSize(literal(20), literal(20)),
        fixedSize(literal(20), literal(20)),
      ]
    );
  });

  it("sits an item of no height of its own at its cell's start where it aligns itself there", async () => {
    // `b` has no height of its own, which the grid's stretch would fill, until `self-start` sets it at
    // the start at its own height (CSS Box Alignment 3 §6.1).
    const items = { ...ITEMS, b: "w-[20px] self-start" };
    const { variant, coverage } = await buildCaptured(
      chip({ parts: SLOTS.map((slot) => part({ key: slot, slot })) }),
      rest({
        slot: "chip",
        classes: TWO_COLUMNS,
        measured: MEASURED,
        children: SLOTS.map((slot, index) => ({ slot, classes: items[slot], measured: { gridItem: index } })),
      })
    );
    const [, second] = variant?.root.children ?? [];
    expect([
      second?.kind === "icon" ? undefined : second?.sizing.vertical,
      notesOf(coverage, "self-start").map(([property, outcome]) => [property, outcome]),
    ]).toEqual([{ kind: "hug" }, [["align-self", "literal"]]]);
  });

  it("drops the flex-wrap it sets nothing on", async () => {
    const { coverage } = await buildGrid(`${TWO_COLUMNS} flex-wrap`, MEASURED);
    expect(notesOf(coverage, "flex-wrap")).toEqual([
      ["flex-wrap", "dropped", "flex-wrap applies only to flex containers, and the box is a grid"],
    ]);
  });

  it("draws a filling item at its own width where it is its HUG column's widest", async () => {
    const { variant } = await buildGrid(TWO_COLUMNS, { ...MEASURED, gridWidest: [0, 1] });
    const [first] = variant?.root.children ?? [];
    expect(first?.kind === "icon" ? undefined : first?.sizing).toEqual({
      horizontal: { kind: "hug" },
      vertical: { kind: "fixed", length: literal(20) },
    });
  });

  const { gridWidest: _widest, ...noWidest } = MEASURED;
  const { gridTallest: _tallest, ...noTallest } = MEASURED;
  it.each([
    ["no column's widest item", noWidest],
    ["no row's tallest item", noTallest],
  ])(
    "stays unmapped where a filling item sits in a HUG track and the capture measured %s",
    async (_case, measured) => {
      const { variant } = await buildGrid(TWO_COLUMNS, measured);
      expect(variant?.root.direction).not.toBe("GRID");
    }
  );

  it.each([
    ["minmax(0,1fr)", [], "GRID"],
    ["1fr", [0, 1], "GRID"],
    ["1fr", [0], "HORIZONTAL"],
  ])(
    "maps a %s column measured holding columns %o to a FLEX track only where its floor binds nowhere",
    async (fraction, holds, direction) => {
      const { variant } = await buildGrid(
        `grid grid-cols-[auto_${fraction}] gap-x-[10px] gap-y-[4px] w-[200px]`,
        { ...MEASURED, gridHolds: holds }
      );
      expect(variant?.root.direction).toBe(direction);
    }
  );

  it.each([
    ["lays out an item no part draws", { ...MEASURED, gridItems: 5 }, [0, 1, 2, 3]],
    ["numbers the parts in another order", MEASURED, [1, 0, 2, 3]],
  ])("stays unmapped where the capture %s", async (_case, measured, places) => {
    const { variant } = await buildGrid(TWO_COLUMNS, measured, ITEMS.a, places);
    expect(variant?.root.direction).not.toBe("GRID");
  });

  it("stays unmapped where the capture did not measure the first column hugging its items", async () => {
    const { gridHugs: _hugs, ...noHugs } = MEASURED;
    const { variant, coverage } = await buildGrid(TWO_COLUMNS, noHugs);
    expect(variant?.root.direction).not.toBe("GRID");
    expect(coverage.filter((row) => row.outcome === "unmapped").map((row) => row.property)).toContain(
      "grid-template-columns"
    );
  });

  it.each([
    ["hugs its width beside a FLEX column", "grid grid-cols-[auto_minmax(0,1fr)] gap-x-[10px]", ITEMS.a],
    [
      "hugs its width from a minimum beside a FLEX column",
      "grid grid-cols-[auto_minmax(0,1fr)] gap-x-[10px] min-w-[100px]",
      ITEMS.a,
    ],
    ["holds an item that spans two columns", TWO_COLUMNS, "h-[20px] col-span-2"],
    ["holds a positioned item", TWO_COLUMNS, "h-[20px] relative"],
    // CSS stretches the `auto` rows to the minimum, two 50px rows, where Figma's HUG rows hug.
    ["sets a minimum height its rows would stretch to", `${TWO_COLUMNS} min-h-[100px]`, ITEMS.a],
  ])("stays unmapped where the grid %s", async (_case, classes, first) => {
    const { variant } = await buildGrid(classes, MEASURED, first);
    expect(variant?.root.direction).not.toBe("GRID");
  });
});

describe("a grid whose flexible columns share out less than its free space", () => {
  it.each([
    ["two 0.25fr columns", "minmax(0,0.25fr)_minmax(0,0.25fr)"],
    ["a 0fr column beside a 1fr column", "minmax(0,0fr)_minmax(0,1fr)"],
  ])("stays unmapped, naming why, where it holds %s", async (_case, columns) => {
    const { variant, coverage } = await buildGrid(
      `grid grid-cols-[${columns}] gap-x-[10px] gap-y-[4px] w-[200px]`,
      MEASURED
    );
    expect([
      variant?.root.direction,
      coverage.find((row) => row.property === "grid-template-columns")?.detail,
    ]).toEqual(["HORIZONTAL", expect.stringContaining("§12.7.1")]);
  });
});

describe("a grid whose items hold text a TEXT property sets", () => {
  /**
   * The grid of four items, one of them, `labelled`, holding the text `x`, set by a TEXT property
   * where `editable`, its classes given, the others 20px squares.
   */
  function buildLabelled(
    labelled: (typeof SLOTS)[number],
    classes: string,
    editable: boolean,
    grid: string = TWO_COLUMNS
  ) {
    const label: LabelManifest = {
      key: "text",
      name: "text",
      characters: "x",
      textProperty: editable ? "Title" : undefined,
      shownIn: () => true,
    };
    return buildCaptured(
      chip({
        parts: SLOTS.map((slot) =>
          part(slot === labelled ? { key: slot, slot, label } : { key: slot, slot })
        ),
      }),
      rest({
        slot: "chip",
        classes: `${grid} font-sans text-[14px] leading-[20px] text-[#000000]`,
        measured: MEASURED,
        children: SLOTS.map((slot, index): FixtureElement => {
          const element = { slot, classes: "size-[20px]", measured: { gridItem: index } };
          return slot === labelled ? { ...element, classes, text: "x" } : element;
        }),
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
  }

  // `b` fills its row's height, which `a` sets at 20px: a longer text in `b` would set the row in CSS,
  // where Figma's HUG row follows `a` alone (PG2).
  it.each([
    [false, "GRID"],
    [true, "HORIZONTAL"],
  ])(
    "draws a filling item's HUG row from a measured setter only where no item holds editable text: %s",
    async (editable, direction) => {
      const { variant } = await buildLabelled("b", "w-[20px]", editable);
      expect(variant?.root.direction).toBe(direction);
    }
  );

  // `a` sets the `auto` column at its text's width, which a longer realistic label widens in CSS and
  // in Figma's HUG track alike, since `a` does not fill it; a label long enough to meet the other
  // column is a known limit.
  it.each([false, true])(
    "draws an `auto` column whose item sets it at its own width as a HUG track, its text editable: %s",
    async (editable) => {
      const { variant } = await buildLabelled("a", "h-[20px] justify-self-start", editable);
      expect(variant?.root.direction).toBe("GRID");
    }
  );

  // A `1fr` column's floor is its items' longest word, which a realistic label keeps below the
  // measured share; one word wider than the column is a known limit (PG12).
  it.each([false, true])(
    "draws a `1fr` column the capture measured holding its items as a FLEX track, its text editable: %s",
    async (editable) => {
      const grid = "grid grid-cols-[auto_1fr] gap-x-[10px] gap-y-[4px] w-[200px]";
      const { variant } = await buildLabelled("b", "w-[20px] self-start", editable, grid);
      expect(variant?.root.direction).toBe("GRID");
    }
  );
});
