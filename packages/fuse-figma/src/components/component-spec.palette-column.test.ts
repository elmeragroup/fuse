/**
 * A column laid out as the Command palette lays out its rows. Unit under test: `buildFixtures`, the
 * build of each fixture's box. Oracles:
 *
 * - CSS 2.1 §10.3.3 and CSS Flexbox 1 §9.4 step 11: a block with no width of its own that a column
 *   stretches spans the column less its margins, so its `mx-[8px]` insets it 8px on each side.
 * - CSS Flexbox 1 §9.7: a column that hugs its layers under a `max-height` they never reach is as tall
 *   as they are, so its `flex-1` layer has no room to grow into.
 * - CSS Box Alignment 3 §8.1: a row spaces its layers by `column-gap`, and `row-gap` spaces only the
 *   lines a wrapping row breaks into, which a row on one line has none of.
 */
import { describe, expect, it } from "vitest";

import { literal } from "../../test/built-kit";
import { buildFixtures, chip, dot } from "../../test/fixture-sets";
import type { ComponentDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";

/** The outcomes of a build's rows for a property. */
const outcomes = (coverage: readonly CoverageRow[], property: string) =>
  coverage.filter((row) => row.property === property).map((row) => row.outcome);

/** A 200px column holding one part. */
function column(part: string, fields: Partial<ComponentDefinition> = {}): ComponentDefinition {
  return chip("flex w-[200px] flex-col", {
    parts: [{ ...dot(part), parts: [{ ...dot("h-[20px] w-[20px]"), key: "body", slot: "chip-body" }] }],
    ...fields,
  });
}

describe("a part a column stretches across, with margins across", () => {
  it("insets the part by its margins where it sets no width of its own", async () => {
    const [built] = await buildFixtures([column("block mx-[8px]")]);
    // The part's margins pad the frame drawn around it, which fills the column across.
    const [margin] = built?.componentSet.variants[0]?.root.children ?? [];
    expect(margin).toMatchObject({
      sizing: { horizontal: { kind: "fill" } },
      paddingLeft: literal(8),
      paddingRight: literal(8),
    });
    expect(outcomes(built?.coverage ?? [], "margin-left")).toEqual(["literal"]);
  });

  it("leaves them unmapped where the part sets its width", async () => {
    const [built] = await buildFixtures([column("block w-full mx-[8px]")]);
    expect(outcomes(built?.coverage ?? [], "margin-left")).toEqual(["unmapped"]);
  });
});

describe("a column that hugs its layers under a max-height, one of them growing", () => {
  const capped = (fields: Partial<ComponentDefinition>) =>
    chip("flex w-[200px] max-h-[300px] flex-col", {
      parts: [
        { ...dot("h-[20px]"), key: "head", slot: "chip-head" },
        {
          ...dot("min-h-0 flex-1"),
          parts: [{ ...dot("h-[20px] w-[20px]"), key: "body", slot: "chip-body" }],
        },
      ],
      ...fields,
    });

  it("drops the growth with the measurement that the layers stay under the cap", async () => {
    const [built] = await buildFixtures([capped({ underMaxHeight: "measured 40px under its 300px cap" })]);
    const rows = (built?.coverage ?? []).filter((row) => row.property === "flex");
    expect(
      rows.map((row) => [row.outcome, row.detail.includes("measured 40px under its 300px cap")])
    ).toEqual([["dropped", true]]);
  });

  it("leaves the growth unmapped without that measurement", async () => {
    const [built] = await buildFixtures([capped({})]);
    expect(outcomes(built?.coverage ?? [], "flex")).toEqual(["unmapped"]);
  });
});

describe("a wrapping row measured to fit one line, spaced by gap-x and gap-y", () => {
  const row = (fields: Partial<ComponentDefinition>) =>
    chip("flex w-[200px] flex-wrap gap-x-[16px] gap-y-[4px]", {
      parts: [
        { ...dot("h-[20px] w-[20px]"), key: "first", slot: "chip-first" },
        { ...dot("h-[20px] w-[20px]"), key: "second", slot: "chip-second" },
      ],
      ...fields,
    });

  it("spaces its layers by column-gap and drops row-gap with the wrap", async () => {
    const [built] = await buildFixtures([row({ fitsOneLine: "measured on one line" })]);
    expect(built?.componentSet.variants[0]?.root).toMatchObject({ itemSpacing: literal(16) });
    expect([
      outcomes(built?.coverage ?? [], "flex-wrap"),
      outcomes(built?.coverage ?? [], "row-gap"),
      outcomes(built?.coverage ?? [], "column-gap"),
    ]).toEqual([["dropped"], ["dropped"], ["literal"]]);
  });

  it("leaves the wrap and row-gap unmapped without the measurement", async () => {
    const [built] = await buildFixtures([row({})]);
    expect([
      outcomes(built?.coverage ?? [], "flex-wrap"),
      outcomes(built?.coverage ?? [], "row-gap"),
    ]).toEqual([["unmapped"], ["unmapped"]]);
  });
});
