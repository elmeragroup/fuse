import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "skeleton.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "skeleton.ts"), "utf8");

const BASE_CLASSES = "animate-pulse rounded-md bg-muted";

describe("skeleton source contract", () => {
  it("stays a server surface that emits data-slot and aria-hidden before the props spread", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    const slot = 'data-slot="skeleton"';
    const hidden = 'aria-hidden="true"';
    expect(source).toContain(slot);
    expect(source).toContain(hidden);
    expect(source.indexOf(slot)).toBeLessThan(source.indexOf("{...props}", source.indexOf(slot)));
    expect(source.indexOf(hidden)).toBeLessThan(source.indexOf("{...props}", source.indexOf(hidden)));
  });

  it("is a locked single export with the spec's token fill and no recipe", () => {
    expect(source).toContain(BASE_CLASSES);
    expect(source).toContain("ComponentProps");
    expect(source).not.toContain("skeletonVariants");
    expect(source).not.toContain("HTMLAttributes");
    expect(facade).toContain('export { Skeleton } from "./components/skeleton/skeleton";');
    expect(facade).not.toContain("skeletonVariants");
    expect(facade).not.toContain("Root");
  });
});

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
