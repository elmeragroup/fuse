import { Result } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
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
  it("writes each kind's resolved literal in its Figma form", () => {
    // `#5c6773` in DEFAULTS is a hex literal, not oklch.
    expect(value(THEMES_COLLECTION, "light/sh-identifier", "internal-fkas-private")).toEqual({
      _tag: "Color",
      color: { r: 0x5c / 255, g: 0x67 / 255, b: 0x73 / 255, a: 1 },
    });
    const mutedForeground = value(THEMES_COLLECTION, "light/muted-foreground", "external-fkas-private");
    expect(mutedForeground?._tag === "Color" && mutedForeground.color.a).toBe(0.7);
    expect(value(THEMES_COLLECTION, "light/radius-button", "external-fkas-private")).toEqual(px(29));
    expect(value(THEMES_COLLECTION, "light/font-heading", "external-fkas-private")).toEqual({
      _tag: "String",
      value: "Neo Sans",
    });
    expect(spec(TOKENS_COLLECTION, "primary")).toMatchObject({ type: "COLOR", scopes: ["ALL_SCOPES"] });
    expect(spec(TOKENS_COLLECTION, "radius")).toMatchObject({ type: "FLOAT", scopes: ["CORNER_RADIUS"] });
    expect(spec(TOKENS_COLLECTION, "radius-step")).toMatchObject({ type: "FLOAT", scopes: [] });
    expect(spec(TOKENS_COLLECTION, "button-outline-width")).toMatchObject({
      type: "FLOAT",
      scopes: ["STROKE_FLOAT"],
    });
    expect(value(THEMES_COLLECTION, "light/button-outline-width", "external-fkas-private")).toEqual(px(2));
    expect(value(THEMES_COLLECTION, "light/button-outline-width", "internal-fkas-private")).toEqual(px(1));
    expect(spec(TOKENS_COLLECTION, "font-sans")).toMatchObject({ type: "STRING", scopes: ["ALL_SCOPES"] });
    // A font weight syncs as a FLOAT variable that only the font weight picker offers, and
    // keeps its value in both schemes.
    expect(spec(TOKENS_COLLECTION, "selection-title-weight")).toMatchObject({
      type: "FLOAT",
      scopes: ["FONT_WEIGHT"],
    });
    for (const scheme of ["light", "dark"]) {
      expect(value(THEMES_COLLECTION, `${scheme}/selection-title-weight`, "external-fkas-private")).toEqual({
        _tag: "Float",
        value: 500,
      });
      expect(value(THEMES_COLLECTION, `${scheme}/selection-title-weight`, "internal-fkas-private")).toEqual({
        _tag: "Float",
        value: 400,
      });
    }
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
    // The external outline Button rings in the text color, and internal themes keep the
    // border role's hairline.
    expect(value(THEMES_COLLECTION, "dark/button-outline", "external-tkas-private")).toEqual({
      _tag: "Alias",
      target: { collection: THEMES_COLLECTION, variable: "dark/foreground" },
    });
    expect(value(THEMES_COLLECTION, "light/button-outline", "internal-tkas-private")).toEqual({
      _tag: "Alias",
      target: { collection: THEMES_COLLECTION, variable: "light/border" },
    });
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
