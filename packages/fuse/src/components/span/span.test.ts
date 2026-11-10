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
  it("resolves a size onto Text's classes at Span's snug leading", () => {
    // Oracle: the parent Text recipe at the same size and leading, pinned in its own tests.
    const tokens = (classes: string) => new Set(classes.split(/\s+/));
    expect(tokens(spanVariants({ size: "sm" }))).toEqual(
      tokens(textVariants({ size: "sm", leading: "snug" }))
    );
  });

  it.each(VARIANTS)("resolves variant %s onto Text's class", (variant) => {
    const resolved = spanVariants({ variant });
    // Oracle: the parent Text recipe's class for the variant, pinned in its own tests.
    expect(resolved.split(/\s+/)).toContain(textVariants.variants.variant[variant]);
    expect(resolved, variant).not.toContain("dark:");
    expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
  });
});
