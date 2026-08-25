import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { confirmButtonVariants } from "./confirm-button-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "confirm-button.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "confirm-button-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "confirm-button.ts"), "utf8");

const EMPTY_VARIANTS = ["default", "outline", "secondary", "ghost", "link"] as const;
const ARMED_VARIANTS = ["destructive", "success"] as const;

describe("confirmButtonVariants", () => {
  it("adds nothing when variant is undefined and keeps empty alignment keys empty", () => {
    expect(confirmButtonVariants()).toBeFalsy();
    expect(confirmButtonVariants({})).toBeFalsy();
    for (const variant of EMPTY_VARIANTS) {
      expect(confirmButtonVariants({ variant }), variant).toBeFalsy();
    }
  });

  it("escalates armed fills on the locked destructive and success values with error/success tokens", () => {
    expect(confirmButtonVariants({ variant: "destructive" })).toContain("data-[armed=true]:bg-error");
    expect(confirmButtonVariants({ variant: "destructive" })).toContain(
      "data-[armed=true]:text-error-foreground"
    );
    expect(confirmButtonVariants({ variant: "success" })).toContain("data-[armed=true]:bg-success");
    expect(confirmButtonVariants({ variant: "success" })).toContain(
      "data-[armed=true]:text-success-foreground"
    );
  });

  it("covers every Button-aligned variant without raw palette, dark, density, or destructive classes", () => {
    expect(EMPTY_VARIANTS).toHaveLength(5);
    expect(ARMED_VARIANTS).toHaveLength(2);
    for (const variant of ARMED_VARIANTS) {
      const resolved = confirmButtonVariants({ variant });
      expect(resolved.length, variant).toBeGreaterThan(0);
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
      expect(resolved, variant).not.toMatch(/\b(?:dense|comfortable):/);
      expect(resolved, variant).not.toMatch(/bg-destructive|text-destructive|border-destructive/);
    }
  });
});

describe("confirm-button source contract", () => {
  it("is a client wrapper over the library Button with a private recipe", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).toContain('from "../button/button"');
    expect(source).not.toContain("@base-ui/react/button");
    expect(source).not.toContain("useLocalizedStrings");
    expect(source).not.toContain(".ref/");
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { ConfirmButton } from "./components/confirm-button/confirm-button"');
    expect(facade).toContain(
      'export type { ConfirmButtonProps } from "./components/confirm-button/confirm-button"'
    );
    expect(facade).not.toContain("confirmButtonVariants");
  });

  it("does not keep destructive classes, dark variants, or density stamps", () => {
    const combined = [source, variantsSource].join("\n");
    expect(combined).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(combined).not.toContain("dark:");
    expect(combined).not.toMatch(RAW_PALETTE_RE);
    expect(combined).not.toMatch(/\b(?:dense|comfortable):/);
    expect(combined).not.toContain("data-density");
    expect(variantsSource).toContain("defaultVariants: {}");
    expect(variantsSource).not.toContain('variant: "default"');
  });
});
