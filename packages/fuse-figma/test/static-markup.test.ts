/**
 * Reading the HTML `renderToStaticMarkup` writes. Unit under test: `elementsOf`. Oracle: the
 * string React rendered, which an element's own text and its attribute values must read back as,
 * though React escapes `&`, `<`, `>`, `"` and `'` when it writes them.
 */
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { elementsOf } from "./static-markup";

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
