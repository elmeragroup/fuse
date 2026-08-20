import { Component, useLayoutEffect } from "react";
import type { ReactNode, RefObject } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_COLOR_SCHEME_STORAGE_KEY, resolveColorSchemeOptions } from "./color-scheme";
import type { ColorScheme, ColorSchemeBootstrapManifest } from "./color-scheme";
import {
  COLOR_SCHEME_BOOTSTRAP_DUPLICATE_MESSAGE,
  COLOR_SCHEME_BOOTSTRAP_MISSING_MESSAGE,
  colorSchemeBootstrapMismatchMessage,
} from "./color-scheme-diagnostics";
import { createColorSchemeRuntimeStore } from "./color-scheme-runtime";
import type { ColorSchemeRuntimeConfig } from "./color-scheme-runtime";
import { colorSchemeScriptSource, injectedColorSchemeScriptSource } from "./color-scheme-script";
import { ElmeraGroupUiProvider, useElmeraGroupUi } from "./elmera-group-ui";
import { ForceColorScheme } from "./force-color-scheme";
import { themeAttributes } from "./theme-attributes";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeScope } from "./theme-scope";
import { ThemeScopeContainerContext, useThemeScopeContainer } from "./theme-scope-container";
import type { ThemeInput } from "./tokens/themes";
import { useColorScheme } from "./use-color-scheme";

const fkasPrivate = { variant: "internal", brand: "fkas", segment: "private" } as const;
const tkasCompany = { variant: "external", brand: "tkas", segment: "company" } as const;
const guenPrivate = { variant: "internal", brand: "guen", segment: "private" } as const;

const cleanups: Array<() => void> = [];
const defaultManifest = resolveColorSchemeOptions();

function writeManifest(manifest: ColorSchemeBootstrapManifest | undefined) {
  if (manifest === undefined) {
    delete globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__;
    return;
  }
  globalThis.__ELMERA_COLOR_SCHEME_BOOTSTRAP__ = manifest;
}

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
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
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

function stampDocumentBrand(theme: ThemeInput) {
  const attributes = themeAttributes(theme);
  document.documentElement.setAttribute("data-theme-variant", attributes["data-theme-variant"]);
  document.documentElement.setAttribute("data-theme-brand", attributes["data-theme-brand"]);
  document.documentElement.setAttribute("data-theme-segment", attributes["data-theme-segment"]);
}

function readDocumentBrand() {
  return {
    variant: document.documentElement.getAttribute("data-theme-variant"),
    brand: document.documentElement.getAttribute("data-theme-brand"),
    segment: document.documentElement.getAttribute("data-theme-segment"),
  };
}

function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => {
    root.render(node);
  });
  const rerender = (next: ReactNode) => {
    flushSync(() => {
      root.render(next);
    });
  };
  const unmount = () => {
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  };
  cleanups.push(unmount);
  return { host, rerender, unmount };
}

function ThemeProbe() {
  try {
    const theme = useTheme();
    return (
      <span>
        {theme.variant}-{theme.brand}-{theme.segment}-{theme.slug}
      </span>
    );
  } catch (error) {
    return <span>{error instanceof Error ? error.message : "error"}</span>;
  }
}

function LocaleProbe() {
  try {
    const { locale } = useElmeraGroupUi();
    return <span>{locale}</span>;
  } catch (error) {
    return <span>{error instanceof Error ? error.message : "error"}</span>;
  }
}

function ScopeProbe({ container }: { container?: HTMLElement | RefObject<HTMLElement | null> }) {
  const resolved = useThemeScopeContainer(container);
  if (resolved === undefined) {
    return <span>no-scope</span>;
  }
  if (resolved === null) {
    return <span>waiting</span>;
  }
  return <span>scoped:{resolved.tagName.toLowerCase()}</span>;
}

type ValidatorErrorState = { message: string | null };

class ValidatorErrorBoundary extends Component<{ children: ReactNode }, ValidatorErrorState> {
  state: ValidatorErrorState = { message: null };

  static getDerivedStateFromError(error: Error): ValidatorErrorState {
    return { message: error.message };
  }

  render() {
    if (this.state.message !== null) {
      return <span>{this.state.message}</span>;
    }
    return this.props.children;
  }
}

describe("ThemeProvider / ThemeScope", () => {
  it("useTheme returns the provided theme and slug", () => {
    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(host.textContent).toBe("internal-fkas-private-internal-fkas-private");
  });

  it("useTheme throws outside ThemeProvider or ThemeScope", () => {
    const { host } = render(<ThemeProbe />);
    expect(host.textContent).toBe("useTheme must be used within ThemeProvider or ThemeScope");
  });

  it("ThemeScope stamps owned attributes and wins for nested useTheme", () => {
    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeScope theme={tkasCompany} className="scope">
          <ThemeProbe />
        </ThemeScope>
      </ThemeProvider>
    );

    const scope = host.querySelector("[data-theme-brand]");
    expect(scope).not.toBeNull();
    expect(scope?.getAttribute("data-theme-variant")).toBe("external");
    expect(scope?.getAttribute("data-theme-brand")).toBe("tkas");
    expect(scope?.getAttribute("data-theme-segment")).toBe("company");
    expect(host.textContent).toBe("external-tkas-company-external-tkas-company");
  });

  it("does not let remaining props override theme attributes", () => {
    const { host } = render(
      <ThemeScope
        theme={fkasPrivate}
        {...{
          "data-theme-brand": "tkas",
          "data-theme-variant": "external",
          "data-theme-segment": "company",
        }}
      />
    );
    const scope = host.querySelector("[data-theme-brand]");
    expect(scope?.getAttribute("data-theme-brand")).toBe("fkas");
    expect(scope?.getAttribute("data-theme-variant")).toBe("internal");
    expect(scope?.getAttribute("data-theme-segment")).toBe("private");
  });

  it("keeps matching host brand attributes stable and updates all three before descendant layout work", () => {
    stampDocumentBrand(fkasPrivate);
    const seen: string[] = [];
    function LayoutChild() {
      useLayoutEffect(() => {
        const brand = readDocumentBrand();
        seen.push(`${brand.variant}-${brand.brand}-${brand.segment}`);
      });
      return null;
    }

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { host, rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
        <LayoutChild />
      </ThemeProvider>
    );

    expect(host.textContent).toBe("internal-fkas-private-internal-fkas-private");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(seen).toEqual(["internal-fkas-private"]);
    expect(warn).not.toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={tkasCompany}>
        <ThemeProbe />
        <LayoutChild />
      </ThemeProvider>
    );

    expect(host.textContent).toBe("external-tkas-company-external-tkas-company");
    expect(readDocumentBrand()).toEqual({ variant: "external", brand: "tkas", segment: "company" });
    expect(seen).toEqual(["internal-fkas-private", "external-tkas-company"]);
    expect(document.documentElement.getAttribute("data-theme")).toMatch(/^(light|dark)$/);
  });

  it("does not read or write local storage or cookies when brand changes", () => {
    stampDocumentBrand(fkasPrivate);
    const localGet = vi.spyOn(window.localStorage, "getItem");
    const localSet = vi.spyOn(window.localStorage, "setItem");
    const sessionGet = vi.spyOn(window.sessionStorage, "getItem");
    const sessionSet = vi.spyOn(window.sessionStorage, "setItem");
    const cookiesBefore = document.cookie;

    const { rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
      </ThemeProvider>
    );
    rerender(
      <ThemeProvider theme={tkasCompany}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(readDocumentBrand()).toEqual({ variant: "external", brand: "tkas", segment: "company" });
    expect(localGet.mock.calls.length).toBeGreaterThan(0);
    expect(localGet.mock.calls.every((call) => call[0] === DEFAULT_COLOR_SCHEME_STORAGE_KEY)).toBe(true);
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionGet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookiesBefore);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("diagnoses mismatched server brand attributes and recovers to the validated theme", () => {
    stampDocumentBrand(tkasCompany);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/Recovering to the validated controlled theme/);
  });

  it("does not let a nested provider compete for the document", () => {
    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProvider theme={tkasCompany}>
          <ThemeProbe />
        </ThemeProvider>
      </ThemeProvider>
    );

    expect(host.textContent).toBe("internal-fkas-private-internal-fkas-private");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
  });

  it("owns the document when mounted inside a lone ThemeScope", () => {
    const { host } = render(
      <ThemeScope theme={tkasCompany}>
        <ThemeProvider theme={fkasPrivate}>
          <ThemeProbe />
        </ThemeProvider>
      </ThemeScope>
    );

    expect(host.textContent).toBe("internal-fkas-private-internal-fkas-private");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(host.querySelector("[data-theme-brand]")?.getAttribute("data-theme-brand")).toBe("tkas");
    expect(host.querySelector("[data-theme-variant]")?.getAttribute("data-theme-variant")).toBe("external");
    expect(host.querySelector("[data-theme-segment]")?.getAttribute("data-theme-segment")).toBe("company");
  });

  it("lets ThemeScope win useTheme while a surrounding document writer keeps the document", () => {
    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeScope theme={tkasCompany}>
          <ThemeProvider theme={guenPrivate}>
            <ThemeProbe />
          </ThemeProvider>
        </ThemeScope>
      </ThemeProvider>
    );

    expect(host.textContent).toBe("external-tkas-company-external-tkas-company");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(host.querySelector("[data-theme-brand]")?.getAttribute("data-theme-brand")).toBe("tkas");
  });

  it("updates only the nested scope element when its theme changes", () => {
    stampDocumentBrand(fkasPrivate);
    const { host, rerender } = render(
      <ThemeScope theme={fkasPrivate} className="outer">
        <ThemeScope theme={tkasCompany} className="inner">
          <ThemeProbe />
        </ThemeScope>
      </ThemeScope>
    );

    const outer = host.querySelector(".outer");
    const inner = host.querySelector(".inner");
    expect(outer?.getAttribute("data-theme-brand")).toBe("fkas");
    expect(inner?.getAttribute("data-theme-brand")).toBe("tkas");
    expect(host.textContent).toBe("external-tkas-company-external-tkas-company");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });

    rerender(
      <ThemeScope theme={fkasPrivate} className="outer">
        <ThemeScope theme={guenPrivate} className="inner">
          <ThemeProbe />
        </ThemeScope>
      </ThemeScope>
    );

    expect(outer?.getAttribute("data-theme-variant")).toBe("internal");
    expect(outer?.getAttribute("data-theme-brand")).toBe("fkas");
    expect(outer?.getAttribute("data-theme-segment")).toBe("private");
    expect(inner?.getAttribute("data-theme-variant")).toBe("internal");
    expect(inner?.getAttribute("data-theme-brand")).toBe("guen");
    expect(inner?.getAttribute("data-theme-segment")).toBe("private");
    expect(host.textContent).toBe("internal-guen-private-internal-guen-private");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
  });

  it("throws the validator error — not a hooks-count mismatch — after a valid-then-illegal update", () => {
    // @ts-expect-error untyped CMS/env input is the §7.6 runtime boundary
    const untyped: ThemeInput = null;
    const trees = [
      (theme: ThemeInput) => (
        <ThemeProvider theme={theme}>
          <ThemeProbe />
        </ThemeProvider>
      ),
      (theme: ThemeInput) => (
        <ThemeScope theme={theme}>
          <ThemeProbe />
        </ThemeScope>
      ),
    ];

    for (const tree of trees) {
      const { host, rerender } = render(<ValidatorErrorBoundary>{tree(fkasPrivate)}</ValidatorErrorBoundary>);
      expect(host.textContent).toBe("internal-fkas-private-internal-fkas-private");

      rerender(<ValidatorErrorBoundary>{tree(untyped)}</ValidatorErrorBoundary>);

      expect(host.textContent).toBe("Invalid theme: expected an object with variant, brand, and segment.");
      expect(host.textContent).not.toMatch(/Rendered fewer hooks|Rendered more hooks|hook/i);
    }
  });
});

describe("ElmeraGroupUiProvider", () => {
  it("returns the provided locale and throws outside the provider", () => {
    const { host, rerender } = render(<LocaleProbe />);
    expect(host.textContent).toBe("useElmeraGroupUi must be used within ElmeraGroupUiProvider");

    rerender(
      <ElmeraGroupUiProvider locale="nb-NO">
        <LocaleProbe />
      </ElmeraGroupUiProvider>
    );
    expect(host.textContent).toBe("nb-NO");
  });

  it("keeps the context value stable across rerenders with the same locale", () => {
    const seen: object[] = [];
    function StabilityProbe() {
      seen.push(useElmeraGroupUi());
      return null;
    }

    const { rerender } = render(
      <ElmeraGroupUiProvider locale="sv-SE">
        <StabilityProbe />
      </ElmeraGroupUiProvider>
    );
    rerender(
      <ElmeraGroupUiProvider locale="sv-SE">
        <StabilityProbe />
      </ElmeraGroupUiProvider>
    );
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });
});

describe("overlay containment", () => {
  it("distinguishes no scope from a scope that is not attached yet", () => {
    const { host, rerender } = render(<ScopeProbe />);
    expect(host.textContent).toBe("no-scope");

    rerender(
      <ThemeScopeContainerContext.Provider value={null}>
        <ScopeProbe />
      </ThemeScopeContainerContext.Provider>
    );
    expect(host.textContent).toBe("waiting");

    const { host: scopedHost } = render(
      <ThemeScope theme={fkasPrivate}>
        <ScopeProbe />
      </ThemeScope>
    );
    expect(scopedHost.textContent).toBe("scoped:div");
  });

  it("waits on an explicit unattached ref instead of falling back to no-scope", () => {
    const ref: RefObject<HTMLElement | null> = { current: null };
    const { host } = render(<ScopeProbe container={ref} />);
    expect(host.textContent).toBe("waiting");
  });
});

function ColorSchemeOutput() {
  const theme = useTheme();
  const { colorScheme, resolvedColorScheme } = useColorScheme();
  return (
    <output>
      {theme.slug}:{colorScheme}/{resolvedColorScheme ?? "pending"}
    </output>
  );
}

function ColorSchemeSetter({ value, label = "set" }: { value: ColorScheme; label?: string }) {
  const { setColorScheme } = useColorScheme();
  return (
    <button
      type="button"
      onClick={() => {
        setColorScheme(value);
      }}>
      {label}
    </button>
  );
}

async function mountedColorScheme(host: HTMLElement, expected: string) {
  await expect.poll(() => host.querySelector("output")?.textContent).toBe(expected);
}

function stubPrefersColorScheme(prefersDark: boolean) {
  let matches = prefersDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  // SAFETY: test double implements the MediaQueryList surface the provider listens to.
  const media = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type !== "change") {
        return;
      }
      listeners.add((event) => {
        if ("handleEvent" in listener) {
          listener.handleEvent(event);
          return;
        }
        listener(event);
      });
    },
    removeEventListener() {
      return undefined;
    },
    addListener() {
      return undefined;
    },
    removeListener() {
      return undefined;
    },
    dispatchEvent() {
      return true;
    },
  } as MediaQueryList;
  const nativeMatchMedia = window.matchMedia.bind(window);

  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    if (query === "(prefers-color-scheme: dark)") {
      return media;
    }
    return nativeMatchMedia(query);
  });

  return {
    setPrefersDark(next: boolean) {
      matches = next;
      // SAFETY: listeners only read matches/media from the change payload.
      const event = { matches: next, media: media.media } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

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

function brandAttributeWrites(calls: ReadonlyArray<readonly unknown[]>) {
  return calls.filter(
    (call) =>
      call[0] === "data-theme-variant" || call[0] === "data-theme-brand" || call[0] === "data-theme-segment"
  );
}

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

describe("ThemeProvider equal-axis theme identity", () => {
  it("does not rewrite brand attributes or replace theme context for equal-axis literals", () => {
    stampDocumentBrand(fkasPrivate);
    const setAttribute = vi.spyOn(document.documentElement, "setAttribute");
    const themes: object[] = [];

    function IdentityProbe() {
      themes.push(useTheme());
      return <ThemeProbe />;
    }

    const { host, rerender } = render(
      <ThemeProvider theme={{ variant: "internal", brand: "fkas", segment: "private" }}>
        <IdentityProbe />
      </ThemeProvider>
    );

    const brandWritesAfterFirst = brandAttributeWrites(setAttribute.mock.calls).length;
    const firstTheme = themes.at(-1);
    expect(brandWritesAfterFirst).toBeGreaterThan(0);
    expect(firstTheme).toBeDefined();
    expect(host.textContent).toBe("internal-fkas-private-internal-fkas-private");

    rerender(
      <ThemeProvider theme={{ variant: "internal", brand: "fkas", segment: "private" }}>
        <IdentityProbe />
      </ThemeProvider>
    );

    expect(brandAttributeWrites(setAttribute.mock.calls).length).toBe(brandWritesAfterFirst);
    expect(themes.at(-1)).toBe(firstTheme);
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });

    rerender(
      <ThemeProvider theme={{ variant: "internal", brand: "tkas", segment: "private" }}>
        <IdentityProbe />
      </ThemeProvider>
    );

    expect(brandAttributeWrites(setAttribute.mock.calls).length).toBeGreaterThan(brandWritesAfterFirst);
    expect(themes.at(-1)).not.toBe(firstTheme);
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "tkas", segment: "private" });
    expect(host.textContent).toBe("internal-tkas-private-internal-tkas-private");
    expect(document.documentElement.getAttribute("data-theme-variant")).toBe("internal");
    expect(document.documentElement.getAttribute("data-theme-brand")).toBe("tkas");
    expect(document.documentElement.getAttribute("data-theme-segment")).toBe("private");
  });
});
