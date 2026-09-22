import { describe, expect, it } from "vitest";

import { typographyFragments } from "./typography-fragments";

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

describe("typographyFragments", () => {
  it("maps each colour variant onto its role token", () => {
    expect(
      Object.fromEntries(VARIANTS.map((variant) => [variant, typographyFragments({ variant })]))
    ).toEqual({
      default: "text-inherit",
      foreground: "text-foreground",
      primary: "text-primary",
      secondary: "text-foreground",
      brand: "text-brand",
      muted: "text-muted-foreground",
      inherit: "text-inherit",
      destructive: "text-error",
    });
  });

  it("maps start, center and end alignment", () => {
    expect(typographyFragments({ align: "left" })).toBe("text-left");
    expect(typographyFragments({ align: "center" })).toBe("text-center");
    expect(typographyFragments({ align: "right" })).toBe("text-right");
  });
});
