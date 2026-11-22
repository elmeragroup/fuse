/**
 * How the build lays out a table: the table and its row groups as columns of rows, each row as a
 * row of cells, each cell around what it holds. The unit under test is `buildSetsInOrder` on
 * hand-built captures of one-cell `chip` sets (`test/capture-fixtures.ts`). Oracle: CSS 2.1 §17.5,
 * where a column is as wide as its widest cell and a row as tall as its tallest, so a cell keeps the
 * size of what it holds only where nothing in its column or row is larger, which the capture's
 * `tableTiles` fact measures in every mode; and the coverage contract, under which a table box the
 * capture did not measure keeps its `display` unmapped.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  chip,
  fixedSize,
  frameOf,
  HUG,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";

/** A cell holding one 36px square, measured or not. */
function cell(slot: string, measured: MeasuredFacts): FixtureElement {
  return {
    slot,
    classes: "table-cell p-0 align-middle",
    measured,
    children: [{ slot: `${slot}-day`, classes: "flex size-[36px]" }],
  };
}

/**
 * Build a table of one row of two cells, every table box carrying the given facts, and the row the
 * given classes and facts of its own.
 */
function buildTable(
  measured: MeasuredFacts,
  row: { classes: string; measured: MeasuredFacts } = {
    classes: "table-row",
    measured,
  }
) {
  const day = (slot: string) =>
    part({ key: slot, slot, parts: [part({ key: `${slot}-day`, slot: `${slot}-day` })] });
  return buildCaptured(
    chip({ parts: [part({ key: "row", slot: "row", parts: [day("a"), day("b")] })] }),
    rest({
      slot: "chip",
      classes: "table border-collapse",
      measured,
      children: [{ slot: "row", ...row, children: [cell("a", measured), cell("b", measured)] }],
    })
  );
}

describe("a table the capture measured tiling its parts", () => {
  it("draws the table as a column, its row as a row and each cell around its day", async () => {
    const { variant, coverage } = await buildTable({ tableTiles: true });
    const row = frameOf(variant?.root);
    const first = frameOf(row);
    expect([variant?.root.direction, row?.direction]).toEqual(["VERTICAL", "HORIZONTAL"]);
    expect([variant?.root.sizing, row?.sizing]).toEqual([
      { horizontal: HUG, vertical: HUG },
      { horizontal: HUG, vertical: HUG },
    ]);
    expect(frameOf(first)?.sizing).toEqual(fixedSize(literal(36), literal(36)));
    expect(first?.counterAlign).toBe("CENTER");
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
    expect(notesOf(coverage, "border-collapse").map(([property, outcome]) => [property, outcome])).toEqual([
      ["border-collapse", "dropped"],
    ]);
  });

  /**
   * Oracle: CSS 2.1 §17.6.2, under which a collapsed table sets a row's border on the grid line
   * between rows, not inside the row, whatever sides it sets, so Chromium keeps a Table row 32px tall
   * under its 1px rule, and a row of 36px cells under a 1px `border` 36px tall.
   */
  const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
  it.each([
    ["border-b", { sides: { top: 0, right: 0, bottom: 1, left: 0 }, inLayout: false }],
    ["border", { weight: { kind: "literal", value: 1 }, inLayout: false }],
  ])("draws a row's own collapsed `%s` out of its layout", async (border, expected) => {
    const { variant, coverage } = await buildTable(
      { tableTiles: true },
      { classes: `table-row ${border} border-black`, measured: { tableTiles: true, bordersCollapse: true } }
    );
    expect(frameOf(variant?.root)?.stroke).toEqual({ color: BLACK, ...expected });
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  /**
   * Oracle: CSS 2.1 §17.6.2.1 and §17.6.1. Without `bordersCollapse`, a box beside the row may win
   * the edge: Chromium paints a row's bottom edge in the blue of the next row's 3px `border-top`, and
   * paints none under its `1px hidden`. A separated table paints no row border at all. A row group's
   * border lies on lines its rows and cells share, and Chromium keeps a `tbody` with a 1px
   * `border-bottom` 36px tall around its 36px row, where a stroke in the layout drew 37px. So the
   * border draws no stroke and its declarations stay unmapped, while the box still tiles.
   */
  it.each(["table-row", "table-row-group"])(
    "leaves a `%s` border it does not own unmapped",
    async (display) => {
      const { variant, coverage } = await buildTable(
        { tableTiles: true },
        { classes: `${display} border-b border-black`, measured: { tableTiles: true } }
      );
      const row = frameOf(variant?.root);
      expect([row?.stroke, row?.direction]).toEqual([
        undefined,
        display === "table-row" ? "HORIZONTAL" : "VERTICAL",
      ]);
      expect(
        coverage
          .filter((row) => row.outcome === "unmapped")
          .map((row) => row.property)
          .toSorted()
      ).toEqual(["border-bottom-style", "border-bottom-width", "border-color"]);
    }
  );

  /**
   * Oracle: CSS Backgrounds 3 §4.3. A side whose style is `none` has a used width of 0, whatever
   * width it declares, so a row whose every side has that style draws no border for any box to
   * contest, as a framed Table header row's `border-none` leaves the `border-b` its header gives it.
   * Its border declarations then draw nothing, owned or not, and none of them stays unmapped.
   */
  it.each(["border-b border-none", "border-b [border-bottom-style:none]"])(
    "draws nothing and leaves nothing unmapped for a row's `%s` it does not own",
    async (border) => {
      const { variant, coverage } = await buildTable(
        { tableTiles: true },
        { classes: `table-row ${border} border-black`, measured: { tableTiles: true } }
      );
      expect(frameOf(variant?.root)?.stroke).toBeUndefined();
      expect(
        coverage.filter((row) => row.property.startsWith("border-") && row.outcome === "unmapped")
      ).toEqual([]);
    }
  );

  it("leaves each table box's display unmapped without the measurement", async () => {
    const { coverage } = await buildTable({});
    expect(
      coverage
        .filter((row) => row.property === "display" && row.outcome === "unmapped")
        .map((row) => row.value)
        .toSorted()
    ).toEqual(["table", "table-cell", "table-cell", "table-row"]);
  });
});
