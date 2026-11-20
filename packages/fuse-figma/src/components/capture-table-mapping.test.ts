/**
 * How the build lays out a table: the table and its row groups as columns of rows, each row as a
 * row of cells, each cell around what it holds. The unit under test is `buildComponentSet` on
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

/** Build a table of one row of two cells, every table box carrying the given facts. */
function buildTable(measured: MeasuredFacts) {
  const day = (slot: string) =>
    part({ key: slot, slot, parts: [part({ key: `${slot}-day`, slot: `${slot}-day` })] });
  return buildCaptured(
    chip({ parts: [part({ key: "row", slot: "row", parts: [day("a"), day("b")] })] }),
    rest({
      slot: "chip",
      classes: "table border-collapse",
      measured,
      children: [
        { slot: "row", classes: "table-row", measured, children: [cell("a", measured), cell("b", measured)] },
      ],
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
