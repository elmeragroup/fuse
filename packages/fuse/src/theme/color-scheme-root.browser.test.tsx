import { Suspense, use } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import {
  DEFAULT_BOOTSTRAP_MANIFEST,
  DUPLICATE_BOOTSTRAP_MESSAGE,
  MISMATCH_BOOTSTRAP_MESSAGE,
  MISMATCHED_BOOTSTRAP_MANIFEST,
  MISSING_BOOTSTRAP_MESSAGE,
} from "../../test/color-scheme-contract";
import {
  ColorSchemeOutput,
  ColorSchemeSetter,
  emitStorageChange,
  fkasPrivate,
  mountedColorScheme,
  readDocumentBrand,
  tkasCompany,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import { roleNamed } from "../../test/themed-browser-render";
import { DEFAULT_COLOR_SCHEME_STORAGE_KEY, resolveColorSchemeOptions } from "./color-scheme";
import { colorSchemeScriptSource, injectedColorSchemeScriptSource } from "./color-scheme-script";
import { ThemeProvider } from "./theme-provider";

function transitionStyles(): HTMLStyleElement[] {
  return [...document.head.querySelectorAll("style")].filter((style) =>
    style.textContent.includes("transition:none")
  );
}

function runBootstrap(source: string) {
  const script = document.createElement("script");
  script.textContent = source;
  document.head.append(script);
  script.remove();
}

beforeEach(() => {
  writeManifest(DEFAULT_BOOTSTRAP_MANIFEST);
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
    expect(warn).toHaveBeenCalledWith(MISSING_BOOTSTRAP_MESSAGE);

    warn.mockClear();
    writeManifest(MISMATCHED_BOOTSTRAP_MANIFEST);
    render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).toHaveBeenCalledWith(MISMATCH_BOOTSTRAP_MESSAGE);

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
    expect(warn).toHaveBeenCalledWith(DUPLICATE_BOOTSTRAP_MESSAGE);
    expect(warn).not.toHaveBeenCalledWith(MISSING_BOOTSTRAP_MESSAGE);

    warn.mockClear();
    writeManifest(undefined);
    runBootstrap(injectedColorSchemeScriptSource());
    render(
      <ThemeProvider theme={fkasPrivate} injectColorSchemeScript>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).not.toHaveBeenCalledWith(DUPLICATE_BOOTSTRAP_MESSAGE);
    expect(warn).not.toHaveBeenCalledWith(MISSING_BOOTSTRAP_MESSAGE);

    warn.mockClear();
    writeManifest(undefined);
    runBootstrap(colorSchemeScriptSource());
    render(
      <ThemeProvider theme={fkasPrivate} injectColorSchemeScript>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(warn).toHaveBeenCalledWith(DUPLICATE_BOOTSTRAP_MESSAGE);
  });
});

describe("ThemeProvider committed color-scheme options", () => {
  it("ignores suspended configuration in document writes and later storage events", async () => {
    writeManifest(resolveColorSchemeOptions({ defaultColorScheme: "light", enableSystem: false }));
    const pending = new Promise<void>(() => undefined);
    const attemptedRender = vi.fn();
    function Suspend() {
      attemptedRender();
      use(pending);
      return null;
    }
    const { host, rerender } = render(
      <Suspense fallback={<span>Waiting</span>}>
        <ThemeProvider theme={fkasPrivate} defaultColorScheme="light" enableSystem={false}>
          <ColorSchemeOutput />
        </ThemeProvider>
      </Suspense>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    rerender(
      <Suspense fallback={<span>Waiting</span>}>
        <ThemeProvider
          theme={fkasPrivate}
          defaultColorScheme="light"
          enableSystem={false}
          forcedColorScheme="dark">
          <ColorSchemeOutput />
          <Suspend />
        </ThemeProvider>
      </Suspense>
    );
    expect(attemptedRender).toHaveBeenCalled();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    emitStorageChange(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    emitStorageChange(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    rerender(
      <Suspense fallback={<span>Waiting</span>}>
        <ThemeProvider
          theme={fkasPrivate}
          defaultColorScheme="light"
          enableSystem={false}
          forcedColorScheme="dark">
          <ColorSchemeOutput />
        </ThemeProvider>
      </Suspense>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
  });
});

describe("ThemeProvider data-theme recovery", () => {
  it("corrects an external data-theme overwrite when the provider re-renders with a new brand", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");
    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    document.documentElement.setAttribute("data-theme", "light");
    rerender(
      <ThemeProvider theme={tkasCompany}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(readDocumentBrand()).toEqual({ variant: "external", brand: "tkas", segment: "company" });
  });
});

describe("ThemeProvider transition suppression", () => {
  it("wraps a setter's write in one nonce'd transition lock and removes it afterwards", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    document.documentElement.setAttribute("data-theme", "light");
    const { host } = render(
      <ThemeProvider theme={fkasPrivate} disableTransitionOnChange nonce="csp">
        <ColorSchemeOutput />
        <ColorSchemeSetter value="dark" />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");
    expect(transitionStyles()).toEqual([]);

    roleNamed("button", "set").click();

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(transitionStyles().map((style) => style.getAttribute("nonce"))).toEqual(["csp"]);
    await expect.poll(() => transitionStyles()).toEqual([]);
  });
});

describe("ThemeProvider on the real browser platform", () => {
  it("round-trips the preference through localStorage and applies another document's storage event", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
        <ColorSchemeSetter value="dark" />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    roleNamed("button", "set").click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(document.documentElement.style.colorScheme).toBe("");
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    emitStorageChange(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");
  });

  it("resolves system from the real media query and removes its listener on unmount", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
    const expected = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const added = vi.spyOn(MediaQueryList.prototype, "addEventListener");
    const removed = vi.spyOn(MediaQueryList.prototype, "removeEventListener");

    const { host, unmount } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, `internal-fkas-private:system/${expected}`);
    expect(document.documentElement.getAttribute("data-theme")).toBe(expected);
    const changeListeners = added.mock.calls
      .filter(([type]) => type === "change")
      .map(([, listener]) => listener);
    expect(changeListeners).toHaveLength(1);

    unmount();
    expect(removed.mock.calls.filter(([type]) => type === "change").map(([, listener]) => listener)).toEqual(
      changeListeners
    );
  });
});
