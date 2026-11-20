/**
 * The in-memory file's per-character fills, rule 65 in `fake/text.ts`. The text planner reads a
 * label's runs from `getStyledTextSegments(['fills'])` and its color from `fills`, so the fake must
 * read the fills a character paints with the same way in each. Unit under test: the fake in
 * `fake-figma.ts`. Oracles: the typings, under which a text's `fills` is `figma.mixed` only where its
 * characters' fills differ, and the 2026-11-19 live probe, where `getStyledTextSegments(['fills'])`
 * returned one run for each stretch of characters with one fill, and the 2026-11-20 live probe on
 * `ab;\ncd` (NL1–NL4), where a line break painted in the fill of the character before it.
 */
import { describe, expect, it } from "vitest";

import { fixtureFile } from "./fake-fixtures.ts";

const RED: Paint[] = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
const BLUE: Paint[] = [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }];

/** A text of the given characters in the given fills, its font loaded. */
async function textOf(characters: string, fills: Paint[]) {
  const { figma } = fixtureFile([]);
  await figma.loadFontAsync({ family: "Roboto", style: "Regular" });
  const text = figma.createText();
  text.fontName = { family: "Roboto", style: "Regular" };
  text.characters = characters;
  text.fills = fills;
  return { figma, text };
}

/** A two-character text in red, its font loaded. */
const redText = () => textOf("ab", RED);

/** Each run's characters and the red and blue of its first fill. */
function runs(text: TextNode): readonly (readonly [string, number, number])[] {
  return text.getStyledTextSegments(["fills"]).map(({ characters, fills: [paint] }) => {
    const shown = paint?.type === "SOLID" ? paint.color : undefined;
    return [characters, shown?.r ?? -1, shown?.b ?? -1];
  });
}

/** The red and blue of a fills read's first paint, or `mixed` where the read is the file's `figma.mixed`. */
function hue(
  figma: PluginAPI,
  fills: ReadonlyArray<Paint> | PluginAPI["mixed"]
): readonly [number, number] | "mixed" {
  if (fills === figma.mixed) {
    return "mixed";
  }
  const [paint] = fills;
  return paint?.type === "SOLID" ? [paint.color.r, paint.color.b] : [-1, -1];
}

describe("the fake's per-character fills", () => {
  it("read as one fill wherever range writes gave every character the same one", async () => {
    const { figma, text } = await redText();
    text.setRangeFills(0, 1, BLUE);
    text.setRangeFills(1, 2, BLUE);
    expect([hue(figma, text.fills), hue(figma, text.getRangeFills(0, 2)), runs(text)]).toEqual([
      [0, 1],
      [0, 1],
      [["ab", 0, 1]],
    ]);
  });

  it("read as one fill where a range write gave a character the layer's own", async () => {
    const { figma, text } = await redText();
    text.setRangeFills(0, 1, RED);
    expect([hue(figma, text.fills), hue(figma, text.getRangeFills(0, 2)), runs(text)]).toEqual([
      [1, 0],
      [1, 0],
      [["ab", 1, 0]],
    ]);
  });

  it("paint a line break in the fill of the character before it, whatever fill it was given", async () => {
    const colored = await textOf("ab;\ncd", BLUE);
    colored.text.setRangeFills(2, 3, RED);
    const coloredRuns = runs(colored.text);
    colored.text.setRangeFills(3, 4, BLUE);
    const breakOnly = await textOf("ab;\ncd", BLUE);
    breakOnly.text.setRangeFills(3, 4, RED);
    expect([coloredRuns, runs(colored.text), hue(breakOnly.figma, breakOnly.text.fills)]).toEqual([
      [
        ["ab", 0, 1],
        [";\n", 1, 0],
        ["cd", 0, 1],
      ],
      [
        ["ab", 0, 1],
        [";\n", 1, 0],
        ["cd", 0, 1],
      ],
      [0, 1],
    ]);
  });
});
