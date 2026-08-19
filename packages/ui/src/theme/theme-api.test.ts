import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { colorSchemeScriptSource } from "./color-scheme-script";
import { themeAttributes } from "./theme-attributes";
import { BRANDS, LEGAL_THEMES, parseThemeSlug, themeSlug } from "./tokens/themes";
import type { ThemeInput } from "./tokens/themes";
import { validateTheme } from "./validate-theme";

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
  it("is a total inverse over the 16 legal themes", () => {
    expect(LEGAL_THEMES).toHaveLength(16);
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

describe("themeAttributes", () => {
  it("returns the three data attributes for a validated theme", () => {
    expect(themeAttributes({ variant: "external", brand: "fkas", segment: "private" })).toEqual({
      "data-theme-variant": "external",
      "data-theme-brand": "fkas",
      "data-theme-segment": "private",
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
