/**
 * A translate every row of a column shares, as each Sidebar sub row's `-translate-x-px` moves it 1px
 * left over its sub menu's padding. Unit under test: `buildComponentSet`, through the `chip` fixture.
 * Oracle: CSS Transforms 1 §6, where a translate moves the painted box and leaves the layout alone, so
 * rows that all move `t` across paint where a column whose left padding is `t` larger and whose right
 * padding is `t` smaller lays them out, at their own widths. A box that paints nothing and pads nothing
 * across shows only what it holds, so a row's translate reaches the column through such a wrapper, as
 * through the sub row's `<li>`.
 */
import { describe, expect, it } from "vitest";

import { density, FILL, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { PartDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec } from "./kit-spec";

/** A row of the column, 10px tall, with its classes. */
const row = (key: string, classes: string): PartDefinition => ({
  ...dot(`flex h-[10px] ${classes}`),
  key,
  slot: `chip-${key}`,
});

/** A wrapper that paints and pads nothing, holding one row, as a sub row's `<li>` holds its link. */
const wrapper = (key: string, classes: string, inner: string): PartDefinition => ({
  ...dot(classes),
  key,
  slot: `chip-${key}`,
  parts: [row(`${key}-row`, inner)],
});

/** The column's left and right paddings. */
const across = (box: BoxSpec | undefined) => [box?.paddingLeft, box?.paddingRight];

/** The outcome and detail of each `translate` row. */
const translateRows = (coverage: readonly CoverageRow[]) =>
  coverage
    .filter((covered) => covered.property === "translate")
    .map((covered) => [covered.outcome, covered.detail]);

const VARIABLES = makeVariableIndex([
  {
    ref: { collection: "Fuse density", name: "row-px" },
    webSyntax: "var(--row-px)",
    minimum: 8,
    maximum: 12,
  },
]);

const SHARED =
  "the rows of its column all move 1px left, which the column's paddings draw, 1px less on the left and 1px more on the right";

describe("a translate every row of a column shares", () => {
  it("moves the column's content box, 9 and 11 from 10 and 10, and keeps the rows' widths", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[100px] px-[10px]", {
        parts: [row("first", "-translate-x-px"), row("second", "-translate-x-px")],
      })
    );
    expect(across(variant?.root)).toEqual([literal(9), literal(11)]);
    expect(variant?.root.children.map((child) => child.kind === "frame" && child.sizing.horizontal)).toEqual([
      FILL,
      FILL,
    ]);
    expect(translateRows(coverage)).toEqual([
      ["literal", SHARED],
      ["literal", SHARED],
    ]);
    expect(
      coverage
        .filter((covered) => covered.className === "px-[10px]")
        .map((covered) => [covered.property, covered.detail])
        .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : 1))
    ).toEqual([
      ["padding-left", "9px, this padding less the 1px its rows move left"],
      ["padding-right", "11px, this padding plus the 1px its rows move left"],
    ]);
  });

  it("reaches the column through wrappers that paint and pad nothing", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[100px] px-[10px]", {
        parts: [wrapper("first", "block", "-translate-x-px"), wrapper("second", "block", "-translate-x-px")],
      })
    );
    expect(across(variant?.root)).toEqual([literal(9), literal(11)]);
    expect(translateRows(coverage)).toEqual([
      ["literal", SHARED],
      ["literal", SHARED],
    ]);
  });

  const TEN = literal(10);
  const ROW_PX = density("row-px");

  it.each([
    ["rows that move apart", ["-translate-x-px", "-translate-x-[2px]"], "px-[10px]", TEN],
    ["a translate on one row of two", ["-translate-x-px", ""], "px-[10px]", TEN],
    [
      "a translate down too",
      ["-translate-x-px -translate-y-px", "-translate-x-px -translate-y-px"],
      "px-[10px]",
      TEN,
    ],
    ["a bound padding", ["-translate-x-px", "-translate-x-px"], "px-(--row-px)", ROW_PX],
    ["a padding the fold takes below 0", ["translate-x-px", "translate-x-px"], "px-0", literal(0)],
  ])(
    "leaves the translate unmapped, and the paddings as the CSS sets them, with %s",
    async (_case, rows, padding, side) => {
      const { variant, coverage } = await buildFixture(
        chip(`flex flex-col w-[100px] ${padding}`, {
          parts: rows.map((classes, index) => row(`row-${String(index)}`, classes)),
        }),
        { variables: VARIABLES }
      );
      expect(translateRows(coverage).map(([outcome]) => outcome)).toContain("unmapped");
      expect(across(variant?.root)).toEqual([side, side]);
    }
  );

  it("leaves the translate unmapped through a wrapper that paints", async () => {
    const { coverage } = await buildFixture(
      chip("flex flex-col w-[100px] px-[10px]", {
        parts: [
          wrapper("first", "block bg-[#000000]", "-translate-x-px"),
          wrapper("second", "block bg-[#000000]", "-translate-x-px"),
        ],
      })
    );
    expect(translateRows(coverage).map(([outcome]) => outcome)).toEqual(["unmapped", "unmapped"]);
  });
});
