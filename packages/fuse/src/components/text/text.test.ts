import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { typographyFragments } from "../../styles/typography-fragments";
import { textVariants } from "./text-variants";

const FRAGMENT_VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
] as const;

describe("textVariants", () => {
  it.each(FRAGMENT_VARIANTS)("resolves variant %s onto the shared fragment class", (variant) => {
    const resolved = textVariants({ variant });
    // Oracle: the shared fragment, which typography-fragments.test.ts pins by hand.
    expect(resolved.split(/\s+/)).toContain(typographyFragments({ variant }));
    expect(resolved, variant).not.toContain("dark:");
    expect(resolved, variant).not.toMatch(RAW_PALETTE_RE);
  });
});
