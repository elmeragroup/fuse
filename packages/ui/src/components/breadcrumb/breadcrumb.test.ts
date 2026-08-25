import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";
import { breadcrumbStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "breadcrumb.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "breadcrumb.ts"), "utf8");

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

describe("breadcrumb dictionary", () => {
  it("owns the locked breadcrumb.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(breadcrumbStrings.getStringForLocale("landmark", locale), locale).toBe(LANDMARK_COPY[locale]);
      expect(breadcrumbStrings.getStringForLocale("more", locale), locale).toBe(MORE_COPY[locale]);
    }
  });

  it("carries no key beyond the two rows accessibility.md §4.1 assigns to Breadcrumb", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(breadcrumbStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "landmark",
        "more",
      ]);
    }
  });
});

describe("breadcrumb source contract", () => {
  it("is a client namespace with no recipe, no as prop, and no locale prop", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("destructive");
    expect(source).not.toContain("forwardRef");
    expect(source).not.toContain('from "../react-aria');
    expect(source).not.toContain("tv(");
    expect(source).not.toContain("breadcrumbVariants");
    expect(source).not.toContain("lucide");
    expect(source).not.toContain("ChevronRight");
    expect(source).not.toContain("MoreHorizontal");
    expect(source).toContain("CaretRight");
    expect(source).toContain("DotsThree");
    expect(source).toContain("useLocalizedStrings");
    expect(source).toContain("useRender");
    expect(source).toContain("mergeProps");
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).toContain('defaultTagName: "a"');
    expect(source).toContain('slot: "breadcrumb-link"');
    expect(source).not.toContain('data-slot="breadcrumb-link"');
    expect(source).toContain('role="link"');
    expect(source).toContain('aria-disabled="true"');
    expect(source).toContain('aria-current="page"');
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { Breadcrumb } from "./components/breadcrumb/breadcrumb"');
    expect(facade).not.toContain("breadcrumbVariants");
    expect(facade).not.toContain("BreadcrumbList");
    expect(facade).not.toContain("BreadcrumbItem");
    expect(facade).not.toContain("BreadcrumbLink");
    expect(source).toContain('displayName = "Breadcrumb.Root"');
    expect(source).toContain('displayName = "Breadcrumb.List"');
    expect(source).toContain('displayName = "Breadcrumb.Item"');
    expect(source).toContain('displayName = "Breadcrumb.Link"');
    expect(source).toContain('displayName = "Breadcrumb.Page"');
    expect(source).toContain('displayName = "Breadcrumb.Separator"');
    expect(source).toContain('displayName = "Breadcrumb.Ellipsis"');
  });

  it("emits data-slot before the props spread on every non-useRender part", () => {
    for (const slot of [
      "breadcrumb",
      "breadcrumb-list",
      "breadcrumb-item",
      "breadcrumb-page",
      "breadcrumb-separator",
      "breadcrumb-ellipsis",
    ]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });

  it("takes Link's ring from the shared self adapter and defines no ring literal", () => {
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).not.toContain("ring-ring");
    for (const token of focusRing({ target: "self" }).root().split(/\s+/).filter(Boolean)) {
      expect(source, token).not.toContain(token);
    }
  });
});
