import { createElement } from "react";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER,
  resolveColorSchemeOptions,
} from "./color-scheme";
import type { ColorSchemeBootstrapManifest } from "./color-scheme";
import {
  COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE,
  COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE,
  colorSchemeBootstrapMismatchMessage,
  diagnoseColorSchemeBootstrap,
} from "./color-scheme-diagnostics";
import { colorSchemeScriptSource } from "./color-scheme-script";
import {
  documentBrandDisagrees,
  documentBrandMismatchMessage,
  warnDocumentBrandMismatch,
} from "./document-brand";
import { themeAttributes } from "./theme-attributes";
import { ThemeProvider, useTheme } from "./theme-provider";
import { BRANDS, LEGAL_THEMES, parseThemeSlug, themeSlug } from "./tokens/themes";
import type { ThemeInput } from "./tokens/themes";
import { useColorScheme } from "./use-color-scheme";
import { isThemeDevelopment, validateTheme } from "./validate-theme";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...walkSourceFiles(path));
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("themeSlug / parseThemeSlug", () => {
  it("is a total inverse over the 20 legal themes", () => {
    expect(LEGAL_THEMES).toHaveLength(20);
    for (const theme of LEGAL_THEMES) {
      expect(parseThemeSlug(themeSlug(theme))).toEqual(theme);
    }
  });

  it("returns null for malformed slugs and illegal pinned combinations", () => {
    expect(parseThemeSlug("internal-fkab-private")).toBeNull();
    expect(parseThemeSlug("external-fkse-company")).toBeNull();
    expect(parseThemeSlug("internal-fkas-private-extra")).toBeNull();
    expect(parseThemeSlug("INTERNAL-fkas-private")).toBeNull();
    expect(parseThemeSlug("internal-zz-private")).toBeNull();
    expect(parseThemeSlug("")).toBeNull();
    expect(parseThemeSlug("external-fkas-private")).toEqual({
      variant: "external",
      brand: "fkas",
      segment: "private",
    });
    expect(parseThemeSlug("internal-elma-private")).toEqual({
      variant: "internal",
      brand: "elma",
      segment: "private",
    });
    expect(parseThemeSlug("external-elma-company")).toEqual({
      variant: "external",
      brand: "elma",
      segment: "company",
    });
  });
});

describe("validateTheme", () => {
  it("accepts every legal theme", () => {
    for (const theme of LEGAL_THEMES) {
      expect(validateTheme(theme)).toEqual(theme);
    }
  });

  it("rejects non-objects and unknown or missing axes in every environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateTheme(null)).toThrow(/expected an object/);
    expect(() => validateTheme("external-fkas-private")).toThrow(/expected an object/);
    expect(() => validateTheme({ variant: "internal", brand: "fkas" })).toThrow(/unknown or missing/);
    expect(() => validateTheme({ variant: "internal", brand: "zz", segment: "private" })).toThrow(
      /unknown or missing/
    );
  });

  it("throws on pinned-segment mistakes outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => validateTheme({ variant: "internal", brand: "fkab", segment: "private" })).toThrow(/fkab/);
    expect(() => validateTheme({ variant: "external", brand: "fkse", segment: "company" })).toThrow(/fkse/);
  });

  it("coerces pinned-segment mistakes in production and warns once per invocation", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(validateTheme({ variant: "internal", brand: "fkab", segment: "private" })).toEqual({
      variant: "internal",
      brand: "fkab",
      segment: "company",
    });
    expect(warn).toHaveBeenCalledTimes(1);

    expect(validateTheme({ variant: "external", brand: "fkse", segment: "company" })).toEqual({
      variant: "external",
      brand: "fkse",
      segment: "private",
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("document brand mismatch", () => {
  const expected = themeAttributes({ variant: "internal", brand: "fkas", segment: "private" });
  const matching = {
    "data-theme-variant": "internal",
    "data-theme-brand": "fkas",
    "data-theme-segment": "private",
  } as const;
  const mismatching = {
    "data-theme-variant": "external",
    "data-theme-brand": "tkas",
    "data-theme-segment": "company",
  } as const;
  const missing = {
    "data-theme-variant": null,
    "data-theme-brand": null,
    "data-theme-segment": null,
  };

  it("treats missing server attributes as no disagreement", () => {
    expect(documentBrandDisagrees(missing, expected)).toBe(false);
    expect(documentBrandDisagrees(matching, expected)).toBe(false);
    expect(documentBrandDisagrees(mismatching, expected)).toBe(true);
    expect(documentBrandDisagrees({ ...matching, "data-theme-brand": null }, expected)).toBe(true);
  });

  it("warns in development and stays silent in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.stubEnv("NODE_ENV", "development");
    expect(isThemeDevelopment()).toBe(true);
    warnDocumentBrandMismatch(mismatching, expected);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(documentBrandMismatchMessage(mismatching, expected));

    warn.mockClear();
    warnDocumentBrandMismatch(matching, expected);
    warnDocumentBrandMismatch(missing, expected);
    expect(warn).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "production");
    expect(isThemeDevelopment()).toBe(false);
    warnDocumentBrandMismatch(mismatching, expected);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("themeAttributes", () => {
  it("returns the three data attributes for a validated theme", () => {
    expect(themeAttributes({ variant: "external", brand: "fkas", segment: "private" })).toEqual({
      "data-theme-variant": "external",
      "data-theme-brand": "fkas",
      "data-theme-segment": "private",
    });
    expect(themeAttributes({ variant: "internal", brand: "elma", segment: "private" })).toEqual({
      "data-theme-variant": "internal",
      "data-theme-brand": "elma",
      "data-theme-segment": "private",
    });
    expect(themeAttributes({ variant: "external", brand: "elma", segment: "company" })).toEqual({
      "data-theme-variant": "external",
      "data-theme-brand": "elma",
      "data-theme-segment": "company",
    });
  });

  it("validates untyped input before returning attributes", () => {
    const untyped = { variant: "internal", brand: "zz", segment: "private" };
    // SAFETY: runtime validator is the contract under test; the public type is ThemeInput.
    expect(() => themeAttributes(untyped as ThemeInput)).toThrow(/unknown or missing/);
  });
});

describe("BRANDS", () => {
  it("matches the theming chapter record", () => {
    expect(BRANDS).toEqual({
      fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
      tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
      guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
      fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
      fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
      elma: { code: "elma", displayName: "Elmera", segments: ["private", "company"] },
    });
  });
});

describe("ColorSchemeScript", () => {
  it("inlines a blocking script that sets data-theme from the documented defaults", () => {
    const source = colorSchemeScriptSource();
    expect(source).toContain("data-theme");
    expect(source).toContain("elmera-color-scheme");
    expect(source).toContain("__ELMERA_COLOR_SCHEME_BOOTSTRAP__");
  });

  it("forwards option overrides into the script", () => {
    const source = colorSchemeScriptSource({
      storageKey: "app-color-scheme",
      defaultColorScheme: "light",
      enableSystem: false,
      forcedColorScheme: "dark",
    });
    expect(source).toContain("app-color-scheme");
    expect(source).toContain('"light"');
    expect(source).toContain("false");
    expect(source).toContain('"dark"');
  });

  it("does not include runtime transition suppression in the parser-time bootstrap", () => {
    const source = colorSchemeScriptSource();
    expect(source).not.toMatch(/transition:none|disableTransition|createElement\("style"\)/);
  });
});

describe("color-scheme bootstrap diagnostics", () => {
  const expected = resolveColorSchemeOptions();

  function writeManifest(manifest: ColorSchemeBootstrapManifest | undefined) {
    if (manifest === undefined) {
      delete globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;
      return;
    }
    globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ = manifest;
  }

  afterEach(() => {
    writeManifest(undefined);
  });

  it("warns for a missing manifest in development and stays silent in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    writeManifest(undefined);

    vi.stubEnv("NODE_ENV", "development");
    diagnoseColorSchemeBootstrap(expected, false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE);

    warn.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    expect(isThemeDevelopment()).toBe(false);
    diagnoseColorSchemeBootstrap(expected, false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns for a mismatched manifest and stays silent when it matches", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "development");

    const found = resolveColorSchemeOptions({
      storageKey: "other-key",
      defaultColorScheme: "light",
      enableSystem: false,
      forcedColorScheme: "dark",
    });
    writeManifest(found);
    diagnoseColorSchemeBootstrap(expected, false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(colorSchemeBootstrapMismatchMessage(expected, found));

    warn.mockClear();
    writeManifest(expected);
    diagnoseColorSchemeBootstrap(expected, false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns for host-plus-provider injection when a manifest already exists", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "development");
    writeManifest(expected);
    diagnoseColorSchemeBootstrap(expected, true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE);
  });

  it("does not warn duplicate for a matching provider-owned self-inject", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "development");
    const selfInjected = { ...expected };
    Object.defineProperty(selfInjected, COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY, {
      value: COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER,
    });
    writeManifest(selfInjected);
    diagnoseColorSchemeBootstrap(expected, true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns duplicate when a provider inject overwrites a host bootstrap", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "development");
    const overwritten = { ...expected };
    Object.defineProperty(overwritten, COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY, {
      value: COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
    });
    writeManifest(overwritten);
    diagnoseColorSchemeBootstrap(expected, true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE);
  });
});

describe("ThemeProvider server snapshot", () => {
  const theme = { variant: "internal", brand: "fkas", segment: "private" } as const;

  function SnapshotProbe() {
    const resolvedTheme = useTheme();
    const { colorScheme, resolvedColorScheme } = useColorScheme();
    return createElement(
      "span",
      null,
      `${resolvedTheme.slug}:${colorScheme}:${resolvedColorScheme ?? "pending"}`
    );
  }

  it("keeps resolvedColorScheme undefined on the server while brand stays defined", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeProvider, { theme, children: createElement(SnapshotProbe) })
    );
    expect(html).toBe("<span>internal-fkas-private:system:pending</span>");
  });

  it("renders an opt-in classic script as the first child and defaults injection off", () => {
    const injected = renderToStaticMarkup(
      createElement(ThemeProvider, {
        theme,
        injectColorSchemeScript: true,
        children: createElement("span", null, "child"),
      })
    );
    expect(injected.startsWith("<script>")).toBe(true);
    expect(injected).toContain(colorSchemeScriptSource());
    expect(injected.endsWith("<span>child</span>")).toBe(true);

    const plain = renderToStaticMarkup(
      createElement(ThemeProvider, { theme, children: createElement("span", null, "child") })
    );
    expect(plain).toBe("<span>child</span>");
  });
});

describe("ThemeProvider color-scheme store seam", () => {
  it("resolves theme context from axes rather than object identity", () => {
    const source = readFileSync(join(srcRoot, "theme/theme-context.ts"), "utf8");
    expect(source).toContain("validateTheme(theme)");
    expect(source).toMatch(/axes\?\.brand, axes\?\.segment, axes\?\.variant/);
    expect(source).not.toMatch(/\}, \[theme\]\);/);
  });

  it("does not mutate the retained color-scheme store during render", () => {
    const source = readFileSync(join(srcRoot, "theme/theme-provider.tsx"), "utf8");
    const writerStart = source.indexOf("function DocumentThemeWriter");
    const writerEnd = source.indexOf("export function useTheme");
    expect(writerStart).toBeGreaterThan(-1);
    expect(writerEnd).toBeGreaterThan(writerStart);
    const writer = source.slice(writerStart, writerEnd);
    const [renderPhase, ...insertionAndRest] = writer.split("useInsertionEffect");
    expect(insertionAndRest.length).toBeGreaterThan(0);
    expect(renderPhase).not.toMatch(/store\.(updateConfig|applyConfig|commitConfig|discardConfig)\(/);
    expect(writer).toMatch(/store\.applyConfig\(/);
    expect(writer).toMatch(/store\.commitConfig\(/);
    expect(writer).toMatch(/useInsertionEffect\(/);
  });
});

describe("source contract", () => {
  it("does not ship userAgent, UserAgentParserResult, or @elmeragroup/lib", () => {
    const files = walkSourceFiles(srcRoot).filter((file) => !file.includes(".test"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/\buserAgent\b/);
      expect(text, file).not.toMatch(/\bUserAgentParserResult\b/);
      expect(text, file).not.toMatch(/@elmeragroup\/lib/);
    }
  });

  it("reads process.env only inside validateTheme", () => {
    const hits = walkSourceFiles(srcRoot).filter((file) => {
      if (file.includes(".test.")) {
        return false;
      }
      return readFileSync(file, "utf8").includes("process.env");
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/validate-theme\.ts$/);
  });
});
