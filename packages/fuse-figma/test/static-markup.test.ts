/**
 * Reading the HTML `renderToStaticMarkup` writes. Unit under test: `elementsOf`. Oracle: the
 * string React rendered, which an element's own text must read back as, though React escapes
 * `&`, `<`, `>`, `"` and `'` when it writes text.
 */
import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { elementsOf } from "./static-markup";

describe("elementsOf", () => {
  it("reads an element's own text back as the string React rendered", () => {
    // `&lt;` stays as written: React writes it as `&amp;lt;`, which decodes once.
    const text = `Save & close <now> "quoted" it's &lt;`;
    const [element] = elementsOf(renderToStaticMarkup(createElement("span", null, text)));
    expect(element?.text).toBe(text);
  });
});
