/**
 * A percentage height inside a parent whose height hugs, as the Navigation menu popup's viewport and
 * content are `100%` tall in a popup that hugs, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`.
 *
 * Oracle: CSS 2.1 §10.5. A percentage height whose containing block's height depends on its content
 * computes to `auto`, so the box is as tall as what it holds. A percentage width of a shrink-to-fit
 * width is cyclic instead (CSS Sizing 3 §5.2.1), which today's reading leaves unread.
 */
import { describe, expect, it } from "vitest";

import { HUG } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf } from "../../test/fixture-sets";
import type { CoverageRow } from "./coverage";

/** The outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

const AUTO_HEIGHT =
  "the parent's height depends on its content, so a percentage height computes to auto, which hugs (CSS 2.1 §10.5)";

/** A 12px block inside the part, so the part has content to be as tall as. */
const CONTENT = { ...dot("block h-[12px]"), key: "content", slot: "chip-content" };

describe("a percentage height in a parent that hugs its height", () => {
  it.each([
    ["a block box", "block w-[100px]"],
    ["a flex column", "flex flex-col w-[100px]"],
  ])("hugs inside %s", async (_parent, classes) => {
    for (const height of ["h-full", "h-1/2"]) {
      const { variant, coverage } = await buildFixture(
        chip(classes, { parts: [{ ...dot(`block ${height}`), parts: [CONTENT] }] })
      );
      expect(frameOf(variant?.root)?.sizing.vertical).toEqual(HUG);
      expect(notesOf(coverage, height)).toEqual([["height", "literal", AUTO_HEIGHT]]);
    }
  });

  it("hugs beside a sibling in a column, which shares no height the column does not have", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[100px]", {
        parts: [
          { ...dot("block h-full"), parts: [CONTENT] },
          { ...dot("block h-[8px]"), key: "other", slot: "chip-other" },
        ],
      })
    );
    expect(frameOf(variant?.root)?.sizing.vertical).toEqual(HUG);
    expect(notesOf(coverage, "h-full")).toEqual([["height", "literal", AUTO_HEIGHT]]);
  });

  // Negative controls: across, a percentage of a hugging width stays unread; in a row that hugs its
  // height, the row stretches its items, which the rule does not decide.
  it.each([
    ["a width in a column that hugs its width", "flex flex-col", "block w-full h-[8px]", "w-full"],
    ["a height in a row that hugs its height", "flex w-[100px]", "block h-full w-[8px]", "h-full"],
  ])("leaves %s unmapped", async (_case, parent, part, className) => {
    const { coverage } = await buildFixture(chip(parent, { parts: [{ ...dot(part), parts: [CONTENT] }] }));
    expect(notesOf(coverage, className).map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});
