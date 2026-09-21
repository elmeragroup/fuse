import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { loaderVariants } from "./loader-variants";

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
