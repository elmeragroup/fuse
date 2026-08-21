import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import {
  ColorSchemeOutput,
  defaultManifest,
  fkasPrivate,
  mountedColorScheme,
  stubPrefersColorScheme,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import { DEFAULT_COLOR_SCHEME_STORAGE_KEY, resolveColorSchemeOptions } from "./color-scheme";
import {
  COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE,
  COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE,
  colorSchemeBootstrapMismatchMessage,
} from "./color-scheme-diagnostics";
import { createColorSchemeRuntimeStore } from "./color-scheme-runtime";
import type { ColorSchemeRuntimeConfig } from "./color-scheme-runtime";
import { colorSchemeScriptSource, injectedColorSchemeScriptSource } from "./color-scheme-script";
import { ForceColorScheme } from "./force-color-scheme";
import { ThemeProvider } from "./theme-provider";

function runBootstrap(source: string) {
  const script = document.createElement("script");
  script.textContent = source;
  document.head.append(script);
  script.remove();
}

beforeEach(() => {
  writeManifest(defaultManifest);
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-variant");
  document.documentElement.removeAttribute("data-theme-brand");
  document.documentElement.removeAttribute("data-theme-segment");
  document.documentElement.style.removeProperty("color-scheme");
  for (const meta of document.querySelectorAll('meta[name="color-scheme"]')) {
    meta.remove();
  }
  writeManifest(undefined);
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function runtimeConfig(overrides: Partial<ColorSchemeRuntimeConfig> = {}): ColorSchemeRuntimeConfig {
  return {
    storageKey: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
    defaultColorScheme: "light",
    enableSystem: false,
    mountForce: undefined,
    disableTransitionOnChange: false,
    nonce: undefined,
    ...overrides,
  };
}


describe("color-scheme bootstrap diagnostics", () => {
  it("diagnoses missing, mismatched, matching, and duplicate bootstrap configurations", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const expected = resolveColorSchemeOptions();

    writeManifest(undefined);
    render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).toHaveBeenCalledWith(COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE);

    warn.mockClear();
    const found = resolveColorSchemeOptions({
      storageKey: "other-key",
      defaultColorScheme: "light",
      enableSystem: false,
      forcedColorScheme: "dark",
    });
    writeManifest(found);
    render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).toHaveBeenCalledWith(colorSchemeBootstrapMismatchMessage(expected, found));

    warn.mockClear();
    writeManifest(expected);
    render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).not.toHaveBeenCalled();

    warn.mockClear();
    writeManifest(expected);
    render(
      <ThemeProvider theme={fkasPrivate} injectColorSchemeScript>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).toHaveBeenCalledWith(COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE);
    expect(warn).not.toHaveBeenCalledWith(COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE);

    warn.mockClear();
    writeManifest(undefined);
    runBootstrap(injectedColorSchemeScriptSource());
    render(
      <ThemeProvider theme={fkasPrivate} injectColorSchemeScript>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).not.toHaveBeenCalledWith(COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE);
    expect(warn).not.toHaveBeenCalledWith(COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE);

    warn.mockClear();
    writeManifest(undefined);
    runBootstrap(colorSchemeScriptSource());
    render(
      <ThemeProvider theme={fkasPrivate} injectColorSchemeScript>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).toHaveBeenCalledWith(COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE);
  });
});

describe("color-scheme store commit vs discard", () => {
  it("does not write data-theme for apply-then-discard, and does for apply-and-commit", () => {
    document.documentElement.setAttribute("data-theme", "light");
    const store = createColorSchemeRuntimeStore(runtimeConfig());
    store.markMounted();

    store.applyConfig(runtimeConfig({ mountForce: "dark" }));
    store.discardConfig();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(store.getSnapshot().resolvedColorScheme).toBe("light");

    store.applyConfig(runtimeConfig({ mountForce: "dark" }));
    store.commitConfig();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(store.getSnapshot().resolvedColorScheme).toBe("dark");
  });
});

describe("ThemeProvider committed color-scheme options", () => {
  it("updates document and consumer resolvedColorScheme when committed options change", async () => {
    writeManifest(resolveColorSchemeOptions({ forcedColorScheme: "dark", enableSystem: false }));
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="dark" enableSystem={false}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    rerender(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="light" enableSystem={false}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");
  });

  it("does not call matchMedia during a post-mount ThemeProvider render to compute resolvedColorScheme", async () => {
    stubPrefersColorScheme(true);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:system/dark");

    const matchMedia = vi.mocked(window.matchMedia);
    matchMedia.mockClear();
    rerender(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
        <span>extra</span>
      </ThemeProvider>
    );
    expect(host.querySelector("output")?.textContent).toBe("internal-fkas-private:system/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it("updates snapshot-owned resolvedColorScheme when runtime force changes", async () => {
    writeManifest(resolveColorSchemeOptions({ enableSystem: false }));
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    document.documentElement.setAttribute("data-theme", "light");

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate} enableSystem={false}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    rerender(
      <ThemeProvider theme={fkasPrivate} enableSystem={false}>
        <ForceColorScheme value="dark">
          <ColorSchemeOutput />
        </ForceColorScheme>
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
  });
});
