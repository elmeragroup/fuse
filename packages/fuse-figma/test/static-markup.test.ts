/**
 * Reading the HTML `renderToStaticMarkup` writes. Unit under test: `elementsOf`. Oracle: the
 * string React rendered, which an element's own text and its attribute values must read back as,
 * though React escapes `&`, `<`, `>`, `"` and `'` when it writes them.
 */
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { elementsOf, selects } from "./static-markup";

describe("elementsOf", () => {
  it("reads an element's own text and its attribute values back as the strings React rendered", () => {
    // `&lt;` stays as written: React writes it as `&amp;lt;`, which decodes once.
    const text = `Save & close <now> "quoted" it's &lt;`;
    const [element] = elementsOf(renderToStaticMarkup(createElement("span", { title: text }, text)));
    expect([element?.text, element?.attributes.get("title")]).toEqual([text, text]);
  });

  // Oracle: the HTML parser, which reads an HTML element's attribute names in lowercase, so the
  // `readOnly` React writes is the `readonly` attribute `[readonly]` selects.
  it("reads attribute names in lowercase, as an HTML parser does", () => {
    const [element] = elementsOf(renderToStaticMarkup(createElement("input", { readOnly: true })));
    expect([...(element?.attributes.keys() ?? [])]).toEqual(["readonly"]);
  });
});

// Unit under test: `selects` with an attribute prefix and with the universal tag. Oracle: the CSS
// attribute selector `[aria-label^="Tuesday, July 14"]` (Selectors Level 4 §6.2), which matches a
// value that starts with the prefix, and nothing when the prefix is empty, and the universal
// selector `*` (§5.2), which matches an element of any tag, as the browser applies them.
describe("selects", () => {
  const labelled = (label: string) =>
    elementsOf(renderToStaticMarkup(createElement("div", { "aria-label": label, role: "button" })))[0] ?? {
      name: "",
      attributes: new Map<string, string>(),
    };

  const byPrefix = (name: string, prefix: string) => ({
    tag: "div",
    attributes: { role: "button" },
    prefixes: { [name]: prefix },
  });

  it("matches an attribute whose value starts with a prefix, and no other", () => {
    const selector = byPrefix("aria-label", "Tuesday, July 14");
    expect(selects(selector, labelled("Tuesday, July 14, 2026"))).toBe(true);
    expect(selects(selector, labelled("Tuesday, July 14, 2026 selected"))).toBe(true);
    expect(selects(selector, labelled("Today, Tuesday, July 14, 2026"))).toBe(false);
    expect(selects(byPrefix("title", "Tuesday"), labelled("Tuesday"))).toBe(false);
  });

  it("matches nothing by an empty prefix, as CSS does", () => {
    expect(selects(byPrefix("aria-label", ""), labelled("Tuesday"))).toBe(false);
  });

  // `[data-slot$="-label"]` (Selectors Level 4 §6.2) matches a value that ends with the suffix, and
  // nothing when the suffix is empty.
  it("matches an attribute whose value ends with a suffix, and no other, and nothing by an empty one", () => {
    const bySuffix = (suffix: string) => ({ tag: "div", attributes: {}, suffixes: { "aria-label": suffix } });
    expect(selects(bySuffix("-label"), labelled("select-label"))).toBe(true);
    expect(selects(bySuffix("-label"), labelled("dropdown-menu-label"))).toBe(true);
    expect(selects(bySuffix("-label"), labelled("select-label-text"))).toBe(false);
    expect(selects(bySuffix(""), labelled("select-label"))).toBe(false);
  });

  it("matches an element of any tag by the universal tag, still by its attributes", () => {
    const element = (tag: string, props: Readonly<Record<string, string>>) =>
      elementsOf(renderToStaticMarkup(createElement(tag, props)))[0] ?? {
        name: "",
        attributes: new Map<string, string>(),
      };
    const anyRac = { tag: "*", attributes: { "data-rac": true } } as const;
    expect(selects(anyRac, element("a", { "data-rac": "" }))).toBe(true);
    expect(selects(anyRac, element("span", { "data-rac": "", role: "link" }))).toBe(true);
    expect(selects(anyRac, element("a", { href: "#" }))).toBe(false);
  });
});
