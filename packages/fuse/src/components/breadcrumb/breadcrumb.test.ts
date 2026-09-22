import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { Breadcrumb } from "./breadcrumb";
import { breadcrumbStrings } from "./intl";

const LANDMARK_COPY = {
  "nb-NO": "Brødsmuler",
  "sv-SE": "Brödsmulor",
  "en-US": "Breadcrumb",
  "fi-FI": "Murupolku",
} as const;

const MORE_COPY = {
  "nb-NO": "Mer",
  "sv-SE": "Mer",
  "en-US": "More",
  "fi-FI": "Lisää",
} as const;

describe("breadcrumb link classes", () => {
  it("hovers to the foreground token", () => {
    const html = renderToStaticMarkup(createElement(Breadcrumb.Link, { href: "/" }, "Home"));
    expect(html).toContain("hover:text-foreground");
  });
});

describe("breadcrumb dictionary", () => {
  it("owns the locked breadcrumb.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(breadcrumbStrings.getStringForLocale("landmark", locale), locale).toBe(LANDMARK_COPY[locale]);
      expect(breadcrumbStrings.getStringForLocale("more", locale), locale).toBe(MORE_COPY[locale]);
    }
  });

  it("carries no key beyond the two rows owned by Breadcrumb", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(breadcrumbStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "landmark",
        "more",
      ]);
    }
  });
});
