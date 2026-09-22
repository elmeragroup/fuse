import { describe, expect, it } from "vitest";

import { fieldVariants } from "./field-variants";

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
    const expected = [
      ...shared,
      ...verticalOnly,
      ...horizontalOnly.map((token) => `@md/field-group:${token}`),
      "@md/field-group:*:w-auto",
    ];
    expect(rootTokens("responsive").toSorted()).toEqual(expected.toSorted());
  });
});
