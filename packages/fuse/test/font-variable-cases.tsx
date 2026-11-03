/**
 * The font-variable cases, shared by the Tailwind-source and the standalone browser suites, each
 * of which loads its own stylesheets in its own page. Unit under test: the cascade of Fuse's
 * `--font-sans` and `--font-heading` defaults, which `Text` and `Heading` apply. Oracle: the owner
 * ruling that themes name no fonts and that an app sets both variables in its own CSS without
 * `!important`, and CSS Cascade 5, where an unlayered rule beats every layered one and a later
 * layer beats an earlier one. The defaults sit in the `theme` layer.
 */
import { afterEach, describe, expect, it } from "vitest";

import { Heading } from "../src/components/heading/heading";
import { Text } from "../src/components/text/text";
import { render } from "./browser-render";
import { fkasExternal, fkasPrivate } from "./theme-fixtures";
import { snapshotDocumentTheme, stampDocumentTheme } from "./themed-browser-render";

/** The first family of the computed `font-family` of the element `data-probe` names, without quotes. */
function firstFamily(probe: string): string {
  // DOM audit: the probes are a paragraph and a heading whose computed font is the subject, and a
  // paragraph has no accessible name a role query could match.
  const element = document.querySelector(`[data-probe="${probe}"]`);
  if (element === null) {
    throw new Error(`no element carries data-probe="${probe}"`);
  }
  const [first = ""] = getComputedStyle(element).fontFamily.split(",");
  return first.trim().replaceAll(/["']/g, "");
}

/** A body paragraph and a heading, the two parts that read the two variables. */
function renderSpecimens(): void {
  render(
    <div>
      <Heading level={2} data-probe="heading">
        Heading
      </Heading>
      <Text data-probe="body">Body text</Text>
    </div>
  );
}

/** Register the font-variable cases. */
export function describeFontVariables(): void {
  describe("Fuse's font variables", () => {
    let restoreDocumentTheme: () => void = () => undefined;
    let appStyle: HTMLStyleElement | undefined;

    /** Append an app's stylesheet after Fuse's, as an app's own CSS loads. */
    function appCss(css: string): void {
      appStyle = document.createElement("style");
      appStyle.textContent = css;
      document.head.append(appStyle);
    }

    afterEach(() => {
      appStyle?.remove();
      appStyle = undefined;
      restoreDocumentTheme();
    });

    it.each([fkasPrivate, fkasExternal])(
      "names no family in a theme, so text draws the system stack",
      (theme) => {
        restoreDocumentTheme = snapshotDocumentTheme();
        stampDocumentTheme(theme, "light");
        renderSpecimens();
        expect([firstFamily("body"), firstFamily("heading")]).toEqual(["ui-sans-serif", "ui-sans-serif"]);
      }
    );

    it.each([
      ["an unlayered rule on :root", ':root { --font-sans: "App Sans", sans-serif; }'],
      [
        "a rule on html in a later base layer",
        '@layer base { html { --font-sans: "App Sans", sans-serif; } }',
      ],
    ])("lets %s set the body font, which headings follow", (_case, css) => {
      restoreDocumentTheme = snapshotDocumentTheme();
      stampDocumentTheme(fkasExternal, "light");
      appCss(css);
      renderSpecimens();
      expect([firstFamily("body"), firstFamily("heading")]).toEqual(["App Sans", "App Sans"]);
    });

    it("lets a brand rule in a later base layer set the heading font alone", () => {
      restoreDocumentTheme = snapshotDocumentTheme();
      stampDocumentTheme(fkasExternal, "light");
      appCss('@layer base { [data-theme-brand="fkas"] { --font-heading: "Brand Heading", serif; } }');
      renderSpecimens();
      expect([firstFamily("body"), firstFamily("heading")]).toEqual(["ui-sans-serif", "Brand Heading"]);
    });
  });
}
