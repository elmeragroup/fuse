/**
 * Build rules Alert is the first set to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { density } from "../../test/built-kit";
import { buildFixture, chip, ICON } from "../../test/fixture-sets";
import type { LabelDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec, TextLayerSpec } from "./kit-spec";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

const LABEL: LabelDefinition = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  shownIn: () => true,
};

/** The first text layer a box holds. */
function textOf(box: BoxSpec | undefined): TextLayerSpec | undefined {
  const found = box?.children.find((child) => child.kind === "text");
  return found?.kind === "text" ? found : undefined;
}

// Oracle: CSS Inline 3 §4.4, where a unitless `line-height` is a factor of the element's own font
// size, so the line is that share of the size at every density; and Figma's percent line height,
// which a real file kept as written and drew at that share of a font size bound to `label-text` in
// each density mode on 2026-10-23 (PH). Tailwind compiles `/normal` to `--leading-normal`, 1.5, and
// `/snug` to `--leading-snug`, 1.375.
describe("a unitless line height over a font size a variable sets", () => {
  const variables = makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
    { ref: { collection: "Fuse density", name: "label-text" }, webSyntax: "var(--label-text)" },
  ]);

  it.each([
    ["text-(length:--label-text)/normal", 150],
    ["text-(length:--label-text)/snug", 137.5],
  ])("draws %s as a line %d% of the bound size", async (type, percent) => {
    const { variant, coverage } = await buildFixture(
      chip(`font-sans text-[#000000] ${type}`, { label: LABEL }),
      { variables }
    );
    const text = textOf(variant?.root);
    expect([text?.fontSize, text?.lineHeight]).toEqual([
      density("label-text"),
      { kind: "percent", value: percent },
    ]);
    expect(notesOf(coverage, type)).toContainEqual([
      "line-height",
      "literal",
      `lines ${percent}% of the font size apart`,
    ]);
  });
});

// Oracle: CSS Display 3 §2.7, where a flex item is blockified, so an `<svg>` in a flex box lays out
// as a block whether it says `block` or `inline-block`, and the box's auto layout places it.
describe("an icon that says `display: block`", () => {
  it("shows where its box's auto layout places it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex text-[#000000]", { iconsFor: () => [{ ...ICON, classes: "block size-[20px]" }] })
    );
    expect(variant?.root.children).toMatchObject([{ kind: "icon", size: { kind: "literal", value: 20 } }]);
    expect(notesOf(coverage, "block")).toEqual([
      ["display", "literal", "the icon shows where its box's auto layout places it"],
    ]);
  });
});
