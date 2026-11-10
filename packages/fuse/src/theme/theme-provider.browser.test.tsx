import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { CaughtError } from "../../test/caught-error";
import { DEFAULT_BOOTSTRAP_MANIFEST } from "../../test/color-scheme-contract";
import {
  fkasPrivate,
  guenPrivate,
  readDocumentBrand,
  resetThemeDocument,
  stampDocumentBrand,
  tkasCompany,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import type { ThemeInput } from "./theme-input";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeScope } from "./theme-scope";

beforeEach(() => {
  writeManifest(DEFAULT_BOOTSTRAP_MANIFEST);
});

afterEach(() => {
  resetThemeDocument();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function ThemeProbe() {
  try {
    // oxlint-disable-next-line react-hooks/rules-of-hooks -- probe asserts the provider's synchronous throw path; the hook never commits
    const theme = useTheme();
    return (
      <span>
        {theme.identity}-{theme.brand}-{theme.segment}-{theme.slug}
      </span>
    );
  } catch (error) {
    return <span>{error instanceof Error ? error.message : "error"}</span>;
  }
}

describe("ThemeProvider / ThemeScope", () => {
  it("useTheme throws outside ThemeProvider or ThemeScope", () => {
    const { host } = render(<ThemeProbe />);
    expect(host.textContent).toBe("useTheme must be used within ThemeProvider or ThemeScope");
  });

  it.each([
    {
      name: "mismatched server brand attributes",
      stamp: () => stampDocumentBrand(tkasCompany),
      found: 'data-theme-identity="branded" data-theme-brand="tkas" data-theme-segment="company"',
    },
    {
      name: "a partially stamped document",
      stamp: () => {
        document.documentElement.setAttribute("data-theme-identity", "neutral");
        document.documentElement.setAttribute("data-theme-segment", "private");
      },
      found: 'data-theme-identity="neutral" data-theme-brand="null" data-theme-segment="private"',
    },
    { name: "a blank document", stamp: () => undefined, found: undefined },
  ])("diagnoses $name only when it disagrees and lands on the validated theme", ({ stamp, found }) => {
    stamp();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });
    expect(warn.mock.calls).toEqual(
      found === undefined
        ? []
        : [
            [
              `ThemeProvider controlled theme does not match document brand attributes. Expected data-theme-identity="neutral" data-theme-brand="fkas" data-theme-segment="private", found ${found}. Recovering to the validated controlled theme.`,
            ],
          ]
    );
  });

  it("throws the validator error for an illegal nested theme without a hooks-count mismatch", () => {
    stampDocumentBrand(fkasPrivate);
    // @ts-expect-error untyped CMS/env input is the runtime boundary
    const illegalPinned: ThemeInput = { identity: "neutral", brand: "fkab", segment: "private" };
    const { host } = render(
      <ThemeProvider theme={fkasPrivate}>
        <CaughtError>
          <ThemeProvider theme={illegalPinned}>
            <span>nested-child</span>
          </ThemeProvider>
        </CaughtError>
      </ThemeProvider>
    );

    expect(host.textContent).toBe("Invalid theme: fkab is pinned to company.");
    expect(host.textContent).not.toMatch(/Rendered fewer hooks|Rendered more hooks|hook/i);
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });
  });

  it("restores an overwritten document brand on commits that change only color-scheme props", () => {
    const { rerender } = render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
      </ThemeProvider>
    );

    document.documentElement.setAttribute("data-theme-brand", "tkas");
    rerender(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="dark">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });

    document.documentElement.setAttribute("data-theme-brand", "tkas");
    rerender(
      <ThemeProvider theme={fkasPrivate} forcedColorScheme="dark" nonce="nonce-2">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });
  });

  it("owns the document when mounted inside a lone ThemeScope", () => {
    const { host } = render(
      <ThemeScope theme={tkasCompany}>
        <ThemeProvider theme={fkasPrivate}>
          <ThemeProbe />
        </ThemeProvider>
      </ThemeScope>
    );

    expect(host.textContent).toBe("neutral-fkas-private-neutral-fkas-private");
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });
    expect(host.querySelector("[data-theme-brand]")?.getAttribute("data-theme-brand")).toBe("tkas");
    expect(host.querySelector("[data-theme-identity]")?.getAttribute("data-theme-identity")).toBe("branded");
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

    expect(host.textContent).toBe("branded-tkas-company-branded-tkas-company");
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });
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
    expect(host.textContent).toBe("branded-tkas-company-branded-tkas-company");
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });

    rerender(
      <ThemeScope theme={fkasPrivate} className="outer">
        <ThemeScope theme={guenPrivate} className="inner">
          <ThemeProbe />
        </ThemeScope>
      </ThemeScope>
    );

    expect(outer?.getAttribute("data-theme-identity")).toBe("neutral");
    expect(outer?.getAttribute("data-theme-brand")).toBe("fkas");
    expect(outer?.getAttribute("data-theme-segment")).toBe("private");
    expect(inner?.getAttribute("data-theme-identity")).toBe("neutral");
    expect(inner?.getAttribute("data-theme-brand")).toBe("guen");
    expect(inner?.getAttribute("data-theme-segment")).toBe("private");
    expect(host.textContent).toBe("neutral-guen-private-neutral-guen-private");
    expect(readDocumentBrand()).toEqual({ identity: "neutral", brand: "fkas", segment: "private" });
  });

  it("throws the validator error — not a hooks-count mismatch — after a valid-then-illegal update", () => {
    // @ts-expect-error untyped CMS/env input is the runtime boundary
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
      const { host, rerender } = render(<CaughtError>{tree(fkasPrivate)}</CaughtError>);
      expect(host.textContent).toBe("neutral-fkas-private-neutral-fkas-private");

      rerender(<CaughtError>{tree(untyped)}</CaughtError>);

      expect(host.textContent).toBe("Invalid theme: expected an object with identity, brand, and segment.");
      expect(host.textContent).not.toMatch(/Rendered fewer hooks|Rendered more hooks|hook/i);
    }
  });
});
