import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { TOKEN_NAMES } from "../scripts/lib/theme-catalog.ts";
import { THEME_CATALOG } from "../src/generated/theme-catalog";
import type { ThemeCatalogEntry } from "../src/lib/docs-model";
import { docsBaseUrl } from "./docs-server";

const here = dirname(fileURLToPath(import.meta.url));
const appsRoot = join(here, "../../");

/** The four permutations the pin table forbids. */
const ILLEGAL_SLUGS = [
  "internal-fkab-private",
  "external-fkab-private",
  "internal-fkse-company",
  "external-fkse-company",
] as const;

const ROLE_TOKEN_COUNT = 77;

function catalogTheme(slug: string): ThemeCatalogEntry {
  const theme = THEME_CATALOG.themes.find((entry) => entry.slug === slug);
  expect(theme, slug).toBeDefined();
  if (theme === undefined) {
    throw new Error(`missing theme ${slug}`);
  }
  return theme;
}

describe("theme catalog payload", () => {
  it("emits one row per legal theme, never an illegal slug", () => {
    expect(THEME_CATALOG.legalThemeCount).toBe(20);
    expect(THEME_CATALOG.themes).toHaveLength(20);
    const slugs = THEME_CATALOG.themes.map((theme) => theme.slug);
    expect(new Set(slugs).size).toBe(20);
    for (const slug of ILLEGAL_SLUGS) {
      expect(slugs).not.toContain(slug);
    }
  });

  it("locks density to variant and stamps matching attributes on every row", () => {
    expect(TOKEN_NAMES).toHaveLength(ROLE_TOKEN_COUNT);
    const tokenKeys = TOKEN_NAMES.map((name) => `--${name}`);
    for (const theme of THEME_CATALOG.themes) {
      const density = theme.variant === "internal" ? "dense" : "comfortable";
      expect(theme.density).toBe(density);
      expect(theme.attributes).toEqual({
        "data-theme-variant": theme.variant,
        "data-theme-brand": theme.brand,
        "data-theme-segment": theme.segment,
        "data-density": density,
      });
      const keys = Object.keys(theme.tokens);
      expect(keys).toHaveLength(ROLE_TOKEN_COUNT);
      expect(keys).toEqual(tokenKeys);
      for (const name of keys) {
        expect(name.startsWith("--")).toBe(true);
      }
    }
  });

  it("names the variant on the same object as that theme's token values", () => {
    const external = catalogTheme("external-fkas-private");
    expect(external.variant).toBe("external");
    expect(external.brand).toBe("fkas");
    expect(external.segment).toBe("private");
    expect(external.density).toBe("comfortable");
    expect(external.tokens["--primary"]).toBe("oklch(0.4848 0.16637 35.92)");
    expect(external.tokens["--primary-foreground"]).toBe("oklch(1 0 0)");

    const internal = catalogTheme("internal-elma-private");
    expect(internal.variant).toBe("internal");
    expect(internal.brand).toBe("elma");
    expect(internal.segment).toBe("private");
    expect(internal.density).toBe("dense");
    expect(internal.tokens["--primary"]).toBe("oklch(0.16 0 0)");
    expect(internal.tokens["--primary-foreground"]).toBe("oklch(1 0 0)");
  });

  it("keeps CSS custom-property names and var() values as the cascade writes them", () => {
    const theme = catalogTheme("external-fkas-private");
    expect(theme.attributes).toEqual({
      "data-theme-variant": "external",
      "data-theme-brand": "fkas",
      "data-theme-segment": "private",
      "data-density": "comfortable",
    });
    expect(theme.tokens["--brand"]).toBe("var(--brand-fkas)");
    expect(theme.tokens["--brand-foreground"]).toBe("var(--brand-fkas-foreground)");
    expect(theme.tokens["--destructive"]).toBe("var(--error)");
    expect(theme.tokens["--sidebar-brand"]).toBe("var(--brand)");

    expect(THEME_CATALOG.primitives["--brand-fkas"]).toBe("oklch(0.68 0.21747 38.8)");
    expect(THEME_CATALOG.primitives["--brand-fkab"]).toBe("var(--brand-fkas)");
  });
});

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const DEEP_FUSE_SRC_IMPORT = /(?:from|import)\s+["'][^"']*packages\/fuse\/src/;

function walkSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    // Inspect authored source only; build output can contain entire bundled dependencies.
    if (["node_modules", "generated", ".next", "dist", ".turbo"].includes(entry)) {
      continue;
    }
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      files.push(...walkSourceFiles(absolute));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      files.push(absolute);
    }
  }
  return files;
}

describe("workspace package boundary", () => {
  it("does not deep-import packages/fuse/src from apps", () => {
    const offenders = walkSourceFiles(appsRoot)
      .filter((file) => DEEP_FUSE_SRC_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(appsRoot.length));
    expect(offenders).toEqual([]);
  });

  it("does not list transpilePackages in the docs host", () => {
    expect(readFileSync(join(appsRoot, "docs/next.config.ts"), "utf8")).not.toContain("transpilePackages");
  });
});

describe("GET /api/themes", () => {
  it("returns the catalog as JSON", async () => {
    const response = await fetch(new URL("/api/themes", docsBaseUrl()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toEqual(THEME_CATALOG);
  });
});
