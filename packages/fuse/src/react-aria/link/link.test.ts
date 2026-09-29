import { describe, expect, it } from "vitest";

import { linkVariants } from "../../styles/link";

function classes(rendered: string): string[] {
  return rendered.split(/\s+/).filter(Boolean).sort();
}

describe("linkVariants", () => {
  it("exposes exactly the five typography axes", () => {
    expect(linkVariants.variantKeys).toEqual(["variant", "leading", "truncate", "align", "weight"]);
    expect(linkVariants.variantKeys).not.toContain("size");
    // The focus state is composed at the call site from RAC render props, never an axis a
    // consumer could set.
    expect(linkVariants.variantKeys).not.toContain("isFocusVisible");
  });

  it("renders the base plus the default variant and weight, and nothing else", () => {
    // The hover face is left out: state-face.browser.test.tsx owns the Link hover gate.
    const rendered = classes(linkVariants()).filter((token) => !token.includes("hover:"));
    expect(rendered).toEqual(classes("font-sans transition-opacity text-inherit font-normal"));
  });

  it("maps every value of the variant, leading, align, truncate and weight axes onto its class, recorded quirks included", () => {
    const expected = [
      ["variant", "default", "text-inherit"],
      ["variant", "foreground", "text-foreground"],
      ["variant", "primary", "text-primary"],
      ["variant", "secondary", "text-foreground"],
      ["variant", "brand", "text-brand"],
      ["variant", "muted", "text-muted-foreground"],
      ["variant", "inherit", "text-inherit"],
      ["variant", "error", "text-error"],
      ["leading", "none", "leading-none"],
      ["leading", "tight", "leading-tight"],
      ["leading", "snug", "leading-snug"],
      ["leading", "relaxed", "leading-relaxed"],
      ["leading", "loose", "leading-loose"],
      ["align", "left", "text-left"],
      ["align", "center", "text-center"],
      ["align", "right", "text-right"],
      ["align", "justify", "text-justify"],
      ["truncate", true, "truncate"],
      ["weight", "normal", "font-normal"],
      // Recorded quirk: weight bold renders font-medium.
      ["weight", "bold", "font-medium"],
    ] as const;
    for (const [axis, value, className] of expected) {
      // SAFETY: each row pairs one of the recipe's own axes with one of that axis's values.
      const rendered = linkVariants({ [axis]: value } as Parameters<typeof linkVariants>[0]);
      expect(classes(rendered), `${axis}=${String(value)}`).toContain(className);
    }
    expect(classes(linkVariants())).not.toContain("leading-relaxed");
    expect(classes(linkVariants())).not.toContain("truncate");
    expect(classes(linkVariants({ weight: "bold" }))).not.toContain("font-bold");
    // Recorded quirk: default and inherit are the same variant.
    expect(linkVariants({ variant: "inherit" })).toBe(linkVariants({ variant: "default" }));
  });
});
