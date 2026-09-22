import { Result } from "effect";
import { describe, expect, it } from "vitest";

import {
  fuseVariableSet,
  PRIMITIVES_COLLECTION,
  THEMES_COLLECTION,
  TOKENS_COLLECTION,
} from "./fuse-variable-set.ts";
import type { CollectionSpec, VariableSet, VariableValue } from "./variable-set.ts";

function variableSet(): VariableSet {
  const result = fuseVariableSet();
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

function collection(name: string): CollectionSpec {
  const found = variableSet().collections.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`no collection ${name}`);
  return found;
}

function value(collectionName: string, variable: string, mode: string): VariableValue | undefined {
  return collection(collectionName)
    .variables.find((candidate) => candidate.name === variable)
    ?.values.get(mode);
}

describe("fuseVariableSet", () => {
  it("builds a set that meets every variable set rule", () => {
    const result = fuseVariableSet();
    expect(Result.isFailure(result) && result.failure.message).toBe(false);
  });

  it("names Figma variables without the characters the API rejects", () => {
    for (const spec of variableSet().collections) {
      for (const variable of spec.variables) expect(variable.name).not.toMatch(/[.{}]/);
      for (const mode of spec.modes) expect(mode.length).toBeLessThanOrEqual(40);
    }
  });

  it("translates CSS values into Figma values", () => {
    // `#5c6773` in DEFAULTS is a hex literal, not oklch.
    expect(value(THEMES_COLLECTION, "light/sh-identifier", "internal-fkas-private")).toEqual({
      _tag: "Color",
      color: { r: 0x5c / 255, g: 0x67 / 255, b: 0x73 / 255, a: 1 },
    });
    expect(value(THEMES_COLLECTION, "light/radius-button", "external-fkas-private")).toEqual({
      _tag: "Float",
      value: 29,
    });
    expect(value(THEMES_COLLECTION, "light/font-heading", "external-fkas-private")).toEqual({
      _tag: "String",
      value: "Neo Sans",
    });
    expect(value(THEMES_COLLECTION, "light/font-sans", "internal-elma-company")).toEqual({
      _tag: "String",
      value: "Roboto",
    });
    const mutedForeground = value(THEMES_COLLECTION, "light/muted-foreground", "external-fkas-private");
    expect(mutedForeground?._tag === "Color" && mutedForeground.color.a).toBe(0.7);
  });

  it("turns var() references into aliases in the same scheme or to primitives", () => {
    expect(value(THEMES_COLLECTION, "dark/destructive", "external-guen-private")).toEqual({
      _tag: "Alias",
      target: { collection: THEMES_COLLECTION, variable: "dark/error" },
    });
    expect(value(THEMES_COLLECTION, "light/brand", "external-fkab-company")).toEqual({
      _tag: "Alias",
      target: { collection: PRIMITIVES_COLLECTION, variable: "brand-fkab" },
    });
    // fkab shares Fjordkraft's accent by policy.
    expect(value(PRIMITIVES_COLLECTION, "brand-fkab", "Value")).toEqual({
      _tag: "Alias",
      target: { collection: PRIMITIVES_COLLECTION, variable: "brand-fkas" },
    });
    expect(value(TOKENS_COLLECTION, "primary", "Dark")).toEqual({
      _tag: "Alias",
      target: { collection: THEMES_COLLECTION, variable: "dark/primary" },
    });
  });
});
