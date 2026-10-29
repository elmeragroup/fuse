import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { emptyMediaVariants, emptyVariants } from "./empty-variants";

describe("emptyVariants", () => {
  it("keeps the anatomy layout classes without a control-box size axis", () => {
    const resolved = emptyVariants().root();
    expect(resolved).toContain("flex");
    expect(resolved).toContain("min-w-0");
    expect(resolved).toContain("flex-1");
    expect(resolved).toContain("flex-col");
    expect(resolved).toContain("items-center");
    expect(resolved).toContain("justify-center");
    expect(resolved).toContain("gap-6");
    expect(resolved).toContain("rounded-lg");
    expect(resolved).toContain("p-(--surface-pad-lg)");
    expect(resolved).toContain("text-center");
    expect(resolved).toContain("text-balance");
    expect(resolved).toContain("md:p-[calc(2*var(--surface-pad-lg))]");
    expect(resolved).not.toContain("--control-");
    expect(resolved).not.toContain("data-density");
  });

  it("carries no destructive, raw palette, or dark classes", () => {
    const resolved = [
      emptyVariants().root(),
      emptyVariants({ variant: "outline" }).root(),
      emptyVariants({ variant: "outline-dashed" }).root(),
    ].join(" ");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toContain("destructive");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });
});

describe("emptyMediaVariants", () => {
  it("defaults to transparent media and boxes the icon variant", () => {
    expect(emptyMediaVariants()).toContain("bg-transparent");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("size-10");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("rounded-lg");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("bg-muted");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("text-foreground");
    expect(emptyMediaVariants({ variant: "icon" })).toContain("[&_svg:not([class*='size-'])]:size-6");
  });

  it("keeps the media base classes on every variant", () => {
    for (const variant of ["default", "icon"] as const) {
      const resolved = emptyMediaVariants({ variant });
      expect(resolved, variant).toContain("mb-2");
      expect(resolved, variant).toContain("flex");
      expect(resolved, variant).toContain("shrink-0");
      expect(resolved, variant).toContain("items-center");
      expect(resolved, variant).toContain("justify-center");
      expect(resolved, variant).toContain("[&_svg]:pointer-events-none");
      expect(resolved, variant).toContain("[&_svg]:shrink-0");
      expect(resolved, variant).not.toContain("--control-");
    }
  });
});
