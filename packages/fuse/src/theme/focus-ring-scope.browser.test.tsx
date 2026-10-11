import { describe, expect, it } from "vitest";

import { computedColor } from "../../test/assert-invalid-ring";
import { render } from "../../test/browser-render";
import { fkasExternal, guenPrivate, tkasCompany } from "../../test/theme-fixtures";
import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { generateThemesCss } from "./generate-css";
import { ThemeScope } from "./theme-scope";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput } from "./tokens/themes";

/** A host's own ring colour, set on an outer scope the way a host restyles one subtree. */
const HOST_RING = "rgb(10, 20, 30)";

/** A probe painting the ring as its text colour and the sidebar ring as its fill. */
function RingProbe({ testId }: { readonly testId: string }) {
  return (
    <span data-testid={testId} style={{ color: "var(--ring)", backgroundColor: "var(--sidebar-ring)" }} />
  );
}

function probe(host: HTMLElement, testId: string): HTMLElement {
  const element = host.querySelector(`[data-testid="${testId}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing ring probe ${testId}`);
  return element;
}

const CASES = (["light", "dark"] satisfies ResolvedColorScheme[]).flatMap((colorScheme) =>
  ([tkasCompany, guenPrivate] satisfies ThemeInput[]).map((inner) => [colorScheme, inner] as const)
);

describe("the focus ring colour per theme scope", () => {
  it.each(CASES.map(([colorScheme, inner]) => [`${colorScheme} ${themeSlug(inner)}`, colorScheme, inner]))(
    "resets a host's ring at a nested %s scope and rebinds its sidebar ring",
    (_label, colorScheme, inner) => {
      const { host } = render(
        <>
          <style>{generateThemesCss()}</style>
          <div data-theme={colorScheme}>
            <ThemeScope theme={fkasExternal} style={{ "--ring": HOST_RING }}>
              <RingProbe testId="outer" />
              <ThemeScope theme={inner}>
                <RingProbe testId="inner" />
              </ThemeScope>
            </ThemeScope>
          </div>
        </>
      );
      // Precondition: the host's ring reaches the outer scope, and the outer sidebar ring
      // follows it rather than the ring `:root` resolved.
      const outer = getComputedStyle(probe(host, "outer"));
      expect(outer.color).toBe(HOST_RING);
      expect(outer.backgroundColor).toBe(HOST_RING);

      // Oracle: the inner theme's ring as the token layers compose it, resolved by the browser.
      const innerProbe = probe(host, "inner");
      const expected = computedColor(innerProbe, composeTheme(inner, colorScheme).ring);
      expect(expected).not.toBe(HOST_RING);
      const innerStyle = getComputedStyle(innerProbe);
      expect(innerStyle.color, "inner ring").toBe(expected);
      expect(innerStyle.backgroundColor, "inner sidebar ring").toBe(expected);
    }
  );
});
