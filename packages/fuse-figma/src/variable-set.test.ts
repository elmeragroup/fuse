import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { makeVariableSet } from "./variable-set.ts";
import type { CollectionSpec, VariableSpec, VariableValue } from "./variable-set.ts";

const RED: VariableValue = { _tag: "Color", color: { r: 1, g: 0, b: 0, a: 1 } };

function variable(
  name: string,
  type: VariableSpec["type"],
  values: Record<string, VariableValue>
): VariableSpec {
  return { name, type, scopes: [], webSyntax: undefined, values: new Map(Object.entries(values)) };
}

function palette(variables: readonly VariableSpec[]): CollectionSpec {
  return { name: "Palette", modes: ["Light", "Dark"], variables };
}

const toRed: VariableValue = { _tag: "Alias", target: { collection: "Palette", variable: "red" } };

function failure(collections: readonly CollectionSpec[]): string | undefined {
  const result = makeVariableSet(collections);
  return Result.isFailure(result) ? result.failure.message : undefined;
}

/** The cycle `makeVariableSet` reports, or `undefined` when it reports none. */
function cycle(collections: readonly CollectionSpec[]): readonly string[] | undefined {
  const result = makeVariableSet(collections);
  return Result.isFailure(result) && result.failure._tag === "AliasCycle" ? result.failure.cycle : undefined;
}

describe("makeVariableSet", () => {
  it("accepts values that cover every mode and alias a variable of the same type, and refuses the rest", () => {
    const red = variable("red", "COLOR", { Light: RED, Dark: RED });
    const danger = variable("danger", "COLOR", { Light: toRed, Dark: toRed });
    expect(failure([palette([red, danger])])).toBeUndefined();

    // A value for every mode of its collection, and none for a mode it does not have.
    expect(failure([palette([variable("red", "COLOR", { Light: RED })])])).toBe(
      'The Figma variable set is invalid: "Palette/red" has no value for mode "Dark".'
    );
    expect(failure([palette([variable("red", "COLOR", { Light: RED, Dark: RED, Sepia: RED })])])).toBe(
      'The Figma variable set is invalid: "Palette/red" has a value for a mode its collection does not have.'
    );

    // An alias to a missing variable or one of another type.
    expect(failure([palette([danger])])).toBe(
      'The Figma variable set is invalid: "Palette/danger" aliases "Palette/red", which the set does not define.'
    );
    const radius = variable("radius", "FLOAT", { Light: toRed, Dark: toRed });
    expect(failure([palette([red, radius])])).toBe(
      'The Figma variable set is invalid: "Palette/radius" is a FLOAT variable but aliases the COLOR variable "Palette/red".'
    );

    // A literal of another type.
    const mistyped = variable("radius", "COLOR", { Light: RED, Dark: { _tag: "Float", value: 6 } });
    expect(failure([palette([mistyped])])).toBe(
      'The Figma variable set is invalid: "Palette/radius" is a COLOR variable but holds a FLOAT value in mode "Dark".'
    );
  });

  // The scope rules come from https://developers.figma.com/docs/rest-api/variables-types/.
  it("refuses a scope that does not fit the variable's type, ALL_SCOPES beside another, and ALL_FILLS beside a fill scope", () => {
    const six: VariableValue = { _tag: "Float", value: 6 };
    const text: VariableValue = { _tag: "String", value: "Roboto" };
    const scoped = (type: VariableSpec["type"], scopes: VariableSpec["scopes"], value: VariableValue) => ({
      ...variable("probe", type, { Light: value, Dark: value }),
      scopes,
    });
    const refusal = (reason: string) => `The Figma variable set is invalid: "Palette/probe" ${reason}.`;
    const rows: readonly [VariableSpec["type"], VariableSpec["scopes"], VariableValue, string | undefined][] =
      [
        ["FLOAT", ["WIDTH_HEIGHT", "GAP"], six, undefined],
        ["COLOR", ["GAP"], RED, refusal("is a COLOR variable but has the scope GAP")],
        ["FLOAT", ["ALL_SCOPES", "CORNER_RADIUS"], six, refusal("combines ALL_SCOPES with other scopes")],
        // FONT_VARIATIONS applies to STRING variables only, and TEXT_CONTENT to FLOAT and STRING.
        ["STRING", ["FONT_STYLE", "FONT_VARIATIONS"], text, undefined],
        ["STRING", ["TEXT_CONTENT"], text, undefined],
        ["FLOAT", ["TEXT_CONTENT"], six, undefined],
        ["FLOAT", ["FONT_VARIATIONS"], six, refusal("is a FLOAT variable but has the scope FONT_VARIATIONS")],
        // ALL_FILLS may sit beside a stroke or effect scope, but not beside another fill scope.
        ["COLOR", ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"], RED, undefined],
        ["COLOR", ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"], RED, undefined],
        ["COLOR", ["ALL_FILLS", "FRAME_FILL"], RED, refusal("combines ALL_FILLS with other fill scopes")],
        ["COLOR", ["TEXT_FILL", "ALL_FILLS"], RED, refusal("combines ALL_FILLS with other fill scopes")],
      ];
    for (const [type, scopes, value, expected] of rows) {
      expect(failure([palette([scoped(type, scopes, value)])]), `${type} ${scopes.join(" ")}`).toBe(expected);
    }
  });

  it("refuses duplicate names, a collection without modes, and more modes or longer mode names than Figma allows", () => {
    expect(failure([palette([]), palette([])])).toBe(
      'The Figma variable set is invalid: "Palette" appears twice.'
    );
    expect(failure([{ name: "Empty", modes: [], variables: [] }])).toBe(
      'The Figma variable set is invalid: "Empty" has no modes.'
    );

    const modes = (count: number) => Array.from({ length: count }, (_, index) => `theme-${index}`);
    expect(failure([{ name: "Themes", modes: modes(40), variables: [] }])).toBeUndefined();
    expect(failure([{ name: "Themes", modes: modes(41), variables: [] }])).toBe(
      'The Figma variable set is invalid: "Themes" has 41 modes, more than the 40 Figma allows.'
    );

    const fortyOne = "x".repeat(41);
    expect(failure([{ name: "Themes", modes: ["x".repeat(40)], variables: [] }])).toBeUndefined();
    expect(failure([{ name: "Themes", modes: [fortyOne], variables: [] }])).toBe(
      `The Figma variable set is invalid: "Themes" names the mode "${fortyOne}", longer than the 40 characters Figma allows.`
    );
  });

  it("refuses aliases that lead back to where they started, in any mode", () => {
    const alias = (collection: string, name: string): VariableValue => ({
      _tag: "Alias",
      target: { collection, variable: name },
    });

    const itself = variable("red", "COLOR", { Light: toRed, Dark: RED });
    expect(cycle([palette([itself])])).toEqual(["Palette/red", "Palette/red"]);

    // Each alias closes the loop in a different mode, which still counts as a cycle.
    const warm = variable("warm", "COLOR", { Light: alias("Palette", "cool"), Dark: RED });
    const cool = variable("cool", "COLOR", { Light: RED, Dark: alias("Palette", "warm") });
    const pair = [palette([warm, cool])];
    expect(cycle(pair)).toEqual(["Palette/warm", "Palette/cool", "Palette/warm"]);
    expect(failure(pair)).toBe(
      'The Figma variable set is invalid: "Palette/warm" aliases "Palette/cool", which aliases "Palette/warm". Aliases must not form a cycle.'
    );

    const tokens: CollectionSpec = {
      name: "Tokens",
      modes: ["Value"],
      variables: [variable("accent", "COLOR", { Value: alias("Palette", "brand") })],
    };
    const brand = variable("brand", "COLOR", { Light: RED, Dark: alias("Tokens", "accent") });
    expect(cycle([tokens, palette([brand])])).toEqual(["Tokens/accent", "Palette/brand", "Tokens/accent"]);

    // A chain that ends at a literal is fine, however long.
    const chain = [
      variable("red", "COLOR", { Light: RED, Dark: RED }),
      variable("danger", "COLOR", { Light: toRed, Dark: toRed }),
    ];
    expect(cycle([palette(chain)])).toBeUndefined();
  });
});
