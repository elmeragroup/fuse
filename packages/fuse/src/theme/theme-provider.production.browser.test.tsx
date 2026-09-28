import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { DEFAULT_BOOTSTRAP_MANIFEST } from "../../test/color-scheme-contract";
import {
  fkasPrivate,
  readDocumentBrand,
  resetThemeDocument,
  stampDocumentBrand,
  tkasCompany,
  writeManifest,
} from "../../test/theme-browser-fixtures";
import type { ColorScheme } from "./color-scheme";
import { ThemeProvider, useTheme } from "./theme-provider";
import type { ThemeInput } from "./tokens/themes";

beforeEach(() => {
  writeManifest(DEFAULT_BOOTSTRAP_MANIFEST);
});

afterEach(() => {
  resetThemeDocument();
  vi.restoreAllMocks();
});

function ThemeProbe() {
  const theme = useTheme();
  return (
    <span>
      {theme.variant}-{theme.brand}-{theme.segment}
    </span>
  );
}

type PinnedProviderOptions = {
  nonce: string;
  disableTransitionOnChange: boolean;
  defaultColorScheme: ColorScheme;
};

function PinnedSegmentProvider(options: PinnedProviderOptions) {
  // A fresh, equal literal on every render, as an inline CMS-driven prop would be.
  // @ts-expect-error untyped CMS/env input is the runtime boundary
  const theme: ThemeInput = { variant: "internal", brand: "fkab", segment: "private" };
  return (
    <ThemeProvider theme={theme} {...options}>
      <ThemeProbe />
    </ThemeProvider>
  );
}

describe("ThemeProvider in production", () => {
  it("warns once about a coerced pinned segment across color-scheme option changes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const coercion = 'Invalid theme: fkab is pinned to company. Coercing segment to "company".';

    const { host, rerender } = render(
      <PinnedSegmentProvider nonce="a" disableTransitionOnChange={false} defaultColorScheme="light" />
    );
    rerender(
      <PinnedSegmentProvider nonce="a" disableTransitionOnChange={false} defaultColorScheme="light" />
    );
    rerender(
      <PinnedSegmentProvider nonce="b" disableTransitionOnChange={false} defaultColorScheme="light" />
    );
    rerender(<PinnedSegmentProvider nonce="b" disableTransitionOnChange defaultColorScheme="light" />);
    rerender(<PinnedSegmentProvider nonce="b" disableTransitionOnChange defaultColorScheme="dark" />);

    expect(warn.mock.calls).toEqual([[coercion]]);
    expect(host.textContent).toBe("internal-fkab-company");
    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkab", segment: "company" });
  });

  it("recovers mismatched server brand attributes without warning", () => {
    stampDocumentBrand(tkasCompany);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <ThemeProvider theme={fkasPrivate}>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(readDocumentBrand()).toEqual({ variant: "internal", brand: "fkas", segment: "private" });
    expect(warn).not.toHaveBeenCalled();
  });
});
