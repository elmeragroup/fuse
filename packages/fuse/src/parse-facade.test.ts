import { describe, expect, it } from "vitest";

import { parseFacadeValueExports } from "../scripts/parse-facade";

describe("parseFacadeValueExports", () => {
  it("collects named value re-exports and ignores type-only exports", () => {
    const names = parseFacadeValueExports(
      "src/button.ts",
      `export { Button } from "./components/button/button";
export type { ButtonProps } from "./components/button/button";
export { buttonVariants } from "./components/button/button-variants";
`
    );
    expect(names).toEqual(["Button", "buttonVariants"]);
  });

  it("collects aliases and mixed type specifiers", () => {
    const names = parseFacadeValueExports(
      "src/selection-item.ts",
      `export {
  SelectionItem,
  SelectionItem as CheckboxItem,
  SelectionItem as RadioItem,
  type SelectionItemProps,
} from "./components/selection-item/selection-item";
`
    );
    expect(names).toEqual(["SelectionItem", "CheckboxItem", "RadioItem"]);
  });

  it("rejects export *", () => {
    expect(() =>
      parseFacadeValueExports("src/button.ts", `export * from "./components/button/button";\n`)
    ).toThrow(/export \*/);
  });

  it("rejects local declarations", () => {
    expect(() =>
      parseFacadeValueExports("src/button.ts", `export const Button = 1;\nexport { Button } from "./x";\n`)
    ).toThrow(/local declarations/);
  });

  it("rejects directives", () => {
    expect(() =>
      parseFacadeValueExports(
        "src/button.ts",
        `"use client";\nexport { Button } from "./components/button/button";\n`
      )
    ).toThrow(/directive/);
  });

  it("rejects a facade with no value exports", () => {
    expect(() =>
      parseFacadeValueExports(
        "src/button.ts",
        `export type { ButtonProps } from "./components/button/button";\n`
      )
    ).toThrow(/no value exports/);
  });
});
