import { Result } from "effect";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { fuseVariableSet } from "./fuse-variable-set.ts";
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

const alias = (collectionName: string, variable: string): VariableValue => ({
  _tag: "Alias",
  target: { collection: collectionName, variable },
});

describe("fuseVariableSet", () => {
  it("chains every bound variable through variant, segment and brand", () => {
    expect(value("Fuse tokens", "primary", "Dark")).toEqual(alias("Fuse variant", "dark/primary"));
    expect(value("Fuse variant", "dark/primary", "External")).toEqual(
      alias("Fuse segment", "dark/external/primary")
    );
    expect(value("Fuse segment", "dark/external/primary", "Company")).toEqual(
      alias("Fuse brand", "dark/external/company/primary")
    );
    // A rung takes the same four hops, though only the variant changes its value.
    expect(value("Fuse tokens", "radius-md", "Light")).toEqual(alias("Fuse variant", "light/radius-md"));
    expect(value("Fuse segment", "light/internal/radius-md", "Private")).toEqual(
      alias("Fuse brand", "light/internal/private/radius-md")
    );
  });

  it("writes each kind's resolved literal in its Figma form", () => {
    // `#5c6773` in DEFAULTS is a hex literal, not oklch.
    expect(value("Fuse brand", "light/internal/private/sh-identifier", "Fjordkraft")).toEqual({
      _tag: "Color",
      color: { r: 0x5c / 255, g: 0x67 / 255, b: 0x73 / 255, a: 1 },
    });
    // The internal dark field border is white at 40% alpha, which Figma keeps as `a`.
    expect(value("Fuse brand", "dark/internal/private/input", "Fjordkraft")).toEqual({
      _tag: "Color",
      color: { r: 1, g: 1, b: 1, a: 0.4 },
    });
    expect(value("Fuse brand", "light/external/private/radius-button", "Fjordkraft")).toEqual(px(29));
    expect(value("Fuse brand", "light/external/private/font-heading", "Fjordkraft")).toEqual({
      _tag: "String",
      value: "Neo Sans",
    });
    expect(spec("Fuse tokens", "primary")).toMatchObject({ type: "COLOR", scopes: ["ALL_SCOPES"] });
    expect(spec("Fuse tokens", "radius")).toMatchObject({ type: "FLOAT", scopes: ["CORNER_RADIUS"] });
    expect(spec("Fuse tokens", "radius-step")).toMatchObject({ type: "FLOAT", scopes: [] });
    expect(spec("Fuse tokens", "button-outline-width")).toMatchObject({
      type: "FLOAT",
      scopes: ["STROKE_FLOAT"],
    });
    expect(value("Fuse brand", "light/external/private/button-outline-width", "Fjordkraft")).toEqual(px(2));
    expect(value("Fuse brand", "light/internal/private/button-outline-width", "Fjordkraft")).toEqual(px(1));
    expect(spec("Fuse tokens", "font-sans")).toMatchObject({ type: "STRING", scopes: ["FONT_FAMILY"] });
    // A font weight syncs as a FLOAT variable that only the font weight picker offers, and
    // keeps its value in both schemes. A real file stores that picker's scope as FONT_STYLE.
    expect(spec("Fuse tokens", "selection-title-weight")).toMatchObject({
      type: "FLOAT",
      scopes: ["FONT_STYLE"],
    });
    for (const scheme of ["light", "dark"]) {
      expect(value("Fuse brand", `${scheme}/external/private/selection-title-weight`, "Fjordkraft")).toEqual(
        px(500)
      );
      expect(value("Fuse brand", `${scheme}/internal/private/selection-title-weight`, "Fjordkraft")).toEqual(
        px(400)
      );
    }
  });

  it("turns var() references into aliases at the same theme path or to primitives", () => {
    expect(value("Fuse brand", "dark/external/private/destructive", "Gudbrandsdal Energi")).toEqual(
      alias("Fuse brand", "dark/external/private/error")
    );
    expect(value("Fuse brand", "light/external/company/brand", "Fjordkraft Företag (company only)")).toEqual(
      alias("Fuse primitives", "brand-fkab")
    );
    // fkab shares Fjordkraft's accent by policy.
    expect(value("Fuse primitives", "brand-fkab", "Value")).toEqual(alias("Fuse primitives", "brand-fkas"));
    // The external outline Button rings in the text color, and internal themes keep the
    // border role's hairline.
    expect(value("Fuse brand", "dark/external/private/button-outline", "TrøndelagKraft")).toEqual(
      alias("Fuse brand", "dark/external/private/foreground")
    );
    expect(value("Fuse brand", "light/internal/private/button-outline", "TrøndelagKraft")).toEqual(
      alias("Fuse brand", "light/internal/private/border")
    );
  });

  it("gives Auto density the variant's default density and keeps Dense and Comfortable literal", () => {
    // fuse.css: --control-h-md is 2.25rem on :root and 2.75rem when comfortable. Apps deploy
    // internal themes dense and external themes comfortable.
    expect(value("Fuse density", "control-h-md", "Auto")).toEqual(
      alias("Fuse variant", "density/control-h-md")
    );
    expect(value("Fuse variant", "density/control-h-md", "Internal")).toEqual(px(36));
    expect(value("Fuse variant", "density/control-h-md", "External")).toEqual(px(44));
    expect(value("Fuse density", "control-h-md", "Dense")).toEqual(px(36));
    expect(value("Fuse density", "control-h-md", "Comfortable")).toEqual(px(44));
    expect(spec("Fuse variant", "density/control-h-md")).toMatchObject({ scopes: [], webSyntax: undefined });
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
