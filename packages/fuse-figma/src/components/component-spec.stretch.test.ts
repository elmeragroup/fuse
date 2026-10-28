/**
 * Build rules Toolbar is the first set to need, against the `chip` and `dot` fixtures of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`.
 *
 * Oracle: CSS Flexbox 1 §9.4 step 11 and §4.2. A flex item whose `align-self` is `stretch`, whose
 * cross size is `auto` and whose cross margins are not `auto` is as long across as the flex line less
 * its margins, and its margins never collapse. Chromium measured Toolbar's separator so on 2026-10-27:
 * 1×24 at y 9 in a dense bar whose items are 32 tall at y 5 (a 4px margin above and below), and 88.3×1
 * at x 9 in a vertical bar whose widest item is 96.3 at x 5. A Figma layer that fills a hugging frame
 * across stretches to the length the frame's other layers set (PF), and a real file drew Toolbar's
 * separator instance so, filling its padded frame whatever its main's length (W5-P10).
 */
import { describe, expect, it } from "vitest";

import { FILL, fixed, HUG, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { CoverageRow } from "./coverage";

/** The outcome and detail of each coverage row of one class and property. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

/** A fixture part with its own key and slot. */
const part = (key: string, classes: string) => ({ ...dot(classes), key, slot: `chip-${key}` });

const STRETCH =
  "the item stretches across the counter axis to the flex line less its margins, as a layer that fills that axis does";
const MARGIN = "4px of padding on a frame around the part, the space the margin adds";

describe("a flex item its own align-self stretches across its parent", () => {
  it("fills a row's height inside a frame that pads its top and bottom by its margins", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex items-center gap-[4px]", {
        parts: [part("item", "h-[32px] w-[40px]"), part("rule", "w-px self-stretch my-[4px] bg-[#000000]")],
      })
    );
    const rule = variant?.root.children[1];
    expect(rule).toMatchObject({
      kind: "frame",
      key: "rule",
      direction: "HORIZONTAL",
      sizing: { horizontal: HUG, vertical: FILL },
      paddingTop: literal(4),
      paddingBottom: literal(4),
      paddingLeft: literal(0),
      paddingRight: literal(0),
    });
    expect(rule?.kind === "frame" ? rule.children : undefined).toMatchObject([
      { key: "box", sizing: { horizontal: fixed(literal(1)), vertical: FILL } },
    ]);
    expect([...notesOf(coverage, "self-stretch"), ...notesOf(coverage, "my-[4px]")]).toEqual([
      ["align-self", "literal", STRETCH],
      ["margin-top", "literal", MARGIN],
      ["margin-bottom", "literal", MARGIN],
    ]);
  });

  it("fills a column's width inside a frame that pads its sides by its margins", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col items-center gap-[4px]", {
        parts: [
          part("item", "h-[32px] w-[80px]"),
          part("rule", "h-px w-auto self-stretch mx-[4px] bg-[#000000]"),
        ],
      })
    );
    const rule = variant?.root.children[1];
    expect(rule).toMatchObject({
      kind: "frame",
      direction: "VERTICAL",
      sizing: { horizontal: FILL, vertical: HUG },
      paddingLeft: literal(4),
      paddingRight: literal(4),
    });
    expect(rule?.kind === "frame" ? rule.children : undefined).toMatchObject([
      { key: "box", sizing: { horizontal: FILL, vertical: fixed(literal(1)) } },
    ]);
    expect(notesOf(coverage, "self-stretch")).toEqual([["align-self", "literal", STRETCH]]);
  });

  // A definite cross size takes no stretch (§9.4 step 11), so the item keeps it, and the build leaves
  // the `align-self` unread rather than draw a stretch.
  it("keeps an item's own height and leaves its align-self unmapped", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex items-center gap-[4px]", {
        parts: [part("item", "h-[32px] w-[40px]"), part("rule", "h-[10px] w-px self-stretch bg-[#000000]")],
      })
    );
    expect(variant?.root.children[1]).toMatchObject({ sizing: { vertical: fixed(literal(10)) } });
    expect(notesOf(coverage, "self-stretch").map(([property, outcome]) => [property, outcome])).toEqual([
      ["align-self", "unmapped"],
    ]);
  });
});
