/**
 * The font-variable cases, shared by the Tailwind-source and the standalone browser suites, each
 * of which loads its own stylesheets in its own page. Unit under test: the cascade of Fuse's
 * `--font-sans` and `--font-heading` defaults, which `Text` and `Heading` apply. Oracle: the owner
 * ruling that themes name no fonts and that an app sets both variables in its own CSS without
 * `!important`, and CSS Cascade 5, where an unlayered rule beats every layered one and a later
 * layer beats an earlier one. The defaults sit in the `theme` layer.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Heading } from "../src/components/heading/heading";
import { Text } from "../src/components/text/text";
import { render } from "./browser-render";
import { fkasBranded, fkasPrivate } from "./theme-fixtures";
import { headingNamed, snapshotDocumentTheme, stampDocumentTheme, textNamed } from "./themed-browser-render";

/** The first family of an element's computed `font-family`, without quotes. */
function firstFamily(element: Element): string {
  const [first = ""] = getComputedStyle(element).fontFamily.split(",");
  return first.trim().replaceAll(/["']/g, "");
}

/**
 * Each case: what it shows, the document theme, the app's CSS, and the first family the body text
 * and the heading draw. A theme names no family, so without app CSS both draw the system stack.
 */
const CASES = [
  [
    "names no family in a neutral theme, so text draws the system stack",
    fkasPrivate,
    "",
    ["ui-sans-serif", "ui-sans-serif"],
  ],
  [
    "names no family in a branded theme, so text draws the system stack",
    fkasBranded,
    "",
    ["ui-sans-serif", "ui-sans-serif"],
  ],
  [
    "lets an unlayered rule on :root set the body font, which headings follow",
    fkasBranded,
    ':root { --font-sans: "App Sans", sans-serif; }',
    ["App Sans", "App Sans"],
  ],
  [
    "lets a rule on html in a later base layer set the body font, which headings follow",
    fkasBranded,
    '@layer base { html { --font-sans: "App Sans", sans-serif; } }',
    ["App Sans", "App Sans"],
  ],
  [
    "lets a brand rule in a later base layer set the heading font alone",
    fkasBranded,
    '@layer base { [data-theme-brand="fkas"] { --font-heading: "Brand Heading", serif; } }',
    ["ui-sans-serif", "Brand Heading"],
  ],
] as const;

/** Register the font-variable cases. */
export function describeFontVariables(): void {
  describe("Fuse's font variables", () => {
    let restoreDocumentTheme: () => void = () => undefined;
    let appStyle: HTMLStyleElement | undefined;

    beforeEach(() => {
      restoreDocumentTheme = snapshotDocumentTheme();
    });

    afterEach(() => {
      appStyle?.remove();
      appStyle = undefined;
      restoreDocumentTheme();
    });

    it.each(CASES)("%s", (_case, theme, css, expected) => {
      stampDocumentTheme(theme, "light");
      // The app's stylesheet loads after Fuse's, as an app's own CSS does.
      appStyle = document.createElement("style");
      appStyle.textContent = css;
      document.head.append(appStyle);
      render(
        <div>
          <Heading level={2}>Heading</Heading>
          <Text>Body text</Text>
        </div>
      );
      expect([firstFamily(textNamed("Body text")), firstFamily(headingNamed("Heading", 2))]).toEqual(
        expected
      );
    });
  });
}
