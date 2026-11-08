import { describe, expect, it } from "vitest";

import { fieldLegendVariants, fieldVariants } from "./field-variants";

function rootTokens(orientation: "vertical" | "horizontal" | "responsive"): string[] {
  return fieldVariants({ orientation }).root().split(/\s+/).filter(Boolean);
}

describe("fieldVariants orientation", () => {
  it("builds responsive from vertical below the field-group md width and horizontal above it", () => {
    // Unit under test: the hand-written responsive literal. Oracle: the vertical and
    // horizontal outputs. Tailwind cannot build the literal from them, so only this check
    // keeps a change to horizontal from skipping responsive.
    const vertical = rootTokens("vertical");
    const horizontal = rootTokens("horizontal");
    const verticalOnly = vertical.filter((token) => !horizontal.includes(token));
    const horizontalOnly = horizontal.filter((token) => !vertical.includes(token));
    const shared = vertical.filter((token) => horizontal.includes(token));
    // The md row resets vertical's child stretch through the stretch's own selector, so Tailwind
    // emits the reset after the stretch.
    const mdResets = vertical
      .filter((token) => token.endsWith(":w-full"))
      .map((token) => `@md/field-group:${token.replace(/:w-full$/, ":w-auto")}`);
    const expected = [
      ...shared,
      ...verticalOnly,
      ...horizontalOnly.map((token) => `@md/field-group:${token}`),
      ...mdResets,
    ];
    expect(rootTokens("responsive").toSorted()).toEqual(expected.toSorted());
  });
});

describe("fieldLegendVariants", () => {
  const tokens = (classes: string): string[] => classes.split(/\s+/).filter(Boolean).toSorted();

  it("titles a fieldset at a fixed 16/24px by default", () => {
    const expected = tokens("font-medium mb-3 text-balance text-base");
    expect(tokens(fieldLegendVariants())).toEqual(expected);
    expect(tokens(fieldLegendVariants({ variant: "legend" }))).toEqual(expected);
  });

  it("reads the label type pair in its label variant, as Field.Label does", () => {
    expect(tokens(fieldLegendVariants({ variant: "label" }))).toEqual(
      tokens("font-medium mb-3 text-balance text-(length:--label-text) leading-(--label-leading)")
    );
  });
});
