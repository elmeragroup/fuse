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

// Unit under test: `selects` with an attribute prefix. Oracle: the CSS attribute selector
// `[aria-label^="Tuesday, July 14"]` (Selectors Level 4 §6.2), which matches a value that starts
// with the prefix, and nothing when the prefix is empty, as the browser applies it.
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
});
