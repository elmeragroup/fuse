import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { textVariants } from "../text/text-variants";
import { spanVariants } from "./span-variants";

const VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
  "success",
] as const;

describe("spanVariants", () => {
  it("defaults to variant/size default, leading snug, and weight normal", () => {
    const resolved = spanVariants();
    expect(resolved).toContain("font-sans");
    expect(resolved).toContain("text-inherit");
    expect(resolved).toContain("text-base");
    expect(resolved).toContain("leading-snug");
    expect(resolved).toContain("font-normal");
    expect(resolved).not.toContain("leading-relaxed");
  });

  it.each(VARIANTS)("resolves variant %s onto Text's class", (variant) => {
    const resolved = spanVariants({ variant });
    // Oracle: the parent Text recipe's class for the variant, pinned in its own tests.
    expect(resolved.split(/\s+/)).toContain(textVariants.variants.variant[variant]);
    expect(resolved, variant).not.toContain("dark:");
    expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
  });
});
