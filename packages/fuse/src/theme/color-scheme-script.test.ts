import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_BOOTSTRAP_MANIFEST } from "../../test/color-scheme-contract";
import { runColorSchemeBootstrap } from "../../test/memory-color-scheme-platform";
import type { MemoryPlatformInit } from "../../test/memory-color-scheme-platform";
import {
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DESCRIPTION,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE,
  COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER,
  serializeScriptData,
} from "./color-scheme";
import type {
  ColorScheme,
  ColorSchemeBootstrapManifest,
  ColorSchemeOptions,
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

function storedDefault(value: string) {
  return { "elmera-color-scheme": value };
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
  it.each<{
    name: string;
    options?: ColorSchemeOptions;
    platform: MemoryPlatformInit;
    root: string;
    storageReads?: readonly string[];
  }>([
    { name: "stored light", platform: { stored: storedDefault("light"), prefersDark: true }, root: "light" },
    { name: "stored dark", platform: { stored: storedDefault("dark"), prefersDark: false }, root: "dark" },
    {
      name: "stored system, dark query",
      platform: { stored: storedDefault("system"), prefersDark: true },
      root: "dark",
    },
    {
      name: "stored system, light query",
      platform: { stored: storedDefault("system"), prefersDark: false },
      root: "light",
    },
    {
      name: "missing storage",
      platform: { prefersDark: true },
      root: "dark",
      storageReads: ["elmera-color-scheme"],
    },
    {
      name: "invalid storage",
      platform: { stored: storedDefault("nope"), prefersDark: false },
      root: "light",
    },
    {
      name: "empty storage with a dark default",
      options: { defaultColorScheme: "dark" },
      platform: { stored: storedDefault(""), prefersDark: false },
      root: "dark",
    },
    {
      name: "stored system with system support disabled",
      options: { enableSystem: false },
      platform: { stored: storedDefault("system"), prefersDark: true },
      root: "light",
    },
    {
      name: "the system default with system support disabled",
      options: { enableSystem: false },
      platform: { prefersDark: true },
      root: "light",
    },
    {
      name: "stored dark with system support disabled",
      options: { enableSystem: false },
      platform: { stored: storedDefault("dark"), prefersDark: false },
      root: "dark",
    },
    {
      name: "forced dark over stored light",
      options: { forcedColorScheme: "dark" },
      platform: { stored: storedDefault("light"), prefersDark: true },
      root: "dark",
      storageReads: [],
    },
    {
      name: "forced light over stored dark",
      options: { forcedColorScheme: "light" },
      platform: { stored: storedDefault("dark"), prefersDark: true },
      root: "light",
      storageReads: [],
    },
    {
      name: "forced system over stored light",
      options: { forcedColorScheme: "system" },
      platform: { stored: storedDefault("light"), prefersDark: true },
      root: "dark",
      storageReads: [],
    },
    {
      name: "forced system with system support disabled",
      options: { forcedColorScheme: "system", enableSystem: false },
      platform: { stored: storedDefault("dark"), prefersDark: true },
      root: "light",
      storageReads: [],
    },
    {
      name: "blocked storage with a dark default",
      options: { defaultColorScheme: "dark" },
      platform: { stored: storedDefault("light"), storage: "blocked" },
      root: "dark",
    },
    { name: "a missing media query", platform: { prefersDark: true, media: "missing" }, root: "light" },
    { name: "a throwing media query", platform: { prefersDark: true, media: "throwing" }, root: "light" },
  ])("resolves $root from $name", ({ options, platform, root, storageReads }) => {
    const result = runColorSchemeBootstrap(colorSchemeScriptSource(options), platform);
    expect(result.state.root).toBe(root);
    if (storageReads !== undefined) {
      expect(result.state.storageReads).toEqual(storageReads);
    }
  });

  it("writes only resolved data-theme and overwrites the private manifest", () => {
    const first = runColorSchemeBootstrap(colorSchemeScriptSource(), { stored: storedDefault("light") });
    expect(first.state.attributes).toEqual({ "data-theme": "light" });
    expect(first.state.rootStyle).toEqual({});
    expect(first.state.createdElements).toEqual([]);
    expect(first.state.storageWrites).toEqual([]);
    expect(first.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__).toEqual(DEFAULT_BOOTSTRAP_MANIFEST);

    const second = runColorSchemeBootstrap(
      colorSchemeScriptSource({
        storageKey: "app-color-scheme",
        defaultColorScheme: "light",
        enableSystem: false,
        forcedColorScheme: "dark",
      }),
      { stored: { "app-color-scheme": "light" } },
      first.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__
    );
    expect(second.state.root).toBe("dark");
    expect(second.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__).toEqual({
      storageKey: "app-color-scheme",
      defaultColorScheme: "light",
      enableSystem: false,
      forcedColorScheme: "dark",
    });
    expect(second.state.storageReads).toEqual([]);
    expect(bootstrapSource(first.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__)).toBeUndefined();
  });

  it("tags a provider-owned inject as self-inject and a second run as duplicate", () => {
    const first = runColorSchemeBootstrap(injectedColorSchemeScriptSource(), {
      stored: storedDefault("light"),
    });
    expect(first.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__).toEqual(DEFAULT_BOOTSTRAP_MANIFEST);
    expect(bootstrapSource(first.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__)).toBe(
      COLOR_SCHEME_BOOTSTRAP_SOURCE_PROVIDER
    );

    const second = runColorSchemeBootstrap(
      injectedColorSchemeScriptSource(),
      { stored: storedDefault("light") },
      first.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__
    );
    expect(bootstrapSource(second.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__)).toBe(
      COLOR_SCHEME_BOOTSTRAP_SOURCE_DUPLICATE
    );
  });

  it("fails closed evaluation when the source has a free identifier", () => {
    expect(() => runColorSchemeBootstrap("themeAttributes()")).toThrow(/themeAttributes/);
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

    const result = runColorSchemeBootstrap(source, { stored: { [storageKey]: "dark" } });
    expect(result.state.root).toBe("dark");
    expect(result.state.storageReads).toEqual([storageKey]);
    expect(result.host.__ELMERA_COLOR_SCHEME_BOOTSTRAP__?.storageKey).toBe(storageKey);
  });
});

describe("ColorSchemeScript", () => {
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
    const result = runColorSchemeBootstrap(scriptInnerHtml(markup));
    expect(result.state.root).toBe("light");
  });

  it("forwards forcedColorScheme into the generated body", () => {
    const forced: ColorScheme = "dark";
    const markup = renderToStaticMarkup(createElement(ColorSchemeScript, { forcedColorScheme: forced }));
    const result = runColorSchemeBootstrap(scriptInnerHtml(markup), { stored: storedDefault("light") });
    expect(result.state.root).toBe("dark");
  });
});
