import { describe, expect, it } from "vitest";

import { parseFacadeValueExports } from "../scripts/parse-facade";

describe("parseFacadeValueExports", () => {
  it.each([
    [
      "collects named value re-exports and ignores type-only exports",
      "src/button.ts",
      `export { Button } from "./components/button/button";
export type { ButtonProps } from "./components/button/button";
export { buttonVariants } from "./components/button/button-variants";
`,
      ["Button", "buttonVariants"],
    ],
    [
      "collects aliases and mixed type specifiers",
      "src/selection-item.ts",
      `export {
  SelectionItem,
  SelectionItem as CheckboxItem,
  SelectionItem as RadioItem,
  type SelectionItemProps,
} from "./components/selection-item/selection-item";
`,
      ["SelectionItem", "CheckboxItem", "RadioItem"],
    ],
  ])("%s", (_case, file, source, names) => {
    expect(parseFacadeValueExports(file, source)).toEqual(names);
  });

  it.each([
    ["export *", `export * from "./components/button/button";\n`, /export \*/],
    ["local declarations", `export const Button = 1;\nexport { Button } from "./x";\n`, /local declarations/],
    ["directives", `"use client";\nexport { Button } from "./components/button/button";\n`, /directive/],
    [
      "a facade with no value exports",
      `export type { ButtonProps } from "./components/button/button";\n`,
      /no value exports/,
    ],
  ])("rejects %s", (_case, source, message) => {
    expect(() => parseFacadeValueExports("src/button.ts", source)).toThrow(message);
  });
});
