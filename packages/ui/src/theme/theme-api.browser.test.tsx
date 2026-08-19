import { Component, useLayoutEffect } from "react";
import type { ReactNode, RefObject } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ElmeraGroupUiProvider, useElmeraGroupUi } from "./elmera-group-ui";
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

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-variant");
  document.documentElement.removeAttribute("data-theme-brand");
  document.documentElement.removeAttribute("data-theme-segment");
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
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
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
    expect(localGet).not.toHaveBeenCalled();
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

describe("useColorScheme", () => {
  it("hydrates as unresolved then reads the script-set attribute", async () => {
    window.localStorage.setItem("elmera-color-scheme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");

    const first: string[] = [];
    function FirstRenderProbe() {
      const { colorScheme, resolvedColorScheme } = useColorScheme();
      if (first.length === 0) {
        first.push(`${colorScheme}/${resolvedColorScheme ?? "pending"}`);
      }
      return (
        <output>
          {colorScheme}/{resolvedColorScheme ?? "pending"}
        </output>
      );
    }

    const { host } = render(<FirstRenderProbe />);

    expect(first[0]).toBe("system/pending");
    await expect.poll(() => host.querySelector("output")?.textContent).toBe("dark/dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
