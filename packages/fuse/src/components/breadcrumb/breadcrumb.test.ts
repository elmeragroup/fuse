import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { Breadcrumb } from "./index";
import { breadcrumbStrings } from "./intl";

describe("breadcrumb link classes", () => {
  it("hovers to the foreground token", () => {
    const html = renderToStaticMarkup(createElement(Breadcrumb.Link, { href: "/" }, "Home"));
    expect(html).toContain("hover:text-foreground");
  });
});

describe("breadcrumb dictionary", () => {
  it("carries no key beyond the two rows owned by Breadcrumb", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(breadcrumbStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "landmark",
        "more",
      ]);
    }
  });
});
