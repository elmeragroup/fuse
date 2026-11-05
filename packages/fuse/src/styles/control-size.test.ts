import { describe, expect, it } from "vitest";

import { cn } from "./cn";
import { controlSize } from "./control-size";

/**
 * The contract in `control-size.ts`: every size class is an unprefixed utility a consumer's
 * `className` utility of the same family replaces through tailwind-merge. The expected
 * strings are Tailwind's own utilities, written here by hand; the recipe must land in the
 * same tailwind-merge group as each one. `control-size.browser.test.tsx` measures a consumer
 * `text-*` class over the md and lg density type, with the box metrics it leaves alone; the
 * cases below are the ones it does not render.
 */
describe("control size: consumer utilities replace the recipe's", () => {
  const DENSITY_TYPE_SIZES = [
    ["md", "label"],
    ["md", "min-square"],
    ["lg", "label"],
    ["lg", "min-square"],
  ] as const;

  it.each(DENSITY_TYPE_SIZES)(
    "lets a consumer leading-* class replace the %s %s line height",
    (size, fit) => {
      const merged = cn(controlSize({ size, fit }), "leading-5").split(" ");
      expect(merged).toContain("leading-5");
      expect(merged).not.toContain("leading-(--control-leading)");
      expect(merged).toContain("text-(length:--control-text)");
    }
  );

  it("keeps the fixed xs and sm type replaceable too", () => {
    expect(cn(controlSize({ size: "xs", fit: "label" }), "text-base")).not.toContain("text-xs");
    expect(cn(controlSize({ size: "sm", fit: "label" }), "text-base")).not.toContain("text-sm");
  });
});
