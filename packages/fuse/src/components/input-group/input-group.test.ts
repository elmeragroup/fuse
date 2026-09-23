import { describe, expect, it } from "vitest";

import { inputGroupAddonVariants, inputGroupButtonVariants } from "./input-group-variants";

const ALIGNMENTS = ["inline-start", "inline-end", "block-start", "block-end"] as const;
const BUTTON_SIZES = ["xs", "sm", "icon-xs", "icon-sm"] as const;

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

describe("inputGroupAddonVariants", () => {
  it("defaults to the inline-start rail", () => {
    expect(inputGroupAddonVariants()).toContain("order-first");
    expect(inputGroupAddonVariants()).toContain("pl-2");
  });

  it("resolves every align value with the shared rail base", () => {
    for (const align of ALIGNMENTS) {
      const resolved = inputGroupAddonVariants({ align });
      expect(resolved, align).toContain("cursor-text");
      expect(resolved, align).toContain("text-muted-foreground");
      expect(resolved, align).not.toContain("group-data-[disabled=true]");
      expect(resolved, align).not.toContain("dark:");
    }
    expect(inputGroupAddonVariants({ align: "inline-end" })).toContain("order-last");
    expect(inputGroupAddonVariants({ align: "block-start" })).toContain("w-full");
    expect(inputGroupAddonVariants({ align: "block-end" })).toContain("w-full");
  });
});

describe("inputGroupButtonVariants", () => {
  it("defaults to the compact xs addon size", () => {
    expect(tokens(inputGroupButtonVariants())).toContain("h-6");
  });

  it("lets Button's own sm metrics pass through untouched", () => {
    const base = inputGroupButtonVariants({ size: "sm" });
    for (const token of tokens(base)) {
      expect(token, token).not.toMatch(/^(?:h|size|px)-/);
    }
  });

  it("gives the icon values a square box and no padding", () => {
    expect(tokens(inputGroupButtonVariants({ size: "icon-xs" }))).toEqual(
      expect.arrayContaining(["size-6", "p-0"])
    );
    expect(tokens(inputGroupButtonVariants({ size: "icon-sm" }))).toEqual(
      expect.arrayContaining(["size-8", "p-0"])
    );
  });

  it("is a shell-local exemption: no --control-* rung and no density variants", () => {
    for (const size of BUTTON_SIZES) {
      const resolved = inputGroupButtonVariants({ size });
      expect(resolved, size).not.toContain("--control-");
      expect(resolved, size).not.toContain("dense:");
      expect(resolved, size).not.toContain("comfortable:");
      expect(resolved, size).not.toContain("data-density");
    }
  });
});
