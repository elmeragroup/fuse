import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../dist/styles.css";
// Role tokens live in themes.css only; styles.css defines none of them.
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import { declaredThemeValue } from "../../test/theme-css-contract";
import { snapshotDocumentTheme, stampDocumentTheme, stampTheme } from "../../test/themed-browser-render";
import { Dialog } from "../components/dialog";
import { LocaleProvider } from "../intl/locale-context";
import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { ThemeScope } from "./theme-scope";
import { TOKEN_NAMES } from "./tokens/contract";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeInput } from "./tokens/themes";

let restoreDocumentTheme: () => void;

beforeEach(() => {
  restoreDocumentTheme = snapshotDocumentTheme();
});

afterEach(() => {
  restoreDocumentTheme();
});

// Unit under test: the document cascade stamped by stampTheme. Oracle: composeTheme,
// whose resolved token map the emitted CSS must reproduce per permutation, in the form the
// theme contract declares each role.
function expectedElement(
  parent: HTMLElement,
  theme: ThemeInput,
  colorScheme: ResolvedColorScheme
): HTMLElement {
  const element = document.createElement("div");
  element.style.colorScheme = colorScheme;
  for (const [name, value] of Object.entries(composeTheme(theme, colorScheme))) {
    element.style.setProperty(`--${name}`, declaredThemeValue(name, value));
  }
  parent.append(element);
  return element;
}

function expectTokens(actual: HTMLElement, expected: HTMLElement, label: string): void {
  const actualStyle = getComputedStyle(actual);
  const expectedStyle = getComputedStyle(expected);
  expect(actualStyle.colorScheme, `${label} native controls`).toBe(expectedStyle.colorScheme);
  for (const key of TOKEN_NAMES) {
    expect(actualStyle.getPropertyValue(`--${key}`).trim(), `${label} ${key}`).toBe(
      expectedStyle.getPropertyValue(`--${key}`).trim()
    );
  }
}

describe("dark CSS", () => {
  it("resolves every document permutation before a provider mounts", () => {
    const { host } = render(null);
    for (const colorScheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        stampDocumentTheme(theme, colorScheme);
        const expected = expectedElement(host, theme, colorScheme);
        expectTokens(document.documentElement, expected, `${colorScheme} ${themeSlug(theme)}`);
        expected.remove();
      }
    }
  });

  it("keeps all 400 nested combinations isolated while the document switches light, dark, and back", () => {
    const { host } = render(null);
    stampDocumentTheme({ variant: "internal", brand: "elma", segment: "private" }, "light");
    const scopes = LEGAL_THEMES.flatMap((outer) => {
      const outerElement = document.createElement("section");
      stampTheme(outerElement, outer);
      host.append(outerElement);
      return LEGAL_THEMES.map((inner) => {
        const innerElement = document.createElement("section");
        stampTheme(innerElement, inner);
        outerElement.append(innerElement);
        return { innerElement, inner, label: `${themeSlug(outer)} > ${themeSlug(inner)}` };
      });
    });

    for (const colorScheme of ["light", "dark", "light"] as const) {
      document.documentElement.setAttribute("data-theme", colorScheme);
      for (const { innerElement, inner, label } of scopes) {
        const expected = expectedElement(host, inner, colorScheme);
        expectTokens(innerElement, expected, `${colorScheme} ${label}`);
        expected.remove();
      }
    }
  });

  it("lets a host-owned role inherit through a nested internal scope in light", () => {
    const { host } = render(null);
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.removeAttribute("data-theme-variant");
    const wrapper = document.createElement("div");
    wrapper.style.setProperty("--ring", "oklch(0.5 0.1 20)");
    wrapper.style.setProperty("--background", "oklch(0.5 0.1 20)");
    const inner = document.createElement("div");
    stampTheme(inner, { variant: "internal", brand: "elma", segment: "private" });
    wrapper.append(inner);
    host.append(wrapper);

    const innerStyle = getComputedStyle(inner);
    // Roles no light palette owns keep inheriting; the light reset set does not clobber them.
    expect(innerStyle.getPropertyValue("--ring").trim()).toBe("oklch(0.5 0.1 20)");
    // Roles the internal reset owns return to the defaults, not the host's override.
    expect(innerStyle.getPropertyValue("--background").trim()).toBe(
      getComputedStyle(document.documentElement).getPropertyValue("--background").trim()
    );
  });

  it.each(["internal", "external"] as const)(
    "keeps a portaled %s dialog dark through nested variant scopes",
    async (variant) => {
      document.documentElement.setAttribute("data-theme", "dark");
      stampTheme(document.documentElement, { variant: "external", brand: "fkas", segment: "company" });
      const theme = { variant, brand: "guen", segment: "private" } as const;
      const { host } = render(
        <LocaleProvider locale="en-US">
          <ThemeScope theme={{ variant: "internal", brand: "elma", segment: "private" }}>
            <ThemeScope theme={theme} role="region" aria-label="Customer account">
              <Dialog.Root>
                <Dialog.Trigger>Open account details</Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Title>Account details</Dialog.Title>
                  <Dialog.Description>Customer account overview.</Dialog.Description>
                </Dialog.Content>
              </Dialog.Root>
            </ThemeScope>
          </ThemeScope>
        </LocaleProvider>
      );
      await userEvent.click(page.getByRole("button", { name: "Open account details" }).element());
      const dialog = page.getByRole("dialog", { name: "Account details" }).element();
      const scope = page.getByRole("region", { name: "Customer account" }).element();
      expect(scope.contains(dialog)).toBe(true);
      if (!(dialog instanceof HTMLElement)) throw new Error("Expected dialog element");
      const expected = expectedElement(host, theme, "dark");
      expectTokens(dialog, expected, "nested dialog");
      expected.style.backgroundColor = "var(--popover)";
      expected.style.color = "var(--popover-foreground)";
      const style = getComputedStyle(dialog);
      expect(style.backgroundColor).toBe(getComputedStyle(expected).backgroundColor);
      expect(style.color).toBe(getComputedStyle(expected).color);
      expect(style.getPropertyValue("--destructive").trim()).toBe(style.getPropertyValue("--error").trim());
      expect(style.getPropertyValue("--sidebar-ring").trim()).toBe(style.getPropertyValue("--ring").trim());
      expected.remove();
    }
  );
});
