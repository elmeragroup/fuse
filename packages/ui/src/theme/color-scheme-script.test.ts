import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { evaluateColorSchemeBootstrapScript } from "../../scripts/color-scheme-bootstrap-harness";
import {
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_ENABLE_SYSTEM,
  serializeScriptData,
} from "./color-scheme";
import type {
  ColorScheme,
  ColorSchemeBootstrapManifest,
  ColorSchemeScriptElementProps,
} from "./color-scheme";
import {
  ColorSchemeScript,
  colorSchemeScriptSource,
  injectedColorSchemeScriptSource,
} from "./color-scheme-script";

const LINE_SEPARATOR = "\u2028";
const PARAGRAPH_SEPARATOR = "\u2029";

function bootstrapSource(
  manifest: ColorSchemeBootstrapManifest | undefined
):
  | typeof COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER
  | typeof COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE
  | undefined {
  if (manifest === undefined) {
    return undefined;
  }
  const key = Object.getOwnPropertySymbols(manifest).find(
    (symbol) => symbol.description === COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION
  );
  if (key === undefined) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(manifest, key);
  if (descriptor?.value === COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER) {
    return COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER;
  }
  if (descriptor?.value === COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE) {
    return COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE;
  }
  return undefined;
}

function scriptInnerHtml(markup: string): string {
  const prefix = "<script";
  const suffix = "</script>";
  expect(markup.startsWith(prefix)).toBe(true);
  expect(markup.endsWith(suffix)).toBe(true);
  const openEnd = markup.indexOf(">");
  expect(openEnd).toBeGreaterThan(prefix.length - 1);
  return markup.slice(openEnd + 1, -suffix.length);
}

describe("colorSchemeScriptSource resolution", () => {
  it("resolves stored light, dark, and system preferences", () => {
    expect(
      evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), {
        storedValue: "light",
        prefersDark: true,
      }).attributes["data-theme"]
    ).toBe("light");
    expect(
      evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), {
        storedValue: "dark",
        prefersDark: false,
      }).attributes["data-theme"]
    ).toBe("dark");
    expect(
      evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), {
        storedValue: "system",
        prefersDark: true,
      }).attributes["data-theme"]
    ).toBe("dark");
    expect(
      evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), {
        storedValue: "system",
        prefersDark: false,
      }).attributes["data-theme"]
    ).toBe("light");
  });

  it("ignores missing and invalid storage and uses the default", () => {
    const missing = evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), {
      storedValue: null,
      prefersDark: true,
    });
    expect(missing.attributes["data-theme"]).toBe("dark");
    expect(missing.storageReads).toEqual([DEFAULT_COLOR_SCHEME_STORAGE_KEY]);

    expect(
      evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), {
        storedValue: "nope",
        prefersDark: false,
      }).attributes["data-theme"]
    ).toBe("light");
    expect(
      evaluateColorSchemeBootstrapScript(colorSchemeScriptSource({ defaultColorScheme: "dark" }), {
        storedValue: "",
        prefersDark: false,
      }).attributes["data-theme"]
    ).toBe("dark");
  });

  it("resolves system to light when system support is disabled", () => {
    const source = colorSchemeScriptSource({ enableSystem: false });
    expect(
      evaluateColorSchemeBootstrapScript(source, { storedValue: "system", prefersDark: true }).attributes[
        "data-theme"
      ]
    ).toBe("light");
    expect(
      evaluateColorSchemeBootstrapScript(source, { storedValue: null, prefersDark: true }).attributes[
        "data-theme"
      ]
    ).toBe("light");
    expect(
      evaluateColorSchemeBootstrapScript(source, { storedValue: "dark", prefersDark: false }).attributes[
        "data-theme"
      ]
    ).toBe("dark");
  });

  it("applies document-level forced light, dark, and system without reading storage", () => {
    const storedLight = { storedValue: "light" as const, prefersDark: true };

    const forcedDark = evaluateColorSchemeBootstrapScript(
      colorSchemeScriptSource({ forcedColorScheme: "dark" }),
      storedLight
    );
    expect(forcedDark.attributes["data-theme"]).toBe("dark");
    expect(forcedDark.storageReads).toEqual([]);

    const forcedLight = evaluateColorSchemeBootstrapScript(
      colorSchemeScriptSource({ forcedColorScheme: "light" }),
      { storedValue: "dark", prefersDark: true }
    );
    expect(forcedLight.attributes["data-theme"]).toBe("light");
    expect(forcedLight.storageReads).toEqual([]);

    const forcedSystem = evaluateColorSchemeBootstrapScript(
      colorSchemeScriptSource({ forcedColorScheme: "system" }),
      { storedValue: "light", prefersDark: true }
    );
    expect(forcedSystem.attributes["data-theme"]).toBe("dark");
    expect(forcedSystem.storageReads).toEqual([]);

    const forcedSystemDisabled = evaluateColorSchemeBootstrapScript(
      colorSchemeScriptSource({ forcedColorScheme: "system", enableSystem: false }),
      { storedValue: "dark", prefersDark: true }
    );
    expect(forcedSystemDisabled.attributes["data-theme"]).toBe("light");
    expect(forcedSystemDisabled.storageReads).toEqual([]);
  });

  it("writes only resolved data-theme and overwrites the private manifest", () => {
    const first = evaluateColorSchemeBootstrapScript(colorSchemeScriptSource(), { storedValue: "light" });
    expect(first.attributes).toEqual({ "data-theme": "light" });
    expect(first.style).toEqual({});
    expect(first.createdElements).toEqual([]);
    expect(first.manifest).toEqual({
      storageKey: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
      defaultColorScheme: DEFAULT_COLOR_SCHEME,
      enableSystem: DEFAULT_ENABLE_SYSTEM,
      forcedColorScheme: undefined,
    });

    const second = evaluateColorSchemeBootstrapScript(
      colorSchemeScriptSource({
        storageKey: "app-color-scheme",
        defaultColorScheme: "light",
        enableSystem: false,
        forcedColorScheme: "dark",
      }),
      { existingManifest: first.manifest, storedValue: "light" }
    );
    expect(second.attributes["data-theme"]).toBe("dark");
    expect(second.manifest).toEqual({
      storageKey: "app-color-scheme",
      defaultColorScheme: "light",
      enableSystem: false,
      forcedColorScheme: "dark",
    });
    expect(second.storageReads).toEqual([]);
    expect(bootstrapSource(first.manifest)).toBeUndefined();
  });

  it("tags a provider-owned inject as self-inject and a second run as duplicate", () => {
    const first = evaluateColorSchemeBootstrapScript(injectedColorSchemeScriptSource(), {
      storedValue: "light",
    });
    expect(first.manifest).toEqual({
      storageKey: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
      defaultColorScheme: DEFAULT_COLOR_SCHEME,
      enableSystem: DEFAULT_ENABLE_SYSTEM,
      forcedColorScheme: undefined,
    });
    expect(bootstrapSource(first.manifest)).toBe(COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER);

    const second = evaluateColorSchemeBootstrapScript(injectedColorSchemeScriptSource(), {
      existingManifest: first.manifest,
      storedValue: "light",
    });
    expect(bootstrapSource(second.manifest)).toBe(COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE);
  });

  it("fails closed evaluation when the source has a free identifier", () => {
    expect(() => evaluateColorSchemeBootstrapScript("themeAttributes()", {})).toThrow(/themeAttributes/);
  });

  it("does not write brand attributes, CSS color-scheme, or a color-scheme meta tag", () => {
    const source = colorSchemeScriptSource({ forcedColorScheme: "dark" });
    expect(source).not.toMatch(/data-theme-brand|data-theme-variant|data-theme-segment/);
    expect(source).not.toMatch(/style\.colorScheme|name=["']color-scheme["']/);
    expect(source).not.toMatch(/createElement|\bmeta\b|themeAttributes|validateTheme|process\.env/);

    const result = evaluateColorSchemeBootstrapScript(source, { storedValue: "light" });
    expect(result.attributes["data-theme-brand"]).toBeUndefined();
    expect(result.attributes["data-theme-variant"]).toBeUndefined();
    expect(result.attributes["data-theme-segment"]).toBeUndefined();
    expect(result.style.colorScheme).toBeUndefined();
    expect(result.createdElements).toEqual([]);
  });
});

describe("colorSchemeScriptSource serialization", () => {
  it("escapes </script>, U+2028, and U+2029 without HTML-entity-encoding quotes or ampersands", () => {
    const storageKey = `</script>"&'${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}`;
    const source = colorSchemeScriptSource({ storageKey });

    expect(source).toContain("\\u003c/script>");
    expect(source).not.toContain("</script>");
    expect(source).toContain("\\u2028");
    expect(source).toContain("\\u2029");
    expect(source).toContain('\\"');
    expect(source).toContain("&");
    expect(source).not.toContain("&lt;");
    expect(source).not.toContain("&quot;");
    expect(source).not.toContain("&amp;");
    expect(serializeScriptData(storageKey)).toBe(`"\\u003c/script>\\"&'\\u2028\\u2029"`);

    const result = evaluateColorSchemeBootstrapScript(source, { storedValue: "dark" });
    expect(result.attributes["data-theme"]).toBe("dark");
    expect(result.storageReads).toEqual([storageKey]);
    expect(result.manifest?.storageKey).toBe(storageKey);
  });
});

describe("ColorSchemeScript", () => {
  it("emits a classic inline script and preserves nonce plus data-cfasync", () => {
    const markup = renderToStaticMarkup(
      createElement(ColorSchemeScript, {
        nonce: "csp-nonce",
        scriptProps: { "data-cfasync": "false" },
      })
    );

    expect(markup.startsWith("<script")).toBe(true);
    expect(markup).toContain('nonce="csp-nonce"');
    expect(markup).toContain('data-cfasync="false"');
    expect(markup).not.toContain("type=");
    expect(markup).not.toContain("src=");
    expect(scriptInnerHtml(markup)).toBe(colorSchemeScriptSource());
  });

  it("rejects or overrides forbidden script props", () => {
    // SAFETY: public types omit these keys; this assertion feeds the runtime override contract.
    const scriptProps = {
      "data-cfasync": "false",
      type: "module",
      src: "https://evil.example/theme.js",
      children: "window.__ELMERA_FORBIDDEN=1",
      dangerouslySetInnerHTML: { __html: "window.__ELMERA_FORBIDDEN=1" },
    } as ColorSchemeScriptElementProps;

    const markup = renderToStaticMarkup(
      createElement(ColorSchemeScript, {
        nonce: "keep-me",
        defaultColorScheme: "light",
        scriptProps,
      })
    );

    expect(markup).toContain('nonce="keep-me"');
    expect(markup).toContain('data-cfasync="false"');
    expect(markup).not.toContain("type=");
    expect(markup).not.toContain("src=");
    expect(markup).not.toContain("https://evil.example/theme.js");
    expect(markup).not.toContain("__ELMERA_FORBIDDEN");
    expect(scriptInnerHtml(markup)).toBe(colorSchemeScriptSource({ defaultColorScheme: "light" }));
  });

  it("forwards forcedColorScheme into the generated body", () => {
    const forced: ColorScheme = "dark";
    const markup = renderToStaticMarkup(createElement(ColorSchemeScript, { forcedColorScheme: forced }));
    expect(scriptInnerHtml(markup)).toBe(colorSchemeScriptSource({ forcedColorScheme: forced }));
  });
});
