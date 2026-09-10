import { useLayoutEffect } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import {
  ColorSchemeOutput,
  ColorSchemeSetter,
  defaultManifest,
  fkasPrivate,
  mountedColorScheme,
  readDocumentBrand,
  stampDocumentBrand,
  stubPrefersColorScheme,
  tkasCompany,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import { DEFAULT_COLOR_SCHEME_STORAGE_KEY, resolveColorSchemeOptions } from "./color-scheme";
import { ForceColorScheme } from "./force-color-scheme";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeScope } from "./theme-scope";
import { useColorScheme } from "./use-color-scheme";

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

describe("useColorScheme", () => {
  it("throws outside a document writer, including a ThemeScope-only tree", () => {
    function Probe() {
      try {
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

    expect(first[0]).toBe("internal-fkas-private:system/pending");
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("writes data-theme in the same setter turn and leaves brand attributes untouched", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    stampDocumentBrand(fkasPrivate);
    const seen: Array<string | null> = [];

    function ImmediateSetter() {
      const { setColorScheme } = useColorScheme();
      return (
        <button
          type="button"
          onClick={() => {
            setColorScheme("dark");
            seen.push(document.documentElement.getAttribute("data-theme"));
          }}>
          set
        </button>
      );
    }

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
        <ImmediateSetter />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    host.querySelector("button")?.click();
    expect(seen).toEqual(["dark"]);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(document.documentElement.style.colorScheme).toBe("");
    expect(document.querySelector('meta[name="color-scheme"]')).toBeNull();
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");
  });

  it("applies storage and media events in the same turn", async () => {
    const media = stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:system/light");

    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
        newValue: "dark",
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
        newValue: "system",
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:system/light");

    media.setPrefersDark(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:system/dark");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("restores the configured fallback when another document clears local storage", async () => {
    stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: null,
        newValue: null,
        oldValue: null,
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:system/light");
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBeNull();
  });

  // Three ways a `storage` event can look like a preference change and not be one. The
  // mount, the stored `dark` preference and the ignored outcome are identical; only the
  // event init differs, so the matrix is the whole difference between the cases.
  it.each([
    {
      name: "session storage reusing the preference key",
      init: {
        key: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
        newValue: "light",
        storageArea: window.sessionStorage,
      },
    },
    {
      name: "local storage under an unrelated key",
      init: { key: "other-key", newValue: "light", storageArea: window.localStorage },
    },
    {
      name: "a null storageArea",
      init: { key: DEFAULT_COLOR_SCHEME_STORAGE_KEY, newValue: "light", storageArea: null },
    },
  ])("ignores a storage event from $name", async ({ init }) => {
    stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    window.dispatchEvent(new StorageEvent("storage", init));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");
  });

  it("restores a custom defaultColorScheme after a clear of a custom storage key", async () => {
    stubPrefersColorScheme(false);
    window.localStorage.setItem("app-color-scheme", "dark");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate} storageKey="app-color-scheme" defaultColorScheme="light">
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: null,
        newValue: null,
        oldValue: null,
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");
    expect(window.localStorage.getItem("app-color-scheme")).toBeNull();
  });

  it("prefers a newer stored value over the fallback after a whole-store clear", async () => {
    stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    window.localStorage.clear();
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: null,
        newValue: null,
        oldValue: null,
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");
  });

  it("ignores storage events when localStorage is inaccessible", async () => {
    stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");

    const area = window.localStorage;
    const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
          newValue: "light",
          storageArea: area,
        })
      );
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      await mountedColorScheme(host, "internal-fkas-private:dark/dark");
    } finally {
      getter.mockRestore();
    }
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
  it("applies mount-level forced light, dark, and system before descendant layout work", async () => {
    writeManifest(resolveColorSchemeOptions({ forcedColorScheme: "dark" }));
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    const media = stubPrefersColorScheme(true);
    const seen: Array<string | null> = [];
    function LayoutChild() {
      useLayoutEffect(() => {
        seen.push(document.documentElement.getAttribute("data-theme"));
      });
      return null;
    }

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="dark">
        <ColorSchemeOutput />
        <LayoutChild />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    rerender(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="light">
        <ColorSchemeOutput />
        <LayoutChild />
      </ThemeProvider>
    );
    expect(seen.at(-1)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    rerender(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="system">
        <ColorSchemeOutput />
        <LayoutChild />
      </ThemeProvider>
    );
    expect(seen.at(-1)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");

    media.setPrefersDark(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");
    media.setPrefersDark(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
  });

  it("hides preference changes under force and applies them synchronously when force is removed", async () => {
    writeManifest(resolveColorSchemeOptions({ forcedColorScheme: "light" }));
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    const seen: Array<string | null> = [];
    function LayoutChild() {
      useLayoutEffect(() => {
        seen.push(document.documentElement.getAttribute("data-theme"));
      });
      return null;
    }
    function ImmediateSetter() {
      const { setColorScheme } = useColorScheme();
      return (
        <button
          type="button"
          onClick={() => {
            setColorScheme("dark");
            seen.push(document.documentElement.getAttribute("data-theme"));
          }}>
          set
        </button>
      );
    }

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="light">
        <ColorSchemeOutput />
        <ImmediateSetter />
        <LayoutChild />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    host.querySelector("button")?.click();
    expect(seen.at(-1)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:dark/light");

    rerender(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
        <ImmediateSetter />
        <LayoutChild />
      </ThemeProvider>
    );
    expect(seen.at(-1)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");
  });

  it("follows prefers-color-scheme while forced system is active and ignores it for forced light", async () => {
    writeManifest(resolveColorSchemeOptions({ forcedColorScheme: "light" }));
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
    const media = stubPrefersColorScheme(true);

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="light">
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:system/light");

    media.setPrefersDark(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:system/light");

    rerender(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="system">
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:system/light");

    media.setPrefersDark(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:system/dark");
  });

  it("applies descendant runtime force and restores nested locks without treating them as first paint", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    document.documentElement.setAttribute("data-theme", "light");
    const first: Array<string | null> = [];

    function FirstPaintProbe() {
      if (first.length === 0) {
        first.push(document.documentElement.getAttribute("data-theme"));
      }
      return <ColorSchemeOutput />;
    }

    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="dark">
          <FirstPaintProbe />
        </ForceColorScheme>
      </ThemeProvider>
    );

    expect(first[0]).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    rerender(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="dark">
          <ForceColorScheme value="light">
            <ColorSchemeOutput />
          </ForceColorScheme>
        </ForceColorScheme>
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    rerender(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="dark">
          <ColorSchemeOutput />
        </ForceColorScheme>
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");

    rerender(
      <ThemeProvider theme={fkasPrivate}>
        <ColorSchemeOutput />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/light");
  });

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
    await mountedColorScheme(host, "internal-fkas-private:dark/light");

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
    await mountedColorScheme(host, "internal-fkas-private:dark/dark");
  });

  it("keeps storage and media updates hidden while a descendant force is active", async () => {
    const media = stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="dark">
          <ColorSchemeOutput />
          <ColorSchemeSetter value="light" />
        </ForceColorScheme>
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:system/dark");

    host.querySelector("button")?.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");

    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "system");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: DEFAULT_COLOR_SCHEME_STORAGE_KEY,
        newValue: "system",
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:system/dark");

    media.setPrefersDark(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:system/dark");
  });

  it("keeps a descendant force while a whole-store clear restores the fallback preference", async () => {
    stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "dark");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="light">
          <ColorSchemeOutput />
        </ForceColorScheme>
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:dark/light");

    window.localStorage.clear();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: null,
        newValue: null,
        oldValue: null,
        storageArea: window.localStorage,
      })
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await mountedColorScheme(host, "internal-fkas-private:system/light");
    expect(window.localStorage.getItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBeNull();
  });

  it("follows prefers-color-scheme while a descendant forced system is active", async () => {
    const media = stubPrefersColorScheme(false);
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");

    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ForceColorScheme value="system">
          <ColorSchemeOutput />
        </ForceColorScheme>
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    media.setPrefersDark(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await mountedColorScheme(host, "internal-fkas-private:light/dark");
  });
});

describe("color-scheme transition suppression", () => {
  function transitionStyleCount() {
    // DOM audit: disable-transition injects a role-less <style>; count by its text.
    return [...document.head.querySelectorAll("style")].filter((style) =>
      style.textContent.includes("transition:none")
    ).length;
  }

  it("wraps runtime writes, removes the temporary style, and never belongs to the bootstrap", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    document.documentElement.setAttribute("data-theme", "light");
    const { host } = render(
      <ThemeProvider theme={fkasPrivate} disableTransitionOnChange nonce="csp">
        <ColorSchemeOutput />
        <ColorSchemeSetter value="dark" />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");
    expect(transitionStyleCount()).toBe(0);

    host.querySelector("button")?.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(transitionStyleCount()).toBe(1);
    // DOM audit: the injected transition lock is a <style> with nonce, no role.
    const injected = [...document.head.querySelectorAll("style")].find((style) =>
      style.textContent.includes("transition:none")
    );
    expect(injected?.getAttribute("nonce")).toBe("csp");
    await expect.poll(() => transitionStyleCount()).toBe(0);
  });

  it("is safe when document.body is missing", async () => {
    window.localStorage.setItem(DEFAULT_COLOR_SCHEME_STORAGE_KEY, "light");
    document.documentElement.setAttribute("data-theme", "light");
    const { host } = render(
      <ThemeProvider theme={fkasPrivate} disableTransitionOnChange>
        <ColorSchemeOutput />
        <ColorSchemeSetter value="dark" />
      </ThemeProvider>
    );
    await mountedColorScheme(host, "internal-fkas-private:light/light");

    const body = document.body;
    body.remove();
    try {
      host.querySelector("button")?.click();
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      await expect.poll(() => transitionStyleCount()).toBe(0);
    } finally {
      document.documentElement.append(body);
    }
  });
});
