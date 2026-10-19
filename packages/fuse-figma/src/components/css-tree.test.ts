import { describe, expect, it } from "vitest";

import { parseCss } from "./css-tree";

describe("parseCss", () => {
  it("reads rules, declarations and nested at-rules in source order", () => {
    const css = `
      /*! banner */
      @layer properties;
      .bg-primary\\/80 {
        background-color: var(--primary);
        @supports (color: color-mix(in lab, red, red)) {
          background-color: color-mix(in oklab, var(--primary) 80%, transparent);
        }
      }
      .p-0 { padding: 0px }
    `;
    expect(parseCss(css)).toEqual([
      { type: "at-rule", name: "layer", params: "properties", children: undefined },
      {
        type: "rule",
        selector: ".bg-primary\\/80",
        children: [
          { type: "declaration", property: "background-color", value: "var(--primary)" },
          {
            type: "at-rule",
            name: "supports",
            params: "(color: color-mix(in lab, red, red))",
            children: [
              {
                type: "declaration",
                property: "background-color",
                value: "color-mix(in oklab, var(--primary) 80%, transparent)",
              },
            ],
          },
        ],
      },
      {
        type: "rule",
        selector: ".p-0",
        children: [{ type: "declaration", property: "padding", value: "0px" }],
      },
    ]);
  });

  it("keeps braces, semicolons and colons inside strings, brackets and parentheses", () => {
    const css = `.\\[\\&_svg\\:not\\(\\[class\\*\\=\\'size-\\'\\]\\)\\]\\:size-4 svg:not([class*='size-']) { content: "a;b{c}"; width: calc(0.25rem * 4); }`;
    expect(parseCss(css)).toEqual([
      {
        type: "rule",
        selector: ".\\[\\&_svg\\:not\\(\\[class\\*\\=\\'size-\\'\\]\\)\\]\\:size-4 svg:not([class*='size-'])",
        children: [
          { type: "declaration", property: "content", value: '"a;b{c}"' },
          { type: "declaration", property: "width", value: "calc(0.25rem * 4)" },
        ],
      },
    ]);
  });

  it("reads the at-rule blocks Tailwind emits for registered properties", () => {
    expect(parseCss("@property --tw-ring-offset-width { syntax: '<length>'; initial-value: 0px; }")).toEqual([
      {
        type: "at-rule",
        name: "property",
        params: "--tw-ring-offset-width",
        children: [
          { type: "declaration", property: "syntax", value: "'<length>'" },
          { type: "declaration", property: "initial-value", value: "0px" },
        ],
      },
    ]);
  });

  it("throws on an unbalanced block", () => {
    expect(() => parseCss(".a { color: red;")).toThrow(/unclosed/);
    expect(() => parseCss(".a { color: red; } }")).toThrow(/unexpected/);
  });
});
