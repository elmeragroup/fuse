/**
 * How the build maps a label's percentage line height, as `readType` reads it from hand-built captures
 * (`test/capture-fixtures.ts`): the variable a synced font size binds, the declarations the coverage
 * table credits, and a line height that stays unmapped. Oracle: CSS Inline 3, `line-height`, where a
 * percentage computes to a length against the font size of the element that declares it and a child
 * inherits that length. `line-height.chromium.test.ts` checks the lengths in pixels against Chromium's
 * computed `line-height`. A synced font size has no length to take the percentage, so only a box whose
 * font size binds the declaring element's variable draws Figma's percent of its own font size.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, notesOf, part, rest, textOf } from "../../test/capture-fixtures";
import type { FixtureOptions } from "../../test/capture-fixtures";
import type { LabelManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

/** A label that a `Label` text property sets, starting as `Label`. */
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  shownIn: () => true,
};

/** The text classes a label needs besides its size and line height. */
const TEXT_STYLE = "font-sans text-[#000000]";

/** A build whose `font-sans` binds the synced family, and whose `--label-size` never falls below 12px. */
const LABEL_SIZE: FixtureOptions = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
    { ref: { collection: "Fuse tokens", name: "label-size" }, webSyntax: "var(--label-size)", minimum: 12 },
  ]),
};

/** What the coverage table says a line height of a synced font size's percent became. */
const PERCENT_150 = ["line-height", "literal", "lines 150% of the font size apart"];

/** Build a chip whose root sets `classes` and holds the label itself. */
function buildOwn(classes: string) {
  return buildCaptured(
    chip({ label: LABEL }),
    rest({ slot: "chip", classes: `${TEXT_STYLE} ${classes}`, text: "Label" }),
    LABEL_SIZE
  );
}

/** Build a chip whose root sets `classes` and holds a part that sets `own` and holds the label. */
function buildBelow(classes: string, own = "") {
  return buildCaptured(
    chip({ parts: [part({ label: LABEL })] }),
    rest({
      slot: "chip",
      classes: `${TEXT_STYLE} ${classes}`,
      children: [{ slot: "chip-dot", text: "Label", classes: own }],
    }),
    LABEL_SIZE
  );
}

describe("a label's percentage line height", () => {
  it("credits the line height of 150% of the label's own 16px", async () => {
    const { coverage } = await buildOwn("text-[16px] leading-[150%]");
    expect(notesOf(coverage, "leading-[150%]")).toContainEqual(["line-height", "literal", "24px"]);
  });

  it("credits the 20px parent's font size for the 150% a 16px part inherits", async () => {
    const { coverage } = await buildBelow("text-[20px] leading-[150%]", "text-[16px]");
    expect(notesOf(coverage, "text-[20px]")).toEqual([["font-size", "literal", "30px"]]);
  });

  it("draws 150% of a synced font size the label sets as Figma's percent of it", async () => {
    const { variant } = await buildOwn("[font-size:var(--label-size)] leading-[150%]");
    expect(textOf(variant?.root)?.lineHeight).toEqual({ kind: "percent", value: 150 });
  });

  it("draws a part that inherits 150% at the parent's synced font size as Figma's percent of it", async () => {
    const { variant } = await buildBelow("[font-size:var(--label-size)] leading-[150%]");
    expect(textOf(variant?.root)?.lineHeight).toEqual({ kind: "percent", value: 150 });
  });

  it("draws a negative percentage of a synced font size as 0% of it", async () => {
    const { variant } = await buildBelow("[font-size:var(--label-size)] leading-[calc(-50%)]");
    expect(textOf(variant?.root)?.lineHeight).toEqual({ kind: "percent", value: 0 });
  });

  // The part's `var()` substitutes a bare negative percentage, which is invalid, so it inherits 30px.
  it("credits the parent's size and line height for the 30px a part's invalid line height inherits", async () => {
    const { coverage } = await buildBelow(
      "text-[20px] leading-[150%]",
      "text-[16px] [--v:-50%] leading-[var(--v)]"
    );
    expect({
      size: notesOf(coverage, "text-[20px]"),
      line: notesOf(coverage, "leading-[150%]").filter(([property]) => property === "line-height"),
    }).toEqual({
      size: [["font-size", "literal", "30px"]],
      line: [["line-height", "literal", "30px"]],
    });
  });

  // The part takes the parent's 1.5 at its own 16px, and the parent's 24px as it is.
  it.each([
    ["text-[20px] leading-[1.5]", "leading-[1.5]", "24px"],
    ["text-[16px] leading-[24px]", "leading-[24px]", "24px"],
  ])(
    "credits the parent's line height below '%s' that a part's invalid line height inherits",
    async (parent, declaration, line) => {
      const { coverage } = await buildBelow(parent, "text-[16px] [--v:-50%] leading-[var(--v)]");
      expect(notesOf(coverage, declaration).filter(([property]) => property === "line-height")).toEqual([
        ["line-height", "literal", line],
      ]);
    }
  );

  // `--label-size` never falls below 12px, so the part's floored size binds the parent's variable.
  it("draws a part whose floored size binds the parent's synced size at the parent's percent", async () => {
    const { variant } = await buildBelow(
      "[font-size:var(--label-size)] leading-[150%]",
      "[font-size:max(12px,var(--label-size))]"
    );
    expect(textOf(variant?.root)?.lineHeight).toEqual({ kind: "percent", value: 150 });
  });

  it("binds the parent's font size for the percentage a part inherits at the same synced size", async () => {
    const { coverage } = await buildBelow(
      "text-(length:--label-size) leading-[150%]",
      "[font-size:var(--label-size)]"
    );
    expect({
      size: notesOf(coverage, "text-(length:--label-size)"),
      line: notesOf(coverage, "leading-[150%]").filter(([property]) => property === "line-height"),
    }).toEqual({
      size: [["font-size", "bound", "Fuse tokens / label-size"]],
      line: [PERCENT_150],
    });
  });

  // The fixture gives the label a family, a size and a color, so only the line height is missing.
  it("fails a label at 16px below 150% of a parent's synced font size for want of a line height", async () => {
    const built = buildBelow("[font-size:var(--label-size)] leading-[150%]", "text-[16px]");
    await expect(built).rejects.toThrow("the label needs a font family, size, line height and color");
  });
});
