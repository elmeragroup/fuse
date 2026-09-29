import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { loaderVariants } from "./loader-variants";

describe("loaderVariants", () => {
  it("returns base and icon slot functions with the default recipe values", () => {
    const slots = loaderVariants();
    expect(slots.base()).toContain("flex");
    expect(slots.base()).toContain("items-center");
    expect(slots.base()).toContain("justify-center");
    expect(slots.base()).toContain("p-4");
    expect(slots.base()).toContain("text-foreground");
    expect(slots.icon()).toContain("animate-spin");
    expect(slots.icon()).toContain("size-4");
  });

  it("keeps the single-value variant axis and reads no density metrics", () => {
    const { base, icon } = loaderVariants({ variant: "default" });
    const resolved = `${base()} ${icon()}`;
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
    expect(resolved).not.toContain("--control-");
    expect(resolved).not.toContain("data-density");
  });
});
