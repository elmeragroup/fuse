/**
 * How the build drops a box's declarations that draw nothing in a static frame: motion, carets, scroll behavior, bidi isolation, a transform at rest and a list's markers. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle: the CSS specification that says what the
 * browser draws, or the Figma plugin typings that say what Figma draws, under the coverage contract,
 * where a declaration that does not reach Figma is `unmapped` and one with nothing to draw is
 * `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, buildChip, chip, notesOf, part, rest } from "../../test/capture-fixtures";

// Oracle: the Figma component model, where a component is one static frame per variant with no
// keyframes, no scroll position and no text caret. A transition shorthand, a scroll-driven
// animation's timeline and range, a caret color, a scroll padding and an overscroll behavior have
// nothing to draw there, so they drop with the reason.
describe("declarations with no Figma form", () => {
  it.each([
    ["[transition:opacity_0.2s]", "transition", "Figma components do not animate"],
    ["[animation-timeline:scroll()]", "animation-timeline", "Figma components do not animate"],
    ["[animation-range:0_100%]", "animation-range", "Figma components do not animate"],
    ["caret-transparent", "caret-color", "a static frame shows no text caret"],
    [
      "scroll-px-8",
      "scroll-padding-inline",
      "a static frame does not scroll, so nothing scrolls into its view",
    ],
    [
      "overscroll-x-contain",
      "overscroll-behavior-x",
      "a static frame does not scroll, so no scroll chains past it",
    ],
  ])("drops %s", async (className, property, detail) => {
    const { coverage } = await buildChip(className);
    expect(notesOf(coverage, className)).toEqual([[property, "dropped", detail]]);
  });
});

// Oracle: CSS Writing Modes 4 §2.2, where `unicode-bidi: isolate` lays the box's text out as a
// paragraph of its own inside the line around it, as Figma lays out every text layer, and
// `bidi-override` reorders the box's own text, which Figma does not.
describe("unicode-bidi", () => {
  it("drops isolate, which isolates the text as a Figma text layer is", async () => {
    const { coverage } = await buildChip("[unicode-bidi:isolate]");
    expect(notesOf(coverage, "[unicode-bidi:isolate]")).toEqual([
      [
        "unicode-bidi",
        "dropped",
        "Figma lays out each text layer on its own, so no text around it reorders with it",
      ],
    ]);
  });

  it("leaves bidi-override unmapped", async () => {
    const { coverage } = await buildChip("[unicode-bidi:bidi-override]");
    expect(notesOf(coverage, "[unicode-bidi:bidi-override]").map(([, outcome]) => outcome)).toEqual([
      "unmapped",
    ]);
  });
});

// Oracle: CSS Transforms 1 §8. A list of translations by zero composes to the identity matrix, so
// the box draws where it lies, as an untransformed layer does; a translation by 4px moves it.
describe("a transform at rest", () => {
  it("drops a translation by zero", async () => {
    const { coverage } = await buildChip("[transform:translateX(0px)]");
    expect(
      notesOf(coverage, "[transform:translateX(0px)]").map(([property, outcome]) => [property, outcome])
    ).toEqual([["transform", "dropped"]]);
  });

  it("leaves a translation by 4px unmapped", async () => {
    const { coverage } = await buildChip("[transform:translateX(4px)]");
    expect(notesOf(coverage, "[transform:translateX(4px)]").map(([, outcome]) => outcome)).toEqual([
      "unmapped",
    ]);
  });

  // Toast's root nests its stack index in `calc()` and `max()`, which the value's own reading does
  // not evaluate; Chromium computes the index of 0 to the identity matrix, which the capture records.
  const NESTED = "[transform:translateY(calc(0px-(1*(0*0.75rem))))_scale(calc(max(0,1-(0*0.1))))]";

  it.each([
    [
      "drops a transform the capture measured as the identity in every mode",
      { identityTransform: true },
      "dropped",
    ],
    ["leaves the same transform unmapped where the capture measured no identity", {}, "unmapped"],
  ] as const)("%s", async (_case, measured, outcome) => {
    const { coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: `${NESTED} origin-bottom`, measured })
    );
    expect(
      [NESTED, "origin-bottom"].flatMap((className) =>
        notesOf(coverage, className).map(([property, note]) => [property, note])
      )
    ).toEqual([
      ["transform", outcome],
      ["transform-origin", outcome],
    ]);
  });
});

// Oracle: CSS Lists 3 §3. A list item whose `list-style-type` and `list-style-image` both resolve
// to `none` generates no marker, so its list's `list-none`, which the item inherits, draws nothing.
describe("a list's list-none", () => {
  it("drops where its item draws no marker", async () => {
    const { coverage } = await buildChip(
      "flex flex-col list-none",
      [
        {
          slot: "chip-dot",
          classes: "size-[8px]",
          written: [
            { className: "user agent", property: "display", value: "list-item", source: "user-agent" },
          ],
        },
      ],
      { parts: [part()] }
    );
    expect(notesOf(coverage, "list-none")).toEqual([
      ["list-style-type", "dropped", "both resolve to `none`, so the list item draws no marker"],
    ]);
  });
});
