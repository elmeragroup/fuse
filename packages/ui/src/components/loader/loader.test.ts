import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { loaderVariants } from "./loader-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "loader.tsx"), "utf8");
const recipe = readFileSync(join(here, "loader-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "loader.ts"), "utf8");

const SIZES = ["default", "small", "medium", "large", "xl"] as const;

const ICON_SIZE_CLASS = {
  default: "size-4",
  small: "size-3",
  medium: "size-6",
  large: "size-8",
  xl: "size-10",
} as const;

describe("loaderVariants", () => {
  it("returns base and icon slot functions with the spec defaults", () => {
    const slots = loaderVariants();
    expect(slots.base()).toBe(loaderVariants({ variant: "default", size: "default" }).base());
    expect(slots.icon()).toBe(loaderVariants({ variant: "default", size: "default" }).icon());
    expect(slots.base()).toContain("flex");
    expect(slots.base()).toContain("items-center");
    expect(slots.base()).toContain("justify-center");
    expect(slots.base()).toContain("p-4");
    expect(slots.base()).toContain("text-foreground");
    expect(slots.icon()).toContain("animate-spin");
    expect(slots.icon()).toContain("size-4");
  });

  it("maps each size onto the icon slot only", () => {
    for (const size of SIZES) {
      const { base, icon } = loaderVariants({ size });
      expect(icon(), size).toContain(ICON_SIZE_CLASS[size]);
      expect(icon(), size).toContain("animate-spin");
      expect(base(), size).not.toContain(ICON_SIZE_CLASS[size]);
    }
  });

  it("keeps the single-value variant axis and reads no density metrics", () => {
    const { base, icon } = loaderVariants({ variant: "default" });
    const resolved = `${base()} ${icon()}`;
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
    expect(resolved).not.toContain("--control-");
    expect(resolved).not.toContain("data-density");
    expect(recipe).toContain("variant:");
    expect(recipe).toContain("default:");
  });

  it("lets a className merge onto the wrapper through cn", () => {
    const merged = cn(loaderVariants().base(), "bg-muted p-0").split(/\s+/);
    expect(merged).toContain("flex");
    expect(merged).toContain("items-center");
    expect(merged).toContain("justify-center");
    expect(merged).toContain("bg-muted");
    expect(merged).toContain("p-0");
    expect(merged).not.toContain("p-4");
  });
});

describe("loader source contract", () => {
  it("stays a server surface that emits data-slot and role before the props spread", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("Loader2");
    expect(source).not.toContain("lucide");
    expect(source).toContain("SpinnerGap");
    const slot = 'data-slot="loader"';
    const role = 'role="status"';
    expect(source).toContain(slot);
    expect(source).toContain(role);
    expect(source.indexOf(slot)).toBeLessThan(source.indexOf("{...props}", source.indexOf(slot)));
    expect(source.indexOf(role)).toBeLessThan(source.indexOf("{...props}", source.indexOf(role)));
  });

  it("exports loaderVariants once from the public entry, not from the component module", () => {
    expect(facade).toContain('export { Loader } from "./components/loader/loader";');
    expect(facade).toContain('export { loaderVariants } from "./components/loader/loader-variants";');
    expect(source).not.toContain("export { loaderVariants");
    expect(source).not.toContain("export const loaderVariants");
  });
});
