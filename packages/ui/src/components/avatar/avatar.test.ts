import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { avatarVariants } from "./avatar-variants";

describe("avatarVariants", () => {
  it("paints from muted tokens and never a raw gray palette class", () => {
    const resolved = avatarVariants();
    expect(resolved).toContain("bg-muted");
    expect(resolved).toContain("text-muted-foreground");
    expect(resolved).not.toContain("bg-gray-");
    expect(resolved).not.toContain("text-gray-");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });

  it("defaults to ungrouped: no ring on a lone avatar", () => {
    expect(avatarVariants()).toBe(avatarVariants({ grouped: false }));
    expect(avatarVariants()).not.toContain("ring-");
  });

  it("separates stacked avatars with the background-coloured ring when grouped", () => {
    const grouped = avatarVariants({ grouped: true });
    expect(grouped).toContain("ring-2");
    expect(grouped).toContain("ring-background");
    expect(grouped).toContain("bg-muted");
    expect(grouped).toContain("rounded-full");
  });

  it("lets className size-10 beat the default size-8 through cn", () => {
    const merged = cn(avatarVariants(), "size-10").split(/\s+/);
    expect(merged).toContain("size-10");
    expect(merged).not.toContain("size-8");
  });
});
