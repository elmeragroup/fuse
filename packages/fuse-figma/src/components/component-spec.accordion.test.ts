/**
 * Build rules Accordion's item is the first set to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { FILL, fixed, literal } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf } from "../../test/fixture-sets";
import type { LabelDefinition, OuterDeclaration } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec, FrameLayerSpec } from "./kit-spec";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

/** The display the browser's default style sheet gives a `<div>`. */
const BLOCK: readonly OuterDeclaration[] = [
  { className: "user agent style sheet, div", property: "display", value: "block" },
];

/** The outcome and detail of the root's `display`. */
const rootDisplay = (coverage: readonly CoverageRow[]) =>
  coverage
    .filter((row) => row.part === "chip" && row.property === "display")
    .map((row) => [row.property, row.outcome, row.detail]);

// Oracle: CSS 2.1 §9.4.1 and §10.3.3. A block container whose children are all block-level boxes
// stacks them down its content box in document order, with no gap, and a child that sets no width
// is as wide as that content box. A flex box is block-level too (CSS Flexbox 1 §3). In a 100px box
// with 4px of padding, an 8px flex row and a 6px block each take the 92px between the paddings.
describe("a block box that holds only block-level parts", () => {
  const parts = [
    { ...dot("flex h-[8px]"), key: "row", slot: "chip-row" },
    { ...dot("h-[6px]"), key: "block", slot: "chip-block", elementDefaults: BLOCK },
  ];

  it("stacks them down a vertical auto layout, each filling its width", async () => {
    const { variant, coverage } = await buildFixture(
      chip("w-[100px] p-[4px]", { elementDefaults: BLOCK, parts })
    );
    const root = variant?.root;
    expect([root?.direction, root?.itemSpacing, root?.primaryAlign, root?.counterAlign]).toEqual([
      "VERTICAL",
      literal(0),
      "MIN",
      "MIN",
    ]);
    expect(root?.children.map((child) => child.kind === "frame" && child.sizing)).toEqual([
      { horizontal: FILL, vertical: fixed(literal(8)) },
      { horizontal: FILL, vertical: fixed(literal(6)) },
    ]);
    expect(rootDisplay(coverage)).toEqual([
      [
        "display",
        "literal",
        "a vertical auto layout, its block-level parts stacked down it, each as wide as the box",
      ],
    ]);
  });

  // A gap separates no blocks (CSS Box Alignment 3 §8 applies it to flex, grid and multi-column
  // containers), a box that hugs its width gives its blocks no width to fill, and a part whose
  // display nothing sets may be inline. The build cannot draw any of them as the browser does.
  it.each([
    ["a gap", chip("w-[100px] gap-[4px]", { elementDefaults: BLOCK, parts })],
    ["a hugging width", chip("", { elementDefaults: BLOCK, parts })],
    ["a part of unknown display", chip("w-[100px]", { elementDefaults: BLOCK, parts: [dot("h-[6px]")] })],
  ])("stays unmapped with %s", async (_case, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(rootDisplay(coverage)).toEqual([["display", "unmapped", "no Figma field reads block"]]);
  });
});

/** The synced variables the override cases bind: the font, `foreground`, `card` and `muted`. */
const SYNCED = makeVariableIndex(
  ["font-sans", "foreground", "card", "muted"].map((name) => ({
    ref: { collection: "Fuse tokens", name },
    webSyntax: `var(--${name})`,
  }))
);

/** A label the part holds, which reads the text color the part computes. */
const TEXT: LabelDefinition = {
  key: "text",
  name: "text",
  characters: "Chip",
  textProperty: undefined,
  shownIn: () => true,
};

const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;
const token = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;

/** The fill of a box and the color of the text it holds. */
function paintOf(box: BoxSpec | FrameLayerSpec | undefined) {
  const text = box?.children.find((child) => child.kind === "text");
  return { fill: box?.fill, text: text?.kind === "text" ? text.color : undefined };
}

// Oracle: CSS Custom Properties 1 §2 and §3. A `var()` resolves on the element that declares the
// property holding it, against the custom properties that element sets or inherits, and a child
// inherits the computed value, so a child's own value of a custom property changes only what the
// child itself declares with `var()`. A custom property draws nothing, so a local value no
// declaration resolves through paints nowhere.
describe("a local value of a synced variable", () => {
  it.each([
    [
      "the box itself",
      chip("bg-card [--card:#ff0000]"),
      "[--card:#ff0000]",
      RED,
      ["--card", "literal", "rgba(255, 0, 0, 1)"],
    ],
    [
      "a part below it",
      chip("flex [--card:var(--muted)]", { parts: [dot("bg-card")] }),
      "[--card:var(--muted)]",
      token("muted"),
      ["--card", "bound", "Fuse tokens / muted"],
    ],
  ])("paints where %s reads the variable", async (_case, definition, override, fill, note) => {
    const { variant, coverage } = await buildFixture(definition, { variables: SYNCED });
    expect((frameOf(variant?.root) ?? variant?.root)?.fill).toEqual(fill);
    expect(notesOf(coverage, override)).toEqual([note]);
  });

  // The parent computes its `color` and its `--card` from the synced `muted`, and the part inherits
  // both computed values, so the part's own `--muted` reaches neither its text nor its background.
  it("leaves what a part inherits as its parent computed it, though the part sets the variable", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex font-sans text-[14px]/[20px] text-muted [--card:var(--muted)]", {
        parts: [{ ...dot("[--muted:#ff0000] bg-(--card)"), label: TEXT }],
      }),
      { variables: SYNCED }
    );
    expect(paintOf(frameOf(variant?.root))).toEqual({ fill: token("muted"), text: token("muted") });
    expect(notesOf(coverage, "[--muted:#ff0000]")).toEqual([
      ["--muted", "dropped", "the box overrides the synced `muted`, which no layer at or below it reads"],
    ]);
  });

  // The root's `text-card` computes on the root, so the part inherits the synced `card`, and the
  // part's own `--card` paints nothing.
  it("paints a part's inherited text in the root's variable, though the part sets it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex font-sans text-[14px]/[20px] text-card", {
        parts: [{ ...dot("[--card:#ff0000]"), label: TEXT }],
      }),
      { variables: SYNCED }
    );
    expect(paintOf(frameOf(variant?.root)).text).toEqual(token("card"));
    expect(notesOf(coverage, "[--card:#ff0000]")).toEqual([
      ["--card", "dropped", "the box overrides the synced `card`, which no layer at or below it reads"],
    ]);
  });

  // The root reads the synced `card` for its own background, which the part's `--card` cannot reach,
  // so the part's value paints nowhere, whatever the root reads.
  it("drops a part's value that no layer at or below it reads, beside a root that reads the variable", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex bg-card", { parts: [dot("[--card:#ff0000]")] }),
      {
        variables: SYNCED,
      }
    );
    expect(variant?.root.fill).toEqual(token("card"));
    expect(notesOf(coverage, "[--card:#ff0000]")).toEqual([
      ["--card", "dropped", "the box overrides the synced `card`, which no layer at or below it reads"],
    ]);
  });

  // Where no layer reads a value that names `var(--card)`, the browser paints the override nowhere,
  // as an Alert's `--ring` reaches only the focus ring a set without focus leaves out.
  it("drops where no layer of the cell reads the variable", async () => {
    const definition = chip("bg-[#000000] [--card:#ff0000] focus-visible:bg-card", {
      omittedStates: new Set(["focus-visible"]),
    });
    const { coverage } = await buildFixture(definition, { variables: SYNCED });
    expect(notesOf(coverage, "[--card:#ff0000]")).toEqual([
      ["--card", "dropped", "the box overrides the synced `card`, which no layer at or below it reads"],
    ]);
  });

  // The page computes its `color` on itself, so the root inherits the synced `foreground` whether or
  // not the host sets anything more, and the root's own `--foreground` reaches none of it.
  const overriding = chip("font-sans text-[14px]/[20px] [--foreground:#ff0000]", { label: TEXT });
  it.each([
    ["no host declaration", overriding],
    [
      "a host declaration",
      { ...overriding, inheritedFor: () => [{ className: "html", property: "font-size", value: "16px" }] },
    ],
  ])(
    "keeps the page's text color under a root that sets the variable, with %s",
    async (_case, definition) => {
      const { variant, coverage } = await buildFixture(definition, {
        variables: SYNCED,
        page: [{ className: "body text-foreground", property: "color", value: "var(--foreground)" }],
      });
      expect(paintOf(variant?.root).text).toEqual(token("foreground"));
      expect(notesOf(coverage, "[--foreground:#ff0000]")).toEqual([
        [
          "--foreground",
          "dropped",
          "the box overrides the synced `foreground`, which no layer at or below it reads",
        ],
      ]);
    }
  );

  // Oracle: CSS Custom Properties 1 §3. A `var()` with no value and no fallback makes the custom
  // property guaranteed-invalid, which a child inherits, so the child's `bg-card` is invalid at
  // computed-value time and paints no background, which the build cannot write as a binding.
  it("leaves a part's read of an invalid value unmapped, and reads the value that made it so", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex [--card:var(--missing)]", { parts: [dot("bg-card")] }),
      { variables: SYNCED }
    );
    expect(frameOf(variant?.root)?.fill).toBeUndefined();
    expect([notesOf(coverage, "bg-card"), notesOf(coverage, "[--card:var(--missing)]")]).toEqual([
      [["background-color", "unmapped", "no Figma field reads var(--card)"]],
      [["--card", "unmapped", "no Figma field reads var(--card)"]],
    ]);
  });
});
