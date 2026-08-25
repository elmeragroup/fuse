import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "number-field.tsx"), "utf8");
const facade = readFileSync(join(here, "../../number-field.ts"), "utf8");

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

describe("number-field source contract", () => {
  it("pins the md control rung and never a literal control ladder", () => {
    expect(source).toContain("h-(--control-h-md)");
    expect(source).toContain("px-(--control-px-md)");
    expect(source).toContain("[font-size:var(--control-text)]");
    expect(source).toContain("[line-height:var(--control-leading)]");
    for (const literal of ["h-9 ", "h-10 ", "px-2.5 ", "px-3 "]) {
      expect(source, literal).not.toContain(literal);
    }
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("dense:");
    expect(source).not.toContain("comfortable:");
  });

  it("takes both focus slots from the shared within adapter and defines no ring literal", () => {
    expect(source).toContain('focusRing({ target: "within" }).root()');
    expect(source).toContain('focusRing({ target: "within" }).control()');
    expect(source).toContain("data-focus-ring-control");
    expect(source).not.toContain("focus-within");
    expect(source).not.toContain("ring-ring");
    for (const token of tokens(focusRing({ target: "within" }).root())) {
      expect(source, token).not.toContain(token);
    }
  });

  it("is a client module that applies every §8 token swap", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    // oxlint-disable-next-line elmera/no-primitive-colors -- source-grep of the forbidden class, not a recipe
    expect(source).not.toContain("bg-white");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).toContain("bg-card");
    expect(source).toContain("aria-invalid:border-error");
    expect(source).toContain("aria-invalid:ring-error/20");
    expect(source).toContain("CaretUp");
    expect(source).toContain("CaretDown");
    expect(source).toContain("SpinnerGap");
    expect(source).toContain("Check");
    expect(source).toContain("animate-spin");
    expect(source).toContain("useElmeraGroupUi");
    expect(source).toContain("locale={locale}");
    expect(source).toContain("onChange?.(next ?? NaN)");
    expect(source).toContain("isInvalid || undefined");
  });

  it("keeps the stepper classes module-private and the facade a named re-export", () => {
    expect(source).toContain("const stepperButton");
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("stepperButton");
    expect(facade).toContain('export { NumberField } from "./components/number-field/number-field";');
    expect(facade).toContain(
      'export type { NumberFieldProps } from "./components/number-field/number-field";'
    );
  });
});
