import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { paginationStrings } from "./intl";
import { paginationVariants } from "./pagination-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "pagination.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "pagination-variants.ts"), "utf8");
const facade = readFileSync(join(here, "..", "..", "pagination.ts"), "utf8");

const LANDMARK_COPY = {
  "nb-NO": "Sidenavigasjon",
  "sv-SE": "Sidnavigering",
  "en-US": "Pagination",
  "fi-FI": "Sivutus",
} as const;

const PREVIOUS_COPY = {
  "nb-NO": "Forrige",
  "sv-SE": "Föregående",
  "en-US": "Previous",
  "fi-FI": "Edellinen",
} as const;

const NEXT_COPY = {
  "nb-NO": "Neste",
  "sv-SE": "Nästa",
  "en-US": "Next",
  "fi-FI": "Seuraava",
} as const;

const GO_TO_PREVIOUS_COPY = {
  "nb-NO": "Gå til forrige side",
  "sv-SE": "Gå till föregående sida",
  "en-US": "Go to previous page",
  "fi-FI": "Siirry edelliselle sivulle",
} as const;

const GO_TO_NEXT_COPY = {
  "nb-NO": "Gå til neste side",
  "sv-SE": "Gå till nästa sida",
  "en-US": "Go to next page",
  "fi-FI": "Siirry seuraavalle sivulle",
} as const;

const MORE_PAGES_COPY = {
  "nb-NO": "Flere sider",
  "sv-SE": "Fler sidor",
  "en-US": "More pages",
  "fi-FI": "Lisää sivuja",
} as const;

describe("pagination dictionary", () => {
  it("owns the locked pagination.* copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(paginationStrings.getStringForLocale("landmark", locale), locale).toBe(LANDMARK_COPY[locale]);
      expect(paginationStrings.getStringForLocale("previous", locale), locale).toBe(PREVIOUS_COPY[locale]);
      expect(paginationStrings.getStringForLocale("next", locale), locale).toBe(NEXT_COPY[locale]);
      expect(paginationStrings.getStringForLocale("goToPrevious", locale), locale).toBe(
        GO_TO_PREVIOUS_COPY[locale]
      );
      expect(paginationStrings.getStringForLocale("goToNext", locale), locale).toBe(GO_TO_NEXT_COPY[locale]);
      expect(paginationStrings.getStringForLocale("morePages", locale), locale).toBe(MORE_PAGES_COPY[locale]);
    }
  });

  it("carries no key beyond the six rows accessibility.md §4.1 assigns to Pagination", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(paginationStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "goToNext",
        "goToPrevious",
        "landmark",
        "morePages",
        "next",
        "previous",
      ]);
    }
  });
});

describe("paginationVariants", () => {
  it("adds chevron-side padding only when direction is passed internally", () => {
    const undirected = paginationVariants();
    expect(undirected.link()).toContain("gap-1");
    expect(undirected.link()).not.toContain("pl-2.5");
    expect(undirected.link()).not.toContain("pr-2.5");
    expect(paginationVariants({ direction: "previous" }).link()).toContain("pl-2.5");
    expect(paginationVariants({ direction: "next" }).link()).toContain("pr-2.5");
  });

  it("keeps the spec-named layout slots and drops the dead item/button slots", () => {
    const slots = paginationVariants();
    expect(slots.base()).toContain("mx-auto");
    expect(slots.content()).toContain("flex-row");
    expect(slots.linkIcon()).toContain("size-4");
    expect(slots.ellipsis()).toContain("size-9");
    expect(slots.ellipsisIcon()).toContain("size-4");
    expect(variantsSource).not.toContain("item:");
    expect(variantsSource).not.toContain("button:");
    expect(variantsSource).toContain("defaultVariants: {}");
    expect(variantsSource).toContain("pl-2.5");
    expect(variantsSource).toContain("pr-2.5");
  });

  it("covers every slot without raw palette, dark, or density variants", () => {
    const resolved = [
      paginationVariants().base(),
      paginationVariants().content(),
      paginationVariants().link(),
      paginationVariants({ direction: "previous" }).link(),
      paginationVariants({ direction: "next" }).link(),
      paginationVariants().linkIcon(),
      paginationVariants().ellipsis(),
      paginationVariants().ellipsisIcon(),
    ];
    for (const className of resolved) {
      expect(className.length).toBeGreaterThan(0);
      expect(className).not.toContain("dark:");
      expect(className).not.toMatch(RAW_PALETTE_RE);
      expect(className).not.toMatch(/\b(?:dense|comfortable):/);
      expect(className).not.toContain("destructive");
    }
  });
});

describe("pagination source contract", () => {
  it("is a client namespace that emits data-slot before the props spread", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(source).not.toContain("destructive");
    expect(source).not.toContain("forwardRef");
    expect(source).not.toContain('from "../react-aria');
    expect(source).not.toContain("Span");
    expect(source).toContain("CaretLeft");
    expect(source).toContain("CaretRight");
    expect(source).toContain("DotsThree");
    expect(source).toContain("useLocalizedStrings");
    expect(source).toContain('size = "icon"');
    expect(source).toContain('size = "default"');
    expect(source).toContain('isActive ? "outline" : "ghost"');
    expect(source).toContain('isActive ? "page" : undefined');
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain('export { Pagination } from "./components/pagination/pagination"');
    expect(facade).toContain(
      'export { paginationVariants } from "./components/pagination/pagination-variants"'
    );
    expect(facade).not.toContain("PaginationLink");
    expect(facade).not.toContain("PaginationPrevious");
    expect(source).toContain('displayName = "Pagination.Root"');
    expect(source).toContain('displayName = "Pagination.Content"');
    expect(source).toContain('displayName = "Pagination.Item"');
    expect(source).toContain('displayName = "Pagination.Link"');
    expect(source).toContain('displayName = "Pagination.Previous"');
    expect(source).toContain('displayName = "Pagination.Next"');
    expect(source).toContain('displayName = "Pagination.Ellipsis"');
    for (const slot of [
      "pagination",
      "pagination-content",
      "pagination-item",
      "pagination-link",
      "pagination-previous",
      "pagination-next",
      "pagination-ellipsis",
    ]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });
});
