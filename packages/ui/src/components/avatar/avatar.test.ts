import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import { avatarVariants, ROOT_CLASSES } from "./avatar-variants";

describe("avatar className merge", () => {
  it("resolves ROOT_CLASSES from the recipe", () => {
    expect(ROOT_CLASSES).toBe(avatarVariants().root());
  });

  it("lets size-10 beat the default size-8 through cn", () => {
    const merged = cn(ROOT_CLASSES, "size-10").split(/\s+/);
    expect(merged).toContain("size-10");
    expect(merged).not.toContain("size-8");
    expect(merged).toEqual(
      expect.arrayContaining(["inline-flex", "shrink-0", "rounded-full", "bg-muted", "text-muted-foreground"])
    );
  });
});
