/**
 * A `position: fixed` root that sizes against the viewport its definition declares, as Dialog's
 * popup, Command's palette and the overlay scrim do, which Dialog, Alert dialog and Command dialog are
 * the first sets to need, against the `chip` and `dot` fixtures of `test/fixture-sets.ts`. The unit
 * under test is `buildComponentSet`.
 *
 * Oracle: CSS 2.1 §10.1, §10.2 and §10.5, where a fixed box's containing block is the viewport and its
 * percentages take the viewport's width and height; CSS Values 4 §6.1.2, where `100dvh` is the dynamic
 * viewport's height, which a static frame holds still; CSS 2.1 §10.3.7 and §10.6.4, where `inset: 0`
 * with an automatic width and height sizes the box to its containing block; and CSS 2.1 §10.4, where a
 * `max-width` lowers the width. In a 1280 × 800 viewport Dialog's `w-full max-w-(--overlay-width)`, with
 * `--overlay-width: min(28rem, 90%)`, is 448px wide and its `max-h-[calc(100%-2rem)]` 768px; in a
 * 400 × 600 one 360px and 568px. Command's `w-[calc(100%-2rem)] max-w-xl` is 576px and its
 * `max-h-[calc(100dvh-2*max(--spacing(4),12dvh))]` 608px. CSS Conditional 3 §6: `@supports
 * (backdrop-filter: …)` holds in Chromium, which draws the scrim's `backdrop-blur-xs`, 4px, and a
 * real file's BACKGROUND_BLUR of radius 8 blurred a step as CSS's `blur(4px)` does (W5-P13).
 */
import { describe, expect, it } from "vitest";

import { fixed, HUG, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { CoverageRow } from "./coverage";

/** The class, property and detail of each unmapped coverage row. */
const unmapped = (coverage: readonly CoverageRow[]) =>
  coverage.filter((row) => row.outcome === "unmapped").map((row) => [row.className, row.property]);

/** The outcome and detail of each coverage row of one class and property. */
const notesOf = (coverage: readonly CoverageRow[], className: string, property: string) =>
  coverage
    .filter((row) => row.className === className && row.property === property)
    .map((row) => [row.outcome, row.detail]);

const BODY = { ...dot("h-[40px]"), key: "body", slot: "chip-body" };

const DIALOG =
  "fixed top-1/2 left-1/2 flex flex-col max-h-[calc(100%-2rem)] w-full max-w-(--overlay-width) -translate-x-1/2 -translate-y-1/2 [--overlay-width:min(var(--container-md),90%)] p-[24px] bg-[#ffffff]";

const COMMAND =
  "max-w-xl fixed top-[max(--spacing(4),12dvh)] left-1/2 flex max-h-[calc(100dvh-2*max(--spacing(4),12dvh))] w-[calc(100%-2rem)] -translate-x-1/2 flex-col bg-[#ffffff]";

const SCRIM = "fixed inset-0 isolate bg-black/10 supports-backdrop-filter:backdrop-blur-xs";

describe("a fixed root in a declared viewport", () => {
  it("takes Dialog's width from min(28rem, 90%) of the viewport and its height cap from 100% less 2rem", async () => {
    const wide = await buildFixture(chip(DIALOG, { parts: [BODY], viewport: { width: 1280, height: 800 } }));
    const narrow = await buildFixture(chip(DIALOG, { parts: [BODY], viewport: { width: 400, height: 600 } }));
    expect([
      [wide.variant?.root.sizing, wide.variant?.root.limits],
      [narrow.variant?.root.sizing, narrow.variant?.root.limits],
    ]).toEqual([
      [{ horizontal: fixed(literal(448)), vertical: HUG }, { maxHeight: literal(768) }],
      [{ horizontal: fixed(literal(360)), vertical: HUG }, { maxHeight: literal(568) }],
    ]);
    expect(unmapped(wide.coverage)).toEqual([]);
  });

  it("reads Command's dvh and calc() lengths against the viewport's height and width", async () => {
    const { variant, coverage } = await buildFixture(
      chip(COMMAND, { parts: [BODY], viewport: { width: 1280, height: 800 } })
    );
    expect([variant?.root.sizing, variant?.root.limits]).toEqual([
      { horizontal: fixed(literal(576)), vertical: HUG },
      { maxHeight: literal(608) },
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("sizes the scrim to the viewport and draws its backdrop blur as a background blur", async () => {
    const { variant, coverage } = await buildFixture(chip(SCRIM, { viewport: { width: 1280, height: 800 } }));
    expect(variant?.root).toMatchObject({
      sizing: { horizontal: fixed(literal(1280)), vertical: fixed(literal(800)) },
      backgroundBlur: literal(8),
    });
    expect(notesOf(coverage, "supports-backdrop-filter:backdrop-blur-xs", "backdrop-filter")).toEqual([
      [
        "literal",
        "a background blur of 8, twice the CSS blur's 4px standard deviation, as Figma's blur radius counts it (W5-P13)",
      ],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("leaves Dialog's lengths unmapped where its definition declares no viewport", async () => {
    const { coverage } = await buildFixture(chip(DIALOG, { parts: [BODY] }));
    expect(unmapped(coverage)).toContainEqual(["w-full", "width"]);
  });
});
