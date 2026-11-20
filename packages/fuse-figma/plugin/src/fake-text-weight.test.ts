/**
 * The in-memory file's `fontWeight` binding through a font write, rule 50 in `fake/text.ts`. The text
 * planner's weight tests go red on a run that skips binding the weight again after it writes the
 * label's font only while the fake drops the binding as Figma does. Unit under test: the fake in
 * `fake-figma.ts`. Oracle: the owner's reading of a live file through the Plugin API on 2026-11-18,
 * where a `fontName` write over a text whose `fontWeight` bound a FLOAT variable dropped the binding
 * (PG8).
 */
import { describe, expect, it } from "vitest";

import { fixtureFile, float } from "./fake-fixtures.ts";

describe("the fake's fontWeight binding", () => {
  it("drops on a fontName write after it", async () => {
    const { figma } = fixtureFile([float("Fuse tokens", "title-weight", 500)]);
    await figma.loadFontAsync({ family: "Roboto", style: "Regular" });
    await figma.loadFontAsync({ family: "Roboto", style: "Medium" });
    const text = figma.createText();
    text.fontName = { family: "Roboto", style: "Regular" };
    text.characters = "Search";
    const [weight] = await figma.variables.getLocalVariablesAsync("FLOAT");
    if (weight === undefined) {
      throw new Error("The fixture file holds no FLOAT variable.");
    }
    text.setBoundVariable("fontWeight", weight);
    const bound = text.getRangeBoundVariable(0, text.characters.length, "fontWeight");
    text.fontName = { family: "Roboto", style: "Medium" };
    expect([bound, text.getRangeBoundVariable(0, text.characters.length, "fontWeight")]).toEqual([
      { type: "VARIABLE_ALIAS", id: weight.id },
      null,
    ]);
  });
});
