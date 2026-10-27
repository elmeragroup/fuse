/**
 * Build rules Radio group is the first set to need, against the `chip` and `dot` fixtures of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its oracle.
 */
import { describe, expect, it } from "vitest";

import { FILL, HUG } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { CoverageRow } from "./coverage";

/** The part, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.part, row.outcome, row.detail]);

/** A fixture part with its own key and slot. */
const part = (key: string, classes: string) => ({ ...dot(classes), key, slot: `chip-${key}` });

// Oracle: CSS Box Alignment 3 §8 and CSS Flexbox 1 §4.2. A flex item's margins add to the gap and
// never collapse, so a top margin of exactly minus the gap puts the item flush under the one before
// it. Chromium measured FieldFrame's legend-mode description flush under its legend, with the group
// a full gap below, at both densities on 2026-10-27.
describe("a flex column layer whose top margin cancels the column's gap", () => {
  it("joins the layer before it in a frame with no gap, which the column spaces as one layer", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex w-[200px] flex-col gap-[12px]", {
        parts: [part("head", "h-[20px]"), part("note", "h-[20px] -mt-[12px]"), part("body", "h-[40px]")],
      })
    );
    const [joined, body] = variant?.root.children ?? [];
    expect([
      variant?.root.itemSpacing,
      joined?.kind === "frame"
        ? [joined.key, joined.itemSpacing, joined.sizing, joined.children.map((child) => child.key)]
        : undefined,
      body?.key,
    ]).toEqual([
      { kind: "literal", value: 12 },
      ["head-flush", { kind: "literal", value: 0 }, { horizontal: FILL, vertical: HUG }, ["head", "note"]],
      "body",
    ]);
    expect(notesOf(coverage, "-mt-[12px]")).toEqual([
      [
        "chip-note",
        "literal",
        "cancels the column's gap above the layer, so it sits flush under the layer before it, which a frame around both with no gap draws",
      ],
    ]);
  });

  it("leaves a top margin that does not cancel the gap where it was", async () => {
    const { variant } = await buildFixture(
      chip("flex w-[200px] flex-col gap-[12px]", {
        parts: [part("head", "h-[20px]"), part("note", "h-[20px] -mt-[4px]")],
      })
    );
    expect(variant?.root.children.map((child) => child.key)).not.toContain("head-flush");
  });
});

// Oracle: CSS Flexbox 1 §9.3. A wrapping row breaks a line only where its items overflow it, which
// depends on their text, so only a measurement says a row keeps one line; Figma's row never wraps.
describe("a wrapping row of fixed width whose definition measured it fits one line", () => {
  it("drops `flex-wrap` with the measurement", async () => {
    const { coverage } = await buildFixture(
      chip("flex w-[200px] flex-wrap gap-[8px]", {
        parts: [part("a", "w-[40px] h-[20px]"), part("b", "w-[40px] h-[20px]")],
        fitsOneLine: "measured: both items end at 88px",
      })
    );
    expect(notesOf(coverage, "flex-wrap")).toEqual([["chip", "dropped", "measured: both items end at 88px"]]);
  });

  it("leaves it unmapped without one", async () => {
    const { coverage } = await buildFixture(
      chip("flex w-[200px] flex-wrap gap-[8px]", {
        parts: [part("a", "w-[40px] h-[20px]"), part("b", "w-[40px] h-[20px]")],
      })
    );
    expect(notesOf(coverage, "flex-wrap").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS 2.1 §10.3.3. A block-level box with no width of its own is as wide as its containing
// block, which a cell's preview width gives it, so a cell given none hugs and one given a width fills it.
describe("a preview width a definition gives per cell", () => {
  it("fixes the root at the width a cell gets and hugs where it gets none", async () => {
    const { componentSet } = await buildFixture(
      chip("flex h-[20px]", {
        axes: [{ name: "width", values: ["hug", "fill"] }],
        columnAxis: "width",
        parts: [part("a", "w-[40px] h-[20px]")],
        previewWidthFor: (cell) => (cell.width === "fill" ? 200 : undefined),
      })
    );
    expect(componentSet.variants.map((variant) => variant.root.sizing.horizontal)).toEqual([
      HUG,
      { kind: "fixed", length: { kind: "literal", value: 200 } },
    ]);
  });
});
