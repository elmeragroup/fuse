import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { confirmButtonVariants } from "./confirm-button-variants";

const EMPTY_VARIANTS = ["default", "outline", "secondary", "ghost", "link"] as const;

describe("confirmButtonVariants", () => {
  it("adds nothing when variant is undefined and keeps empty alignment keys empty", () => {
    expect(confirmButtonVariants()).toBeFalsy();
    expect(confirmButtonVariants({})).toBeFalsy();
    for (const variant of EMPTY_VARIANTS) {
      expect(confirmButtonVariants({ variant }), variant).toBeFalsy();
    }
  });

  it.each([
    ["destructive", "error"],
    ["success", "success"],
  ] as const)(
    "escalates the armed %s fill onto %s tokens without raw palette, dark, density, or destructive classes",
    (variant, token) => {
      const resolved = confirmButtonVariants({ variant });
      expect(resolved).toContain(`data-[armed=true]:bg-${token}`);
      expect(resolved).toContain(`data-[armed=true]:text-${token}-foreground`);
      expect(resolved, variant).not.toContain("dark:");
      expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
      expect(resolved, variant).not.toMatch(/\b(?:dense|comfortable):/);
      expect(resolved, variant).not.toMatch(/bg-destructive|text-destructive|border-destructive/);
    }
  );
});
