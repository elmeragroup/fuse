import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_CODES, BRANDS } from "../theme/tokens/themes";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("renders an accessible display-name fallback for elma full and mark", () => {
    const full = renderToStaticMarkup(createElement(BrandLogo, { brand: "elma", variant: "full" }));
    const mark = renderToStaticMarkup(createElement(BrandLogo, { brand: "elma", variant: "mark" }));

    expect(full).toContain("Elmera");
    expect(mark).toContain("Elmera");
    expect(full).toContain('role="img"');
    expect(full).toContain('aria-label="Elmera"');
    expect(mark).toContain('aria-label="Elmera"');
    expect(full).not.toContain("<svg");
    expect(mark).not.toContain("<svg");
    expect(full).not.toContain("<path");
    expect(mark).not.toContain("<path");
  });

  it("uses an explicit title as the accessible name without inventing a mark", () => {
    const html = renderToStaticMarkup(
      createElement(BrandLogo, { brand: "elma", variant: "mark", title: "Elmera Group" })
    );
    expect(html).toContain("Elmera");
    expect(html).toContain('aria-label="Elmera Group"');
    expect(html).not.toContain("<svg");
  });

  it("is exhaustive over every brand code", () => {
    expect(BRAND_CODES).toContain("elma");
    for (const brand of BRAND_CODES) {
      const html = renderToStaticMarkup(createElement(BrandLogo, { brand, variant: "full" }));
      expect(html).toContain(BRANDS[brand].displayName);
      expect(html).toContain("<span");
      expect(html).not.toContain("<svg");
    }
  });
});
