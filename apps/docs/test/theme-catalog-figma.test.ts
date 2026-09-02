import { describe, expect, it } from "vitest";

import {
  buildFigmaThemeIndex,
  figmaDocumentFromCatalog,
  figmaThemeArtifacts,
} from "../scripts/lib/theme-catalog-figma.ts";
import { THEME_CATALOG } from "../src/generated/theme-catalog";
import { FIGMA_THEME_FILES, FIGMA_THEME_INDEX } from "../src/generated/theme-catalog-figma";
import type {
  FigmaColorToken,
  FigmaDimensionToken,
  FigmaFontToken,
  ThemeCatalogEntry,
} from "../src/lib/docs-model";
import { docsBaseUrl } from "./docs-server";

const ILLEGAL_SLUGS = [
  "internal-fkab-private",
  "external-fkab-private",
  "internal-fkse-company",
  "external-fkse-company",
] as const;

function catalogTheme(slug: string): ThemeCatalogEntry {
  const theme = THEME_CATALOG.themes.find((entry) => entry.slug === slug);
  expect(theme, slug).toBeDefined();
  if (theme === undefined) {
    throw new Error(`missing theme ${slug}`);
  }
  return theme;
}

function token<T extends { $type: string; $value: unknown }>(
  group: { readonly [name: string]: string | T | undefined },
  name: string
): T {
  const value = group[name];
  if (value instanceof Object && "$value" in value) {
    return value;
  }
  throw new Error(`expected token "${name}"`);
}

describe("Figma DTCG documents", () => {
  it("emits one file per legal theme with a shared token name set", () => {
    const slugs = FIGMA_THEME_INDEX.files.map((file) => file.slug);
    expect(slugs).toHaveLength(20);
    expect(FIGMA_THEME_INDEX.files).toHaveLength(20);
    expect(FIGMA_THEME_INDEX.format).toBe("figma");
    for (const slug of ILLEGAL_SLUGS) {
      expect(slugs).not.toContain(slug);
    }

    const internal = FIGMA_THEME_FILES["internal-fkas-private"];
    expect(internal).toBeDefined();
    if (internal === undefined) {
      throw new Error("missing Figma document internal-fkas-private");
    }
    const names = Object.keys(internal.color).filter((key) => key !== "$type");
    expect(names.length).toBeGreaterThan(70);
    for (const slug of slugs) {
      const file = FIGMA_THEME_FILES[slug];
      expect(file).toBeDefined();
      if (file === undefined) {
        throw new Error(`missing Figma document ${slug}`);
      }
      expect(Object.keys(file.color).filter((key) => key !== "$type")).toEqual(names);
      expect(file.color.$type).toBe("color");
      expect(file.size.$type).toBe("dimension");
      expect(file.font.$type).toBe("fontFamily");
    }
  });

  it("converts CSS-honest values into Figma-importable DTCG", () => {
    const document = figmaDocumentFromCatalog(
      catalogTheme("external-fkas-private"),
      THEME_CATALOG.primitives
    );
    expect(token<FigmaColorToken>(document.color, "brand")).toEqual({
      $type: "color",
      $value: "{color.brand-fkas}",
    });
    expect(token<FigmaColorToken>(document.color, "primary-foreground")).toEqual({
      $type: "color",
      $value: {
        colorSpace: "srgb",
        components: [1, 1, 1],
        alpha: 1,
        hex: "#FFFFFF",
      },
    });
    expect(token<FigmaColorToken>(document.color, "destructive")).toEqual({
      $type: "color",
      $value: "{color.error}",
    });
    expect(token<FigmaColorToken>(document.color, "sidebar-brand")).toEqual({
      $type: "color",
      $value: "{color.brand}",
    });
    expect(token<FigmaColorToken>(document.color, "brand-fkab")).toEqual({
      $type: "color",
      $value: "{color.brand-fkas}",
    });
    expect(token<FigmaDimensionToken>(document.size, "radius")).toEqual({
      $type: "dimension",
      $value: { value: 12, unit: "px" },
    });
    expect(token<FigmaFontToken>(document.font, "sans")).toEqual({ $type: "fontFamily", $value: "Roboto" });
    expect(token<FigmaFontToken>(document.font, "heading")).toEqual({
      $type: "fontFamily",
      $value: "Neo Sans",
    });
  });

  it("emits a typed FIGMA_THEME_FILES const without chained assertions", () => {
    const module = figmaThemeArtifacts(THEME_CATALOG).indexModule;
    expect(module).toContain(
      "export const FIGMA_THEME_FILES: { readonly [slug: string]: FigmaThemeDocument } = {"
    );
    expect(module).not.toContain("as unknown as");
    expect(module).not.toMatch(/\bas\s+/);
    expect(module).not.toContain('from "./figma/');
  });

  it("is a projection of the catalog", () => {
    expect(buildFigmaThemeIndex(THEME_CATALOG)).toEqual(FIGMA_THEME_INDEX);
    expect(FIGMA_THEME_INDEX.files.map((file) => file.slug)).toEqual(
      THEME_CATALOG.themes.map((theme) => theme.slug)
    );
    expect(Object.keys(FIGMA_THEME_FILES)).toEqual(THEME_CATALOG.themes.map((theme) => theme.slug));
    expect(figmaDocumentFromCatalog(catalogTheme("external-fkas-private"), THEME_CATALOG.primitives)).toEqual(
      FIGMA_THEME_FILES["external-fkas-private"]
    );
    for (const theme of THEME_CATALOG.themes) {
      expect(figmaDocumentFromCatalog(theme, THEME_CATALOG.primitives)).toEqual(
        FIGMA_THEME_FILES[theme.slug]
      );
    }
  });
});

describe("GET /api/themes/figma", () => {
  it("returns the index of per-mode files", async () => {
    const response = await fetch(new URL("/api/themes/figma", docsBaseUrl()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toEqual(FIGMA_THEME_INDEX);
    expect(FIGMA_THEME_INDEX.files[0]?.href).toBe("/api/themes/figma/internal-fkas-private");
  });

  it("returns DTCG JSON for a legal slug", async () => {
    const response = await fetch(new URL("/api/themes/figma/external-fkas-private", docsBaseUrl()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/design-tokens+json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="external-fkas-private.tokens.json"'
    );
    const body: unknown = await response.json();
    expect(body).toEqual(FIGMA_THEME_FILES["external-fkas-private"]);
  });

  it("404s an illegal slug", async () => {
    const response = await fetch(new URL("/api/themes/figma/internal-fkab-private", docsBaseUrl()));
    expect(response.status).toBe(404);
  });
});
