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

describe("makeVariableSet", () => {
  it("accepts collections whose values cover every mode and alias a variable of the same type", () => {
    const red = variable("red", "COLOR", { Light: RED, Dark: RED });
    const danger = variable("danger", "COLOR", { Light: toRed, Dark: toRed });
    expect(failure([palette([red, danger])])).toBeUndefined();
  });

  it("refuses a variable without a value for every mode of its collection", () => {
    expect(failure([palette([variable("red", "COLOR", { Light: RED })])])).toBe(
      'The Figma variable set is invalid: "Palette/red" has no value for mode "Dark".'
    );
    expect(failure([palette([variable("red", "COLOR", { Light: RED, Dark: RED, Sepia: RED })])])).toBe(
      'The Figma variable set is invalid: "Palette/red" has a value for a mode its collection does not have.'
    );
  });

  it("refuses an alias to a missing variable or one of another type", () => {
    const danger = variable("danger", "COLOR", { Light: toRed, Dark: toRed });
    expect(failure([palette([danger])])).toBe(
      'The Figma variable set is invalid: "Palette/danger" aliases "Palette/red", which the set does not define.'
    );

    const red = variable("red", "COLOR", { Light: RED, Dark: RED });
    const radius = variable("radius", "FLOAT", { Light: toRed, Dark: toRed });
    expect(failure([palette([red, radius])])).toBe(
      'The Figma variable set is invalid: "Palette/radius" is a FLOAT variable but aliases the COLOR variable "Palette/red".'
    );
  });

  it("refuses a literal of another type", () => {
    const radius = variable("radius", "COLOR", { Light: RED, Dark: { _tag: "Float", value: 6 } });
    expect(failure([palette([radius])])).toBe(
      'The Figma variable set is invalid: "Palette/radius" is a COLOR variable but holds a FLOAT value in mode "Dark".'
    );
  });

  it("refuses duplicate names and a collection without modes", () => {
    expect(failure([palette([]), palette([])])).toBe(
      'The Figma variable set is invalid: "Palette" appears twice.'
    );
    expect(failure([{ name: "Empty", modes: [], variables: [] }])).toBe(
      'The Figma variable set is invalid: "Empty" has no modes.'
    );
  });
});
