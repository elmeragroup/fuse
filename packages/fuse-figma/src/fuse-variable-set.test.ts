import { Result } from "effect";
import { describe, expect, it } from "vitest";

import {
  DENSITY_COLLECTION,
  fuseVariableSet,
  PRIMITIVES_COLLECTION,
  THEMES_COLLECTION,
  TOKENS_COLLECTION,
} from "./fuse-variable-set.ts";
import type { CollectionSpec, VariableSet, VariableSpec, VariableValue } from "./variable-set.ts";

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

function spec(collectionName: string, variable: string): VariableSpec | undefined {
  return collection(collectionName).variables.find((candidate) => candidate.name === variable);
}

function value(collectionName: string, variable: string, mode: string): VariableValue | undefined {
  return spec(collectionName, variable)?.values.get(mode);
}

const px = (value: number): VariableValue => ({ _tag: "Float", value });

describe("fuseVariableSet", () => {
  it("builds a set that meets every variable set rule", () => {
    const result = fuseVariableSet();
    expect(result._tag, Result.isFailure(result) ? result.failure.message : undefined).toBe("Success");
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

  it("gives each density its own mode with the control metrics in pixels", () => {
    expect(collection(DENSITY_COLLECTION).modes).toEqual(["Dense", "Comfortable"]);
    expect(collection(DENSITY_COLLECTION).variables).toHaveLength(18);
    // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable.
    expect(value(DENSITY_COLLECTION, "control-h-md", "Dense")).toEqual(px(36));
    expect(value(DENSITY_COLLECTION, "control-h-md", "Comfortable")).toEqual(px(44));
    expect(value(DENSITY_COLLECTION, "control-px-icon-xs", "Dense")).toEqual(px(6));
    expect(value(DENSITY_COLLECTION, "control-px-icon-xs", "Comfortable")).toEqual(px(10));
    expect(value(DENSITY_COLLECTION, "control-leading", "Comfortable")).toEqual(px(24));
    expect(spec(DENSITY_COLLECTION, "control-h-md")).toMatchObject({
      type: "FLOAT",
      scopes: ["WIDTH_HEIGHT"],
      webSyntax: "var(--control-h-md)",
    });
    expect(spec(DENSITY_COLLECTION, "control-px-md")?.scopes).toEqual(["GAP"]);
    expect(spec(DENSITY_COLLECTION, "control-gap-md")?.scopes).toEqual(["GAP"]);
    expect(spec(DENSITY_COLLECTION, "control-text")?.scopes).toEqual(["FONT_SIZE"]);
    expect(spec(DENSITY_COLLECTION, "control-leading")?.scopes).toEqual(["LINE_HEIGHT"]);
  });

  it("computes the radius steps per theme and clamps them at zero", () => {
    // external-fkas-private sets --radius: 0.75rem, 12px.
    expect(value(THEMES_COLLECTION, "light/radius-md", "external-fkas-private")).toEqual(px(10));
    expect(value(THEMES_COLLECTION, "dark/radius-xl", "external-fkas-private")).toEqual(px(16));
    // Internal themes keep the default 0.375rem, 6px; CSS clamps 6px - 8px to 0.
    expect(value(THEMES_COLLECTION, "light/radius-md", "internal-elma-private")).toEqual(px(4));
    expect(value(THEMES_COLLECTION, "light/radius-popover", "internal-elma-private")).toEqual(px(0));
    expect(spec(THEMES_COLLECTION, "light/radius-md")).toMatchObject({ scopes: [], webSyntax: undefined });

    expect(spec(TOKENS_COLLECTION, "radius-popover")).toMatchObject({
      type: "FLOAT",
      scopes: ["CORNER_RADIUS"],
      webSyntax: "var(--radius-popover)",
    });
    expect(value(TOKENS_COLLECTION, "radius-md", "Light")).toEqual({
      _tag: "Alias",
      target: { collection: THEMES_COLLECTION, variable: "light/radius-md" },
    });
  });
});
