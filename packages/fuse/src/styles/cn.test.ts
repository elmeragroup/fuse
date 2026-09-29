import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("class merge last-wins", () => {
  it.each([
    [
      "replaces a literal height with a later token-read height",
      ["h-9", "h-(--control-h)"],
      "h-(--control-h)",
    ],
    ["restores a later literal height over a token-read height", ["h-(--control-h)", "h-9"], "h-9"],
    [
      "keeps size-* beside a token-read h-* / w-* pair",
      ["size-9", "h-(--control-h)", "w-(--control-h)"],
      "size-9 h-(--control-h) w-(--control-h)",
    ],
    [
      "replaces size-* with a later token-read size-*",
      ["size-9", "size-(--control-size)"],
      "size-(--control-size)",
    ],
  ])("%s", (_name, classes, expected) => {
    expect(cn(...classes)).toBe(expected);
  });
});
