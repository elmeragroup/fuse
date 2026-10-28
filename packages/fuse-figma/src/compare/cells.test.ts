import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { variantKey } from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import {
  fallbackInteraction,
  forcedPseudoClasses,
  highlightAttributes,
  parseCell,
  restingTwin,
} from "./cells";

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

  // A set that gained `width` after a file held it keeps its old keys for the first value (W5-P2), so
  // a key without the axis reads it at that value, and a key with it at the value it names.
  it("reads an axis the set added later at its first value where the key leaves it out", () => {
    const grown = {
      ...CHIP,
      addedAxes: new Set(["width"]),
      axes: [{ name: "width", values: ["hug", "fill"] }, ...CHIP.axes],
    };
    expect(
      ["chip/tone=loud,state=hover", "chip/width=fill,tone=loud,state=hover"].map(
        (key) => Result.getOrThrow(parseCell(key, [grown])).cell
      )
    ).toEqual([
      { width: "hug", tone: "loud", state: "hover" },
      { width: "fill", tone: "loud", state: "hover" },
    ]);
    expect(
      [
        { width: "hug", tone: "loud", state: "hover" },
        { width: "fill", tone: "loud", state: "hover" },
      ].map((cell) => variantKey(grown, cell))
    ).toEqual(["chip/tone=loud,state=hover", "chip/width=fill,tone=loud,state=hover"]);
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

  // Oracle: Base UI focuses a highlighted Select or Menu item, which Fuse styles with `focus:`, and
  // marks a highlighted Combobox or Command item `data-highlighted`, which Fuse styles with
  // `data-highlighted:` (`select.tsx`, `dropdown-menu-variants.ts`, `combobox.tsx`,
  // `command-variants.ts`).
  it("forces :focus alone for a row Base UI highlights by focus, and nothing for one it marks", () => {
    expect(forcedPseudoClasses({ state: "highlighted" }, "focus")).toEqual(["focus"]);
    expect(forcedPseudoClasses({ state: "highlighted" }, "data-highlighted")).toEqual([]);
    expect(forcedPseudoClasses({ state: "highlighted" })).toEqual([]);
    expect(forcedPseudoClasses({ state: "focus" }, "focus")).toEqual(["focus", "focus-visible"]);
  });
});

describe("highlightAttributes", () => {
  it("writes data-highlighted on a highlighted row Base UI marks, and nothing elsewhere", () => {
    expect(highlightAttributes({ state: "highlighted" }, "data-highlighted")).toEqual({
      "data-highlighted": "",
    });
    expect(highlightAttributes({ state: "highlighted" }, "focus")).toEqual({});
    expect(highlightAttributes({ state: "rest" }, "data-highlighted")).toEqual({});
    expect(highlightAttributes({ state: "hover" }, undefined)).toEqual({});
  });
});

// Oracle: a real pointer over the element draws its hover face and a real focus its focus face,
// and neither draws a highlighted row's face alone: a real focus on a menu item adds the keyboard
// focus ring a highlight does not show.
describe("fallbackInteraction", () => {
  it("hovers a hover cell and focuses a focus cell for real", () => {
    expect(fallbackInteraction({ state: "hover" })).toBe("hover");
    expect(fallbackInteraction({ state: "focus" })).toBe("focus");
  });

  it("tries nothing for a highlighted row or a state the markup draws", () => {
    expect(fallbackInteraction({ state: "highlighted" })).toBe("none");
    expect(fallbackInteraction({ state: "disabled" })).toBe("none");
    expect(fallbackInteraction({ variant: "default" })).toBe("none");
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
