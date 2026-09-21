import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("class merge last-wins", () => {
  it("replaces a literal height with a later token-read height", () => {
    expect(cn("h-9", "h-(--control-h)")).toBe("h-(--control-h)");
  });

  it("restores a later literal height over a token-read height", () => {
    expect(cn("h-(--control-h)", "h-9")).toBe("h-9");
  });

  it("keeps size-* beside a token-read h-* / w-* pair", () => {
    expect(cn("size-9", "h-(--control-h)", "w-(--control-h)")).toBe("size-9 h-(--control-h) w-(--control-h)");
  });

  it("replaces size-* with a later token-read size-*", () => {
    expect(cn("size-9", "size-(--control-size)")).toBe("size-(--control-size)");
  });
});
