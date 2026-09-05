import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";

const BASE_CLASSES = "animate-pulse rounded-md bg-muted";

describe("skeleton className merge", () => {
  it("lets consumer sizing coexist with the base classes and a bg-* override win", () => {
    const merged = cn(BASE_CLASSES, "h-4 w-full max-w-24 bg-primary").split(/\s+/);
    expect(merged).toEqual(
      expect.arrayContaining(["animate-pulse", "rounded-md", "h-4", "w-full", "max-w-24"])
    );
    expect(merged).toContain("bg-primary");
    expect(merged).not.toContain("bg-muted");
  });
});
