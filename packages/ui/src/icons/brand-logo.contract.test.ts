import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const iconsSpec = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../docs/spec/icons.md"),
  "utf8"
);

describe("BrandLogo icons.md §4 contract", () => {
  it("documents BrandLogo as the accessible fallback-host contract", () => {
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
  });

  it("keeps the data-variant stamp documented for the SVG-mark swap", () => {
    const start = iconsSpec.indexOf("## 4 Logos and illustrations");
    const end = iconsSpec.indexOf("## 5 Flags");
    const section = iconsSpec.slice(start, end);

    expect(section).toContain("data-variant");
  });
});
