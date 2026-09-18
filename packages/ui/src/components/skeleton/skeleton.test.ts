import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { skeletonVariants } from "./skeleton-variants";

describe("skeletonVariants", () => {
  it("defaults to the rounded silhouette over the shared pulse and muted surface", () => {
    const resolved = skeletonVariants();
    expect(resolved).toBe(skeletonVariants({ silhouette: "rounded" }));
    expect(resolved).toContain("animate-pulse");
    expect(resolved).toContain("bg-muted");
    expect(resolved).toContain("rounded-md");
  });

  it("swaps in the circle radius without dropping the base classes", () => {
    const resolved = skeletonVariants({ silhouette: "circle" });
    expect(resolved).toContain("rounded-full");
    expect(resolved).not.toContain("rounded-md");
    expect(resolved).toContain("animate-pulse");
    expect(resolved).toContain("bg-muted");
  });

  it("reads no --control-* variable: the silhouette axis is decorative, not a density rung", () => {
    for (const silhouette of ["rounded", "circle"] as const) {
      const resolved = skeletonVariants({ silhouette });
      expect(resolved, silhouette).not.toContain("dark:");
      expect(resolved, silhouette).not.toMatch(RAW_PALETTE_RE);
      expect(resolved, silhouette).not.toContain("--control-");
      expect(resolved, silhouette).not.toContain("data-density");
    }
  });

  it("lets consumer sizing coexist with the base classes and a bg-* override win", () => {
    const merged = cn(skeletonVariants(), "h-4 w-full max-w-24 bg-primary").split(/\s+/);
    expect(merged).toEqual(
      expect.arrayContaining(["animate-pulse", "rounded-md", "h-4", "w-full", "max-w-24"])
    );
    expect(merged).toContain("bg-primary");
    expect(merged).not.toContain("bg-muted");
  });
});
