import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BOOTSTRAP_MANIFEST,
  DUPLICATE_BOOTSTRAP_MESSAGE,
  MISSING_BOOTSTRAP_MESSAGE,
} from "../../test/color-scheme-contract";
import { runColorSchemeBootstrap } from "../../test/memory-color-scheme-platform";
import { fkasPrivate } from "../../test/theme-fixtures";
import fuseCss from "../styles/fuse.css?raw";
import {
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_KEY,
  resolveColorSchemeOptions,
} from "./color-scheme";
import type { ColorSchemeBootstrapManifest } from "./color-scheme";
import { diagnoseColorSchemeBootstrap } from "./color-scheme-diagnostics";
import type { Density } from "./density";
import { documentAttributes } from "./document-attributes";
import { THEME_ATTRIBUTE_NAMES, themeAttributes } from "./theme-attributes";
import { BRANDS, LEGAL_THEMES, parseThemeSlug, themeSlug } from "./theme-input";
import type { ThemeInput } from "./theme-input";
import { ThemeProvider, useTheme } from "./theme-provider";
import { useColorScheme } from "./use-color-scheme";
import { coerceTheme, isThemeDevelopment, validateTheme } from "./validate-theme";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("themeSlug / parseThemeSlug", () => {
  it("is a total inverse over the 24 legal themes", () => {
    expect(LEGAL_THEMES).toHaveLength(24);
    for (const theme of LEGAL_THEMES) {
      expect(parseThemeSlug(themeSlug(theme))).toEqual(theme);
    }
  });

  it("returns null for malformed slugs and illegal pinned combinations", () => {
    expect(parseThemeSlug("neutral-fkab-private")).toBeNull();
    expect(parseThemeSlug("branded-fkse-company")).toBeNull();
    expect(parseThemeSlug("neutral-fkas-private-extra")).toBeNull();
    // Axis values are case-sensitive, and an unknown brand fails on its own.
    expect(parseThemeSlug("NEUTRAL-fkas-private")).toBeNull();
    expect(parseThemeSlug("neutral-zz-private")).toBeNull();
    // The retired identity names no longer parse.
    expect(parseThemeSlug("internal-fkas-private")).toBeNull();
    expect(parseThemeSlug("external-fkas-private")).toBeNull();
    expect(parseThemeSlug("")).toBeNull();
    expect(parseThemeSlug("branded-fkas-private")).toEqual({
      identity: "branded",
      brand: "fkas",
      segment: "private",
    });
    expect(parseThemeSlug("neutral-elma-private")).toEqual({
      identity: "neutral",
      brand: "elma",
      segment: "private",
    });
    expect(parseThemeSlug("branded-elma-company")).toEqual({
      identity: "branded",
      brand: "elma",
      segment: "company",
    });
  });
});

it.each([
  ["coerceTheme", coerceTheme],
  ["validateTheme", validateTheme],
] as const)("%s accepts every legal theme", (_name, parse) => {
  for (const theme of LEGAL_THEMES) {
    expect(parse(theme)).toEqual(theme);
  }
});

it("rejects non-objects and unknown or missing axes: coerceTheme returns null, validateTheme throws in every environment", () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const [input, message] of [
    [null, /expected an object/],
    ["branded-fkas-private", /expected an object/],
    [{ identity: "neutral", brand: "fkas" }, /unknown or missing/],
    [{ identity: "neutral", brand: "zz", segment: "private" }, /unknown or missing/],
  ] as const) {
    expect(coerceTheme(input)).toBeNull();
    expect(() => validateTheme(input)).toThrow(message);
  }
});

describe("coerceTheme", () => {
  it("silently pins illegal segments regardless of environment", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(coerceTheme({ identity: "neutral", brand: "fkab", segment: "private" })).toEqual({
      identity: "neutral",
      brand: "fkab",
      segment: "company",
    });
    vi.stubEnv("NODE_ENV", "production");
    expect(coerceTheme({ identity: "branded", brand: "fkse", segment: "company" })).toEqual({
      identity: "branded",
      brand: "fkse",
      segment: "private",
    });
  });
});

describe("validateTheme", () => {
  it("throws on pinned-segment mistakes outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => validateTheme({ identity: "neutral", brand: "fkab", segment: "private" })).toThrow(/fkab/);
    expect(() => validateTheme({ identity: "branded", brand: "fkse", segment: "company" })).toThrow(/fkse/);
  });

  it("coerces pinned-segment mistakes in production and warns once per invocation", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(validateTheme({ identity: "neutral", brand: "fkab", segment: "private" })).toEqual({
      identity: "neutral",
      brand: "fkab",
      segment: "company",
    });
    expect(warn).toHaveBeenCalledTimes(1);

    expect(validateTheme({ identity: "branded", brand: "fkse", segment: "company" })).toEqual({
      identity: "branded",
      brand: "fkse",
      segment: "private",
    });
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe("themeAttributes", () => {
  it("returns the three data attributes for a validated theme", () => {
    expect(themeAttributes({ identity: "branded", brand: "fkas", segment: "private" })).toEqual({
      "data-theme-identity": "branded",
      "data-theme-brand": "fkas",
      "data-theme-segment": "private",
    });
    expect(themeAttributes({ identity: "neutral", brand: "elma", segment: "private" })).toEqual({
      "data-theme-identity": "neutral",
      "data-theme-brand": "elma",
      "data-theme-segment": "private",
    });
    expect(themeAttributes({ identity: "branded", brand: "elma", segment: "company" })).toEqual({
      "data-theme-identity": "branded",
      "data-theme-brand": "elma",
      "data-theme-segment": "company",
    });
  });

  it("lists every attribute the projection stamps, in write order", () => {
    // Unit under test: THEME_ATTRIBUTE_NAMES. Oracle: the keys TypeScript forces themeAttributes to return.
    expect(THEME_ATTRIBUTE_NAMES).toEqual(Object.keys(themeAttributes(fkasPrivate)));
  });

  it("validates untyped input before returning attributes", () => {
    const untyped = { identity: "neutral", brand: "zz", segment: "private" };
    // SAFETY: runtime validator is the contract under test; the public type is ThemeInput.
    expect(() => themeAttributes(untyped as ThemeInput)).toThrow(/unknown or missing/);
  });

  it("rejects the retired variant axis and its values", () => {
    // validateTheme is the runtime boundary themeAttributes parses through.
    expect(() => validateTheme({ variant: "external", brand: "fkas", segment: "private" })).toThrow(
      /unknown or missing identity/
    );
    expect(() => validateTheme({ identity: "external", brand: "fkas", segment: "private" })).toThrow(
      /unknown or missing identity/
    );
  });

  it("is the set fuse.css drops a foreign inner corner on", () => {
    // Why a test: fuse.css cannot import TypeScript. Its weightless reset must name exactly the
    // attributes a theme stamps, or a scope stamped by one attribute keeps a foreign corner.
    const reset = /:where\(([^)]*)\)\s*\{\s*--inner-corner: initial;/u.exec(fuseCss)?.[1];
    expect(reset?.split(",").map((selector) => selector.trim())).toEqual(
      THEME_ATTRIBUTE_NAMES.map((name) => `[${name}]`)
    );
  });
});

describe("documentAttributes", () => {
  it("stamps the theme and the explicit density, in that order, whatever the identity", () => {
    expect(
      Object.entries(
        documentAttributes({
          theme: { identity: "branded", brand: "tkas", segment: "company" },
          density: "dense",
        })
      )
    ).toEqual([
      ["data-theme-identity", "branded"],
      ["data-theme-brand", "tkas"],
      ["data-theme-segment", "company"],
      ["data-density", "dense"],
    ]);
    expect(
      documentAttributes({
        theme: { identity: "neutral", brand: "fkas", segment: "private" },
        density: "comfortable",
      })
    ).toEqual({
      "data-theme-identity": "neutral",
      "data-theme-brand": "fkas",
      "data-theme-segment": "private",
      "data-density": "comfortable",
    });
  });

  it("rejects an unknown density or theme", () => {
    const density: string = "auto";
    // SAFETY: runtime validation is the contract under test; the public type forbids "auto".
    expect(() => documentAttributes({ theme: fkasPrivate, density: density as Density })).toThrow(
      /Invalid density/
    );
    const theme = { identity: "neutral", brand: "zz", segment: "private" };
    // SAFETY: runtime validation is the contract under test; the public type forbids "zz".
    expect(() => documentAttributes({ theme: theme as ThemeInput, density: "dense" })).toThrow(
      /Invalid theme/
    );
  });
});

describe("BRANDS", () => {
  it("matches the reviewed brand metadata", () => {
    expect(BRANDS).toEqual({
      fkas: { code: "fkas", displayName: "Fjordkraft", segments: ["private", "company"] },
      tkas: { code: "tkas", displayName: "TrøndelagKraft", segments: ["private", "company"] },
      guen: { code: "guen", displayName: "Gudbrandsdal Energi", segments: ["private", "company"] },
      fkab: { code: "fkab", displayName: "Fjordkraft Företag", segments: ["company"] },
      fkse: { code: "fkse", displayName: "Telinet", segments: ["private"] },
      elma: { code: "elma", displayName: "Elmera", segments: ["private", "company"] },
      ngfi: { code: "ngfi", displayName: "Nordic Green Energy", segments: ["private", "company"] },
    });
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
    expect(warn.mock.calls[0]?.[0]).toBe(MISSING_BOOTSTRAP_MESSAGE);

    warn.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    expect(isThemeDevelopment()).toBe(false);
    diagnoseColorSchemeBootstrap(expected, false);
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
    expect(warn.mock.calls[0]?.[0]).toBe(DUPLICATE_BOOTSTRAP_MESSAGE);
  });
});

describe("ThemeProvider server snapshot", () => {
  const theme = { identity: "neutral", brand: "fkas", segment: "private" } as const;

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
    expect(html).toBe("<span>neutral-fkas-private:system:pending</span>");
  });

  it("coerce-and-warns an illegal nested theme in production and still renders children", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const outer = { identity: "neutral", brand: "fkas", segment: "private" } as const;
    // @ts-expect-error untyped CMS/env input is the runtime boundary
    const illegalPinned: ThemeInput = { identity: "neutral", brand: "fkab", segment: "private" };

    const html = renderToStaticMarkup(
      createElement(ThemeProvider, {
        theme: outer,
        children: createElement(ThemeProvider, {
          theme: illegalPinned,
          children: createElement("span", null, "nested-child"),
        }),
      })
    );

    expect(html).toBe("<span>nested-child</span>");
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/fkab is pinned to company/);
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
    expect(injected.endsWith("</script><span>child</span>")).toBe(true);
    const body = injected.slice("<script>".length, injected.indexOf("</script>"));
    const bootstrap = runColorSchemeBootstrap(body, { stored: { "elmera-color-scheme": "dark" } });
    expect(bootstrap.state.attributes).toEqual({ "data-theme": "dark" });
    expect(bootstrap.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__).toEqual(DEFAULT_BOOTSTRAP_MANIFEST);

    const plain = renderToStaticMarkup(
      createElement(ThemeProvider, { theme, children: createElement("span", null, "child") })
    );
    expect(plain).toBe("<span>child</span>");
  });
});
