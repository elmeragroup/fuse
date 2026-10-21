import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { variantKey } from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { forcedPseudoClasses, parseCell, restingTwin } from "./cells";

/** A set the tests declare, so the parser's refusals do not depend on any recipe. */
const CHIP = {
  key: "chip",
  axes: [
    { name: "tone", values: ["plain", "loud"] },
    { name: "state", values: ["rest", "hover"] },
  ],
};

describe("parseCell", () => {
  it("reads a cell of the set the key names", () => {
    const parsed = Result.getOrThrow(parseCell("chip/tone=loud,state=hover", [CHIP]));
    expect(parsed.definition).toBe(CHIP);
    expect(parsed.cell).toEqual({ tone: "loud", state: "hover" });
  });

  it.each([
    ["no component set", "tone=plain,state=rest", "the key has no component set before a slash"],
    [
      "a set the harness does not render",
      "badge/tone=plain,state=rest",
      "the harness renders no component set badge",
    ],
    ["a missing axis", "chip/tone=plain", "the key has no state"],
    ["an extra axis", "chip/tone=plain,state=rest,size=sm", "the harness cannot render the axis size"],
    ["a value outside its axis", "chip/tone=quiet,state=rest", "the harness cannot render tone=quiet"],
    ["a property named twice", "chip/tone=plain,tone=loud,state=rest", "the key names tone twice"],
    ["a pair with no =", "chip/tone,state=rest", "the property tone is not a name=value pair"],
  ])("refuses %s", (_, key, reason) => {
    const result = parseCell(key, [CHIP]);
    expect(Result.isFailure(result) ? result.failure.message : undefined).toBe(`${key}: ${reason}`);
  });

  // Unit under test: parseCell, the reader. Oracle: variantKey, the writer that names every
  // variant the plugin builds, over each cell the kit's preview frames place.
  it("reads back every key the kit's preview frames write", () => {
    const definitions = KIT.map((entry) => entry.definition);
    for (const { definition, previewCells } of KIT) {
      for (const cell of previewCells) {
        const parsed = Result.getOrThrow(parseCell(variantKey(definition, cell), definitions));
        expect(parsed.definition).toBe(definition);
        expect(parsed.cell).toEqual(cell);
      }
    }
  });
});

describe("forcedPseudoClasses", () => {
  it("forces :hover for hover, and :focus with :focus-visible for focus", () => {
    expect(forcedPseudoClasses({ state: "hover" })).toEqual(["hover"]);
    expect(forcedPseudoClasses({ state: "focus" })).toEqual(["focus", "focus-visible"]);
  });

  it("forces nothing for a state the markup draws, or a cell with no state", () => {
    expect(forcedPseudoClasses({ state: "disabled" })).toEqual([]);
    expect(forcedPseudoClasses({ variant: "default" })).toEqual([]);
  });
});

describe("restingTwin", () => {
  it("keeps every axis but the state, which rests", () => {
    expect(restingTwin({ variant: "destructive", size: "sm", state: "focus", icon: "end" })).toEqual({
      variant: "destructive",
      size: "sm",
      state: "rest",
      icon: "end",
    });
  });
});
