import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_CODES, BRANDS } from "../theme/tokens/themes";
import { BrandLogo } from "./brand-logo";

const iconsSpec = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../docs/spec/icons.md"),
  "utf8"
);

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

  it("maps energy brands to their display names", () => {
    expect(renderToStaticMarkup(createElement(BrandLogo, { brand: "fkas" }))).toContain("Fjordkraft");
    expect(renderToStaticMarkup(createElement(BrandLogo, { brand: "fkab" }))).toContain("Fjordkraft");
    expect(renderToStaticMarkup(createElement(BrandLogo, { brand: "tkas" }))).toContain("TrøndelagKraft");
    expect(renderToStaticMarkup(createElement(BrandLogo, { brand: "guen" }))).toContain(
      "Gudbrandsdal Energi"
    );
    expect(renderToStaticMarkup(createElement(BrandLogo, { brand: "fkse" }))).toContain("Telinet");
    expect(renderToStaticMarkup(createElement(BrandLogo, { brand: "elma" }))).toContain("Elmera");
  });

  it("applies advertised fallback-host props on the rendered span", () => {
    const html = renderToStaticMarkup(
      createElement(BrandLogo, {
        brand: "elma",
        variant: "mark",
        title: "Elmera Group",
        id: "brand-logo",
        className: "logo",
        lang: "nb",
        hidden: true,
        style: { color: "red" },
        tabIndex: 0,
      })
    );

    expect(html).toContain("<span");
    expect(html).toContain('id="brand-logo"');
    expect(html).toContain('class="logo"');
    expect(html).toContain('lang="nb"');
    expect(html).toContain("hidden");
    expect(html).toContain("color:red");
    expect(html).toContain("tabindex=\"0\"");
    expect(html).toContain('data-variant="mark"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Elmera Group"');
    expect(html).toContain("Elmera");
    expect(html).not.toContain("<svg");
  });

  it("documents BrandLogo as the fallback-host contract in icons.md §4", () => {
    const start = iconsSpec.indexOf("## 4 Logos and illustrations");
    const end = iconsSpec.indexOf("## 5 Flags");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const section = iconsSpec.slice(start, end);

    expect(section).toMatch(/type BrandLogoProps = Omit<ComponentPropsWithoutRef<"span">, "children">/);
    expect(section).toContain('brand: ThemeInput["brand"]');
    expect(section).toContain('variant?: "full" | "mark"');
    expect(section).toContain("title?: string");
    expect(section).not.toMatch(/type BrandLogoProps = Omit<LogoProps/);
    expect(section).toMatch(/fallback host|display-name fallback|<span>/);
  });
});
