/**
 * How the build sizes a Tabs list's triggers: a literal minimum beside a length a synced variable
 * sets, a `calc()` of a parent's whole height, and a row's growing layers that each keep their own
 * width. The unit under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Each case names its oracle, the CSS specification that says what the
 * browser draws, under the coverage contract, where a declaration that does not reach Figma is
 * `unmapped`.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, frameOf, notesOf, part, rest } from "../../test/capture-fixtures";
import type { FixtureOptions } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import { makeVariableIndex } from "./css-values";

/** `--control-h-md`, 36px dense and 44px comfortable, and a height formula over it, as the sync holds them. */
const VARIABLES: FixtureOptions = {
  variables: makeVariableIndex([
    {
      ref: { collection: "Fuse density", name: "control-h-md" },
      webSyntax: "var(--control-h-md)",
      minimum: 36,
      maximum: 44,
    },
    {
      ref: { collection: "Fuse density", name: "inner-h" },
      webSyntax: "calc(var(--control-h-md) - 8px - 1px)",
      minimum: 27,
      maximum: 35,
    },
  ]),
};

// Oracle: CSS 2.1 §10.7. A fixed height rises to its minimum, so a minimum no greater than the least
// value the height's variable holds in any mode never moves it, and one greater can.
describe("a literal minimum beside a height a variable sets", () => {
  it.each([
    ["33px, under the variable's least 36px", "min-h-[33px]", "dropped"],
    ["40px, past its least 36px", "min-h-[40px]", "unmapped"],
  ])("with a minimum of %s: %s", async (_, minimum, outcome) => {
    const { coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: `flex w-[100px] h-(--control-h-md) ${minimum}` }),
      VARIABLES
    );
    expect(notesOf(coverage, minimum).map(([, each]) => each)).toEqual([outcome]);
  });
});

// Oracle: CSS 2.1 §10.5 and CSS Values 4 §10.1. A part's `calc(100% - 1px)` takes its parent's
// definite content height, here `--control-h-md` less 4px of padding above and below, so it is that
// height less 1px in every mode, which binds the variable whose formula is the same length. Without
// such a variable the height stays unmapped.
describe("a part's `calc(100% - 1px)` height in a parent of a fixed height", () => {
  /** Build a chip whose 4px-padded row of a fixed height holds a dot of that height. */
  function build(options: FixtureOptions) {
    return buildCaptured(
      chip({ parts: [part()] }),
      rest({
        slot: "chip",
        classes: "flex items-center w-[100px] h-(--control-h-md) p-[4px]",
        children: [{ slot: "chip-dot", classes: "w-[8px] h-[calc(100%-1px)]" }],
      }),
      options
    );
  }

  it("binds the variable of that length", async () => {
    const { variant } = await build(VARIABLES);
    expect(frameOf(variant?.root)?.sizing.vertical).toEqual({
      kind: "fixed",
      length: { kind: "variable", variable: { collection: "Fuse density", name: "inner-h" } },
    });
  });

  // Along a flex column's direction, a layer's height is its basis, which it grows from or shrinks
  // from to fit the column beside its margins and its siblings (CSS Flexbox 1 §9.7): a lone layer
  // with a 10px top margin shrinks 10px, and one 8px taller than the content box shrinks to it.
  it.each([
    ["beside another layer", "h-[calc(100%-1px)]", [{ slot: "b", classes: "size-[8px]" }]],
    ["alone with a top margin", "h-[calc(100%-1px)] mt-[10px]", []],
    ["alone and taller than the content box", "h-[calc(100%+8px)]", []],
  ])(
    "stays unmapped along a column's direction %s, which can grow or shrink it",
    async (_, classes, others) => {
      const height = classes.split(" ")[0] ?? "";
      const { coverage } = await buildCaptured(
        chip({ parts: others.length === 0 ? [part()] : [part(), part({ key: "b", slot: "b" })] }),
        rest({
          slot: "chip",
          classes: "flex flex-col items-start w-[100px] h-(--control-h-md) p-[4px]",
          children: [{ slot: "chip-dot", classes: `w-[8px] ${classes}` }, ...others],
        }),
        VARIABLES
      );
      expect(notesOf(coverage, height).map(([, each]) => each)).toEqual(["unmapped"]);
    }
  );

  it("stays unmapped where no variable holds it", async () => {
    const { coverage } = await build({
      variables: makeVariableIndex([
        {
          ref: { collection: "Fuse density", name: "control-h-md" },
          webSyntax: "var(--control-h-md)",
          minimum: 36,
          maximum: 44,
        },
      ]),
    });
    expect(notesOf(coverage, "h-[calc(100%-1px)]").map(([, each]) => each)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Flexbox 1 §4.5 and §9.7. A row that hugs its layers is as wide as their content widths
// together, as Chromium sizes it, which the capture's `itemsAtContent` measured. Layers that grow
// from a zero basis (`flex: 1`), with the automatic minimum of their content, `min-width: auto`, and
// text that does not wrap, so their min-content is their max-content, need at least their content
// widths, which already fill that row, so each ends at exactly its own content width for any text a
// designer types, which a hugging layer draws. A minimum of zero, a basis of its own, a width that
// lowers the automatic minimum, text that wraps, a row of a width of its own or with a limit, and a
// row the capture did not measure, all let the layers take other widths, so their `flex` stays
// unmapped.
describe("a row's growing layers", () => {
  /** Build a row of the given classes around two layers of the given classes, with the row's facts. */
  function build(classes: string, item: string, measured: MeasuredFacts) {
    return buildCaptured(
      chip({ parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] }),
      rest({
        slot: "chip",
        classes,
        measured,
        children: [
          { slot: "a", classes: `${item} h-[8px]` },
          { slot: "b", classes: `${item} h-[8px]` },
        ],
      })
    );
  }

  const AT_CONTENT: MeasuredFacts = { itemsAtContent: true };
  const NONE: MeasuredFacts = {};
  const ITEM = "flex-1 whitespace-nowrap";

  it.each([
    ["a hugging row measured at their content", "flex w-fit", ITEM, AT_CONTENT, "dropped"],
    ["a hugging row without the measurement", "flex w-fit", ITEM, NONE, "unmapped"],
    ["a row of its own width", "flex w-[200px]", ITEM, AT_CONTENT, "unmapped"],
    ["a hugging row with a minimum width", "flex w-fit min-w-[200px]", ITEM, AT_CONTENT, "unmapped"],
    ["layers with a zero minimum", "flex w-fit", `${ITEM} min-w-0`, AT_CONTENT, "unmapped"],
    ["layers whose text wraps", "flex w-fit", "flex-1", AT_CONTENT, "unmapped"],
    [
      "layers with a basis of their own",
      "flex w-fit",
      "flex-[1_0_60px] whitespace-nowrap",
      AT_CONTENT,
      "unmapped",
    ],
    ["layers with a width", "flex w-fit", `${ITEM} w-[20px]`, AT_CONTENT, "unmapped"],
  ])("in %s", async (_, classes, item, measured, outcome) => {
    const { coverage } = await build(classes, item, measured);
    const flex = item.split(" ")[0] ?? "";
    expect(
      notesOf(coverage, flex)
        .filter(([property]) => property === "flex")
        .map(([, each]) => each)
    ).toEqual([outcome, outcome]);
  });
});

// Oracle: CSS 2.1 §10.5 and CSS Flexbox 1 §9.7. A root's `calc(100% - 1px)` takes the content height of
// the element around it, a list `--control-h-md` tall less 4px of padding above and below. The list
// is an item of a flex column, which could grow or shrink it, and sets a minimum of its own, so its
// height is its declared one only where the capture measured it so in every mode (`basisAsDeclared`).
// Then the root binds the variable of that length less 1px; without the measurement it stays unmapped.
describe("a root's `calc(100% - 1px)` height inside a list in a flex column", () => {
  /** Build a chip whose root sits in the list, in the column, with the root's facts. */
  function build(measured: MeasuredFacts) {
    return buildCaptured(
      chip(),
      [
        {
          cell: { state: "rest" },
          around: [
            { slot: "column", classes: "flex flex-col" },
            { slot: "list", classes: "box-border flex items-center h-(--control-h-md) p-[4px] min-h-[33px]" },
          ],
          root: { slot: "chip", classes: "flex w-[20px] h-[calc(100%-1px)] min-h-[24px]", measured },
        },
      ],
      VARIABLES
    );
  }

  it("binds the variable of that length where the capture measured the list as declared", async () => {
    const { variant } = await build({ basisAsDeclared: true });
    expect(variant?.root.sizing.vertical).toEqual({
      kind: "fixed",
      length: { kind: "variable", variable: { collection: "Fuse density", name: "inner-h" } },
    });
  });

  it("stays unmapped without the measurement", async () => {
    const { coverage } = await build({});
    expect(notesOf(coverage, "h-[calc(100%-1px)]").map(([, each]) => each)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Overflow 3 §3 and the Figma plugin typings. A root whose `overflow` is visible paints a
// layer placed past its edges, as a line Tabs trigger's underline 4px below it. A set's roots clip
// where a cell's root casts a shadow, which Figma spreads only from a clipping frame, so a variant
// whose root casts none leaves the layer unclipped, and one that casts a shadow keeps its clip. A
// root that clips in CSS cuts the layer in the browser too, so it keeps its clip either way.
describe("a root that holds a layer placed past its bottom edge", () => {
  it("clips only in the variant whose root casts a shadow", async () => {
    const line = { slot: "chip-dot", classes: "absolute inset-x-0 bottom-[-4px] h-[2px] bg-[#000000]" };
    const { componentSet } = await buildCaptured(
      chip({ axes: [{ name: "state", values: ["rest", "hover"] }], parts: [part()] }),
      [
        {
          cell: { state: "rest" },
          root: { slot: "chip", classes: "relative w-[40px] h-[20px]", children: [line] },
        },
        {
          cell: { state: "hover" },
          root: {
            slot: "chip",
            classes: "relative w-[40px] h-[20px] shadow-[0_1px_2px_#000000]",
            children: [line],
          },
        },
      ]
    );
    expect(componentSet.variants.map((variant) => [variant.key, variant.root.clips])).toEqual([
      ["chip/state=rest", false],
      ["chip/state=hover", true],
    ]);
  });

  it("keeps the clip where the root clips in CSS, which cuts the layer there too", async () => {
    const line = { slot: "chip-dot", classes: "absolute inset-x-0 bottom-[-4px] h-[2px] bg-[#000000]" };
    const root = (classes: string) => ({
      slot: "chip",
      classes: `relative w-[40px] h-[20px] ${classes}`,
      children: [line],
    });
    const { componentSet } = await buildCaptured(
      chip({ axes: [{ name: "state", values: ["rest", "hover"] }], parts: [part()] }),
      [
        { cell: { state: "rest" }, root: root("overflow-hidden") },
        { cell: { state: "hover" }, root: root("overflow-hidden shadow-[0_1px_2px_#000000]") },
      ]
    );
    expect(componentSet.variants.map((variant) => variant.root.clips)).toEqual([true, true]);
  });
});
