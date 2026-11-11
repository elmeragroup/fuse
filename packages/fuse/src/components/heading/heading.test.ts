import { describe, expect, it } from "vitest";

import { typographyFragments } from "../../styles/typography-fragments";
import { headingVariants } from "./heading-variants";

const VARIANTS = [
  "default",
  "foreground",
  "primary",
  "secondary",
  "brand",
  "muted",
  "inherit",
  "destructive",
] as const;

describe("headingVariants", () => {
  it("forwards each variant's shared fragment; destructive is text-error and never a destructive class", () => {
    for (const variant of VARIANTS) {
      const resolved = headingVariants({ variant });
      // Oracle: the shared fragment, which typography-fragments.test.ts pins by hand.
      expect(resolved, variant).toContain(typographyFragments({ variant }));
    }
    const destructive = headingVariants({ variant: "destructive" });
    expect(destructive).toContain("text-error");
    expect(destructive).not.toContain("destructive");
  });
});
