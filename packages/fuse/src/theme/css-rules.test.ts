import { describe, expect, it } from "vitest";

import { parseCssBlocks, parseStyleRules } from "./css-rules";

const SHEET = `
@import "tw-animate-css";
@plugin "tailwindcss-react-aria-components";
/* A comment { with braces } is ignored. */
:root {
  --control-h-md: 2.25rem;
  color: red;
}
@theme inline {
  --radius-md: calc(var(--radius) - 2px);
}
@custom-variant data-open {
  &:where([data-open]) {
    @slot;
  }
}
`;

describe("parseCssBlocks", () => {
  it("reads selector and at-rule blocks after statement at-rules, stripping custom property dashes", () => {
    expect(parseCssBlocks(SHEET)).toEqual([
      {
        prelude: ":root",
        declarations: [
          { name: "control-h-md", value: "2.25rem" },
          { name: "color", value: "red" },
        ],
      },
      { prelude: "@theme inline", declarations: [{ name: "radius-md", value: "calc(var(--radius) - 2px)" }] },
      { prelude: "&:where([data-open])", declarations: [] },
    ]);
  });
});

describe("parseStyleRules", () => {
  it("keeps only the blocks whose prelude is a selector", () => {
    expect(parseStyleRules(SHEET).map((rule) => rule.selector)).toEqual([":root", "&:where([data-open])"]);
  });
});
