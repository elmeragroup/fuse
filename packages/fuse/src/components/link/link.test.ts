import { describe, expect, it } from "vitest";

import { linkVariants } from "./link-variants";

function classes(rendered: string): string[] {
  return rendered.split(/\s+/).filter(Boolean).sort();
}

describe("linkVariants", () => {
  it("exposes the colour, underline, weight and truncate axes, and no type or box axis", () => {
    expect(linkVariants.variantKeys).toEqual(["variant", "underline", "weight", "truncate"]);
    for (const absent of ["size", "leading", "align"]) {
      expect(linkVariants.variantKeys).not.toContain(absent);
    }
  });

  it("sets no font family, size, line height or display at rest, so a link takes its sentence's type", () => {
    const rendered = classes(linkVariants());
    for (const token of rendered) {
      expect(token).not.toMatch(
        /^(font-|text-(xs|sm|base|lg|xl)|leading-|inline-block$|block$|flex$|inline-flex$)/
      );
    }
    expect(rendered).toContain("text-inherit");
    expect(rendered).toContain("underline");
  });

  it("maps every value of each axis onto its class", () => {
    const expected = [
      ["variant", "default", "text-inherit"],
      ["variant", "foreground", "text-foreground"],
      ["variant", "primary", "text-primary"],
      ["variant", "brand", "text-brand"],
      ["variant", "muted", "text-muted-foreground"],
      ["variant", "error", "text-error"],
      ["underline", "always", "underline"],
      ["underline", "always", "enabled-hover:decoration-current"],
      ["underline", "hover", "no-underline"],
      ["underline", "hover", "enabled-hover:underline"],
      ["underline", "none", "no-underline"],
      ["underline", "none", "enabled-hover:opacity-80"],
      ["weight", "normal", "font-normal"],
      ["weight", "bold", "font-medium"],
      ["truncate", true, "truncate"],
      ["truncate", true, "inline-block"],
    ] as const;
    for (const [axis, value, className] of expected) {
      // SAFETY: each row pairs one of the recipe's own axes with one of that axis's values.
      const rendered = linkVariants({ [axis]: value } as Parameters<typeof linkVariants>[0]);
      expect(classes(rendered), `${axis}=${String(value)}`).toContain(className);
    }
  });

  it("leaves out Text's deprecated alias and its duplicate of the default colour", () => {
    expect(Object.keys(linkVariants.variants.variant)).toEqual([
      "default",
      "foreground",
      "primary",
      "brand",
      "muted",
      "error",
    ]);
  });

  it("keeps the resting underline and its full hover colour to the always arm", () => {
    for (const underline of ["hover", "none"] as const) {
      const rendered = classes(linkVariants({ underline }));
      expect(rendered, underline).not.toContain("underline");
      expect(rendered, underline).not.toContain("enabled-hover:decoration-current");
    }
  });
});
