import { Result } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

  it("computes the radius rungs per theme", () => {
    // external-fkas-private sets --radius: 0.75rem, 12px, and external themes step 2px.
    expect(value(THEMES_COLLECTION, "light/radius-md", "external-fkas-private")).toEqual(px(10));
    expect(value(THEMES_COLLECTION, "dark/radius-xl", "external-fkas-private")).toEqual(px(16));
    // Internal themes keep the default 0.375rem, 6px, and step 0px, so every rung is 6px.
    expect(value(THEMES_COLLECTION, "light/radius-md", "internal-elma-private")).toEqual(px(6));
    expect(value(THEMES_COLLECTION, "light/radius-xs", "internal-elma-private")).toEqual(px(6));
    expect(value(THEMES_COLLECTION, "light/radius-xl", "internal-elma-private")).toEqual(px(6));
    // external-tkas-private sets 0.95rem, 15.2px, so radius-xs is 15.2 - 3 * 2.
    const tkasXs = value(THEMES_COLLECTION, "light/radius-xs", "external-tkas-private");
    expect(tkasXs?._tag === "Float" && tkasXs.value).toBeCloseTo(9.2, 9);
    expect(spec(THEMES_COLLECTION, "light/radius-md")).toMatchObject({ scopes: [], webSyntax: undefined });
    expect(value(TOKENS_COLLECTION, "radius-md", "Light")).toEqual({
      _tag: "Alias",
      target: { collection: THEMES_COLLECTION, variable: "light/radius-md" },
    });
  });

  it("gives each radius rung the calc() fuse.css declares as its code syntax", () => {
    const webSyntax = (rung: string) => spec(TOKENS_COLLECTION, rung)?.webSyntax;
    expect(spec(TOKENS_COLLECTION, "radius-sm")).toMatchObject({ type: "FLOAT", scopes: ["CORNER_RADIUS"] });
    expect(webSyntax("radius-xs")).toBe("calc(var(--radius) - 3 * var(--radius-step))");
    expect(webSyntax("radius-sm")).toBe("calc(var(--radius) - 2 * var(--radius-step))");
    expect(webSyntax("radius-md")).toBe("calc(var(--radius) - var(--radius-step))");
    expect(webSyntax("radius-lg")).toBe("var(--radius)");
    expect(webSyntax("radius-xl")).toBe("calc(var(--radius) + 2 * var(--radius-step))");
  });

  it("leaves out radius-popover, which no component uses", () => {
    expect(spec(TOKENS_COLLECTION, "radius-popover")).toBeUndefined();
    expect(spec(THEMES_COLLECTION, "light/radius-popover")).toBeUndefined();
    expect(spec(THEMES_COLLECTION, "dark/radius-popover")).toBeUndefined();
  });
});

// The package's `test` task depends on `@elmeragroup/fuse#build` in turbo.json, so the built
// stylesheets exist in CI. A missing file fails the test instead of skipping it.
const FUSE_DIST = fileURLToPath(new URL("../node_modules/@elmeragroup/fuse/dist/", import.meta.url));
const SHIPPED_STYLESHEETS = ["styles.css", "themes.css"].map((file) => `${FUSE_DIST}${file}`);

/** The custom properties a stylesheet declares, without their leading dashes. */
function declaredProperties(css: string): ReadonlySet<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set(Array.from(withoutComments.matchAll(/--([\w-]+)\s*:/g), (match) => match[1] ?? ""));
}

/** The custom properties a CSS value reads through `var()`, without their leading dashes. */
function referencedProperties(css: string): readonly string[] {
  return Array.from(css.matchAll(/var\(\s*--([\w-]+)/g), (match) => match[1] ?? "");
}

describe("web code syntax", () => {
  // In this cross-check, the unit under test is the code syntax fuseVariableSet gives each
  // variable, and the oracle is the built styles.css and themes.css. A developer pastes the
  // syntax into code that loads those sheets, so every var() in it must name a property they
  // declare.
  it("reads only custom properties that the shipped stylesheets declare", () => {
    for (const path of SHIPPED_STYLESHEETS) {
      expect(existsSync(path), `${path} is missing. Build @elmeragroup/fuse first.`).toBe(true);
    }
    const declared = declaredProperties(
      SHIPPED_STYLESHEETS.map((path) => readFileSync(path, "utf8")).join("\n")
    );
    const references = variableSet().collections.flatMap((spec) =>
      spec.variables.flatMap((variable) =>
        referencedProperties(variable.webSyntax ?? "").map((name) => ({
          variable: `${spec.name}/${variable.name}`,
          name,
        }))
      )
    );

    expect(references.map((reference) => reference.name)).toEqual(
      expect.arrayContaining(["primary", "brand-fkas", "radius", "radius-step", "control-h-md"])
    );
    expect(references.filter((reference) => !declared.has(reference.name))).toEqual([]);
  });
});
