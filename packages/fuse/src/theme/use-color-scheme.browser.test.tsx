import { useLayoutEffect } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { DEFAULT_BOOTSTRAP_MANIFEST } from "../../test/color-scheme-contract";
import {
  ColorSchemeOutput,
  fkasPrivate,
  mountedColorScheme,
  tkasCompany,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import { DEFAULT_COLOR_SCHEME_STORAGE_KEY, resolveColorSchemeOptions } from "./color-scheme";
import { ForceColorScheme } from "./force-color-scheme";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeScope } from "./theme-scope";
import { useColorScheme } from "./use-color-scheme";

beforeEach(() => {
  writeManifest(DEFAULT_BOOTSTRAP_MANIFEST);
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-identity");
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

describe("useColorScheme", () => {
  it("throws outside a document writer, including a ThemeScope-only tree", () => {
    function Probe() {
      try {
        // oxlint-disable-next-line react-hooks/rules-of-hooks -- probe asserts the provider's synchronous throw path; the hook never commits
        useColorScheme();
        return <span>ok</span>;
      } catch (error) {
        return <span>{error instanceof Error ? error.message : "error"}</span>;
      }
    }

    const { host, rerender } = render(<Probe />);
    expect(host.textContent).toBe("useColorScheme must be used within ThemeProvider");

    rerender(
      <ThemeScope theme={fkasPrivate}>
        <Probe />
      </ThemeScope>
    );
    expect(host.textContent).toBe("useColorScheme must be used within ThemeProvider");
  });

  it("keeps resolvedColorScheme undefined on first hydration while brand stays defined", async () => {
    window.localStorage.setItem("elmera-color-scheme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");

    const first: string[] = [];
    function FirstRenderProbe() {
      const theme = useTheme();
      const { colorScheme, resolvedColorScheme } = useColorScheme();
      if (first.length === 0) {
        first.push(`${theme.slug}:${colorScheme}/${resolvedColorScheme ?? "pending"}`);
      }
      return (
        <output>
          {theme.slug}:{colorScheme}/{resolvedColorScheme ?? "pending"}
        </output>
      );
    }

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <FirstRenderProbe />
      </ThemeProvider>
    );

    expect(first[0]).toBe("neutral-fkas-private:system/pending");
    await mountedColorScheme(host, "neutral-fkas-private:dark/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("shares one state machine and configuration across consumers", async () => {
    writeManifest(resolveColorSchemeOptions({ storageKey: "app-color-scheme" }));
    window.localStorage.setItem("app-color-scheme", "light");
    function Dual() {
      const first = useColorScheme();
      const second = useColorScheme();
      return (
        <>
          <output>{`${first.colorScheme}/${first.resolvedColorScheme ?? "pending"}:${second.colorScheme}/${second.resolvedColorScheme ?? "pending"}`}</output>
          <button
            type="button"
            onClick={() => {
              first.setColorScheme("dark");
            }}>
            set
          </button>
        </>
      );
    }

    const { host } = render(
      <ThemeProvider theme={fkasPrivate} storageKey="app-color-scheme">
        <ThemeProvider theme={tkasCompany} storageKey="forked-color-scheme">
          <Dual />
        </ThemeProvider>
      </ThemeProvider>
    );
    await expect.poll(() => host.querySelector("output")?.textContent).toBe("light/light:light/light");

    host.querySelector("button")?.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("app-color-scheme")).toBe("dark");
    expect(window.localStorage.getItem("forked-color-scheme")).toBeNull();
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBeNull();
    await expect
      .poll(() => host.querySelector("output")?.textContent)
      .toBe(["dark/dark", "dark/dark"].join(":"));
  });
});

describe("forced color-scheme", () => {
  it("applies the innermost lock on the first commit of nested ForceColorScheme", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    const seen: Array<string | null> = [];
    function LayoutChild() {
      useLayoutEffect(() => {
        seen.push(document.documentElement.getAttribute("data-theme"));
      });
      return null;
    }

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="dark">
          <ForceColorScheme value="light">
            <ColorSchemeOutput />
            <LayoutChild />
          </ForceColorScheme>
        </ForceColorScheme>
      </ThemeProvider>
    );

    expect(seen[0]).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "neutral-fkas-private:dark/light");

    rerender(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="dark">
          <ColorSchemeOutput />
          <LayoutChild />
        </ForceColorScheme>
      </ThemeProvider>
    );
    expect(seen.at(-1)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "neutral-fkas-private:dark/dark");
  });
});
