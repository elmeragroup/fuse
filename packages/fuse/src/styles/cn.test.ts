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
    [
      "replaces rounded-inner with a later rounded-* class",
      ["rounded-inner", "rounded-none"],
      "rounded-none",
    ],
    [
      "replaces a rounded-* class with a later rounded-inner",
      ["rounded-sm", "rounded-inner"],
      "rounded-inner",
    ],
    ["replaces a mark fill with a later bg-* class", ["mark-fill-border", "bg-primary"], "bg-primary"],
    ["replaces a bg-* class with a later mark fill", ["bg-primary", "mark-fill-border"], "mark-fill-border"],
    [
      "replaces a mark fill with an opacity modifier under a variant",
      ["after:mark-fill-foreground/70", "after:bg-transparent"],
      "after:bg-transparent",
    ],
    [
      "keeps the forced highlight beside a later bg-* class under the same variant",
      ["data-pressed:bg-toggle-pressed data-pressed:forced-highlight", "data-pressed:bg-primary"],
      "data-pressed:forced-highlight data-pressed:bg-primary",
    ],
  ])("%s", (_name, classes, expected) => {
    expect(cn(...classes)).toBe(expected);
  });
});
