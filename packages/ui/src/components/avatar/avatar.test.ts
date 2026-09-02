import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";

const ROOT_CLASSES =
  "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-sm font-medium text-muted-foreground select-none";

describe("avatar className merge", () => {
  it("lets size-10 beat the default size-8 through cn", () => {
    const merged = cn(ROOT_CLASSES, "size-10").split(/\s+/);
    expect(merged).toContain("size-10");
    expect(merged).not.toContain("size-8");
    expect(merged).toEqual(
      expect.arrayContaining(["inline-flex", "shrink-0", "rounded-full", "bg-muted", "text-muted-foreground"])
    );
  });
});
