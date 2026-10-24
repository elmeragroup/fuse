/**
 * Build rules the Breadcrumb trail and the Pagination row are the first sets to need, against the
 * one-cell `chip` fixture of `test/fixture-sets.ts`. The unit under test is `buildComponentSet`, and
 * `buildSetsInOrder` where a fixture holds an instance. Each describe names its oracle.
 */
import { describe, expect, it } from "vitest";

import { HUG } from "../../test/built-kit";
import { buildFixture, buildFixtures, chip, dot, frameOf } from "../../test/fixture-sets";
import type { FixtureContext } from "../../test/fixture-sets";
import { BREADCRUMB_ELLIPSIS } from "./breadcrumb-kit";
import type { LabelDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";

/** The part, property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage
    .filter((row) => row.className === className)
    .map((row) => [row.part, row.property, row.outcome, row.detail]);

/** The outcomes of the coverage rows of one class, each once. */
const outcomesOf = (coverage: readonly CoverageRow[], className: string) =>
  new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome));

/**
 * A build context whose `font-sans` binds the synced family and `muted-foreground` the color
 * Breadcrumb's list gives its parts, and whose page gives every box a text color, as a Fuse host's
 * `<body>` does, so a label and an icon build.
 */
const TEXT_CONTEXT: FixtureContext = {
  variables: makeVariableIndex(
    ["font-sans", "muted-foreground"].map((name) => ({
      ref: { collection: "Fuse tokens", name },
      webSyntax: `var(--${name})`,
    }))
  ),
  page: [{ className: "body", property: "color", value: "rgb(0 0 0)" }],
};

/** The type a fixture label sets in. */
const TYPE = "font-sans text-[14px] leading-[20px]";

/** A label with a space, which a browser can break a line at. */
const TEXT: LabelDefinition = {
  key: "label",
  name: "label",
  characters: "Hello world",
  textProperty: undefined,
  shownIn: () => true,
};

// Oracle: CSS Text 3 §5.5, under which `overflow-wrap` inherits and `break-word` breaks a word only
// where the word would overflow its line, and CSS Sizing 3 §5.1, under which a text that hugs its
// width in a box nothing bounds sets each line at its max-content width, where every word fits. A
// `max-width`, or a box of fixed width, sets a line narrower than a word can be.
describe("a box that breaks overflowing words", () => {
  it("drops `wrap-break-word` on a text that hugs its width with nothing bounding it", async () => {
    const { coverage } = await buildFixture(
      chip(`block wrap-break-word ${TYPE}`, { label: TEXT }),
      TEXT_CONTEXT
    );
    expect(notesOf(coverage, "wrap-break-word")).toEqual([
      [
        "chip",
        "overflow-wrap",
        "dropped",
        "the text hugs its width and nothing bounds the width CSS gives it, so no line is narrower than a word, and no word overflows to break",
      ],
    ]);
  });

  it("drops `wrap-break-word` on a box with no text in it or below it", async () => {
    const { coverage } = await buildFixture(chip("flex wrap-break-word", { parts: [dot("size-[8px]")] }));
    expect(notesOf(coverage, "wrap-break-word")).toEqual([
      ["chip", "overflow-wrap", "dropped", "the cell shows no text"],
    ]);
  });

  it("leaves `wrap-break-word` unmapped on a text a max-width caps", async () => {
    const { coverage } = await buildFixture(
      chip(`block wrap-break-word max-w-[40px] ${TYPE}`, { label: TEXT }),
      TEXT_CONTEXT
    );
    expect(outcomesOf(coverage, "wrap-break-word")).toEqual(new Set(["unmapped"]));
  });

  it("leaves `wrap-break-word` unmapped where a text below that inherits it fills a fixed width", async () => {
    const { coverage } = await buildFixture(
      chip(`flex wrap-break-word ${TYPE}`, { parts: [{ ...dot("block w-[40px]"), label: TEXT }] }),
      TEXT_CONTEXT
    );
    expect(outcomesOf(coverage, "wrap-break-word")).toEqual(new Set(["unmapped"]));
  });
});

// Oracle: Tailwind compiles `space-y-4` to `:where(.space-y-4 > :not(:last-child))`, and Selectors 4
// §14.3, under which `:last-child` matches the one element child of its parent, so that rule styles
// no child of a box that holds one. Every element child counts, drawn or not, as the visually hidden
// `<span>` Breadcrumb's ellipsis holds after its icon. Between two children the rule sets a margin,
// which the kit does not draw.
describe("a class that spaces a box's children", () => {
  const ONE = dot("size-[8px]");
  const TWO = { ...dot("size-[8px]"), key: "second", slot: "chip-second" };

  it("drops `space-y-4` on a box that holds one element child, its last", async () => {
    const { coverage } = await buildFixture(
      chip("flex flex-col space-y-4", { parts: [ONE], undrawnChildren: () => 0 })
    );
    const reason =
      "`:not(:last-child)` styles every child but the last, and the box holds one, so the class styles nothing the set draws";
    expect(notesOf(coverage, "space-y-4")).toEqual([
      ["chip", "--tw-space-y-reverse", "dropped", reason],
      ["chip", "margin-block-start", "dropped", reason],
      ["chip", "margin-block-end", "dropped", reason],
    ]);
  });

  it.each([
    ["two parts", chip("flex flex-col space-y-4", { parts: [ONE, TWO], undrawnChildren: () => 0 })],
    [
      "a part and an element the kit draws no layer for",
      chip("flex flex-col space-y-4", { parts: [ONE], undrawnChildren: () => 1 }),
    ],
  ])("leaves `space-y-4` unmapped on a box that holds %s", async (_children, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(outcomesOf(coverage, "space-y-4")).toEqual(new Set(["unmapped"]));
  });

  it("leaves `space-y-4` unmapped on a box whose definition does not count its element children", async () => {
    const { coverage } = await buildFixture(chip("flex flex-col space-y-4", { parts: [ONE] }));
    expect(notesOf(coverage, "space-y-4").map(([, , outcome, detail]) => [outcome, detail])).toContainEqual([
      "unmapped",
      "the definition does not count the element children the box's markup holds, so the build cannot tell which is the last",
    ]);
  });

  it("leaves a `space-y-4` passed to a Breadcrumb ellipsis instance unmapped, beside its hidden copy", async () => {
    const holder = chip("flex", {
      parts: [
        {
          kind: "instance",
          key: "ellipsis",
          of: BREADCRUMB_ELLIPSIS,
          cell: () => ({ size: "20" }),
          classesFor: () => "space-y-4",
          shownIn: () => true,
        },
      ],
    });
    const [, built] = await buildFixtures([BREADCRUMB_ELLIPSIS, holder], TEXT_CONTEXT);
    expect(outcomesOf(built?.coverage ?? [], "space-y-4")).toEqual(new Set(["unmapped"]));
  });

  it("leaves `**:space-y-4` unmapped, since it spaces the children of the elements below the box", async () => {
    const { coverage } = await buildFixture(
      chip("flex **:space-y-4", { parts: [ONE], undrawnChildren: () => 0 })
    );
    expect(outcomesOf(coverage, "**:space-y-4")).toEqual(new Set(["unmapped"]));
  });

  it("drops `space-y-4` on an element around the root with that element's reason", async () => {
    const { coverage } = await buildFixture(
      chip("flex", {
        ancestorsFor: () => [{ slot: "chip-list", classes: "space-y-4", undrawn: "the list is not drawn" }],
      })
    );
    expect(notesOf(coverage, "space-y-4")).toEqual(
      ["--tw-space-y-reverse", "margin-block-start", "margin-block-end"].map((property) => [
        "chip-list",
        property,
        "dropped",
        "the list is not drawn",
      ])
    );
  });
});

// Oracle: CSS 2.1 §10.3.3, under which an in-flow block-level box's unset width fills its containing
// block less its margins, padding and border, and `width: 100%` makes it the containing block's
// width, so the two agree where those are zero and auto margins resolve to zero. A root sits alone in
// its component set, which gives it no width, so the kit draws a block-level root's unset width
// hugging. An absolute box's `100%` takes its containing block, while its unset width shrinks to fit
// its content (§10.3.7), so the two differ there.
describe("a block-level root's `w-full` with no preview width", () => {
  it("hugs, as the root's unset width does", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex w-full mx-auto", { parts: [dot("size-[8px]")] })
    );
    expect(variant?.root.sizing.horizontal).toEqual(HUG);
    expect(notesOf(coverage, "w-full")).toEqual([
      [
        "chip",
        "width",
        "literal",
        "100% sizes an in-flow block-level box with no margins, padding or border as its unset width does, which hugs, since the root sits alone in its component set",
      ],
    ]);
  });

  it.each(["mx-2", "px-2", "border", "absolute"])("stays unmapped beside `%s`", async (other) => {
    const { coverage } = await buildFixture(chip(`flex w-full ${other}`, { parts: [dot("size-[8px]")] }));
    expect(outcomesOf(coverage, "w-full")).toEqual(new Set(["unmapped"]));
  });
});

// Oracle: CSS Sizing 3 §5.1 and CSS 2.1 §10.4. A parent that hugs its width in a box nothing bounds
// is as wide as its layers laid out at their max-content widths, so each layer fits inside it, and a
// `max-width: 100%` of the parent never makes a layer narrower. A parent of fixed width, one a
// `max-width` caps, and a hugging parent inside a box of fixed width can be narrower than a layer.
describe("a part's `max-w-full`", () => {
  it("drops in a parent that hugs its width with nothing bounding it", async () => {
    const { variant, coverage } = await buildFixture(chip("flex", { parts: [dot("max-w-full size-[8px]")] }));
    expect(frameOf(variant?.root)?.limits.maxWidth).toBeUndefined();
    expect(notesOf(coverage, "max-w-full")).toEqual([
      [
        "chip-dot",
        "max-width",
        "dropped",
        "its parent hugs what it holds and nothing bounds the width CSS gives the parent, so 100% of the parent is never narrower than the box",
      ],
    ]);
  });

  it.each([
    ["a fixed parent", chip("flex w-[100px]", { parts: [dot("max-w-full size-[8px]")] })],
    ["a parent a max-width caps", chip("flex max-w-[100px]", { parts: [dot("max-w-full size-[8px]")] })],
    [
      "a hugging parent inside a fixed box",
      chip("flex w-[100px]", {
        parts: [
          { ...dot("flex"), parts: [{ ...dot("max-w-full size-[8px]"), key: "inner", slot: "chip-inner" }] },
        ],
      }),
    ],
  ])("stays unmapped in %s", async (_parent, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(outcomesOf(coverage, "max-w-full")).toEqual(new Set(["unmapped"]));
  });
});
