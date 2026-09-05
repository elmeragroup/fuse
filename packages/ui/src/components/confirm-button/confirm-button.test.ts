import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { confirmButtonVariants } from "./confirm-button-variants";

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
