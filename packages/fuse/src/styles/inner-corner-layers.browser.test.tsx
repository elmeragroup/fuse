import { compile } from "tailwindcss";
import reactAriaComponents from "tailwindcss-react-aria-components";
import themeCss from "tailwindcss/theme.css?raw";
import utilitiesCss from "tailwindcss/utilities.css?raw";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import "../../dist/themes.css";
import twAnimateCss from "../../node_modules/tw-animate-css/dist/tw-animate.css?raw";
import { render } from "../../test/browser-render";
import { cornerRadius, expectShellOnThemeElementWins } from "../../test/inner-corner-specimens";
import { fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import { roleNamed, snapshotDocumentTheme, stampDocumentTheme } from "../../test/themed-browser-render";
import { ThemeScope } from "../theme/theme-scope";
import fuseCss from "./fuse.css?raw";
import { innerCornerShell } from "./inner-corner";

/** The stylesheets a Tailwind-source consumer's `@import`s reach, keyed by the specifier. */
const STYLESHEETS = new Map([
  ["tailwindcss/theme.css", themeCss],
  ["tailwindcss/utilities.css", utilitiesCss],
  ["./fuse.css", fuseCss],
  ["tw-animate-css", twAnimateCss],
]);

/**
 * A Tailwind-source consumer that declares its layers in an unusual order: `theme` after
 * `utilities`. A reset that lived in the `theme` layer would beat every utility here.
 */
const LAYERED_CONSUMER = [
  "@layer utilities, theme, base, components;",
  '@import "tailwindcss/theme.css" layer(theme);',
  '@import "tailwindcss/utilities.css" layer(utilities);',
  '@import "./fuse.css";',
].join("\n");

/** The classes the specimens below spell. */
const CANDIDATES = [...innerCornerShell.menuPopup().split(" "), "rounded-inner"];

async function layeredConsumerCss(): Promise<string> {
  const compiler = await compile(LAYERED_CONSUMER, {
    base: "/",
    loadStylesheet: (id, base) => {
      const content = STYLESHEETS.get(id);
      if (content === undefined) {
        throw new Error(`the layered consumer imports no stylesheet named ${id}`);
      }
      return Promise.resolve({ path: id, base, content });
    },
    loadModule: (id, base) => {
      if (id !== "tailwindcss-react-aria-components") {
        throw new Error(`fuse.css loads no plugin but tailwindcss-react-aria-components, received ${id}`);
      }
      return Promise.resolve({ path: id, base, module: reactAriaComponents });
    },
  });
  return compiler.build(CANDIDATES);
}

describe("inner corners in a layered consumer build", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeAll(async () => {
    const style = document.createElement("style");
    style.textContent = await layeredConsumerCss();
    document.head.append(style);
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  it("keeps a shell's --inner-corner on an element that also carries theme attributes", () => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
    stampDocumentTheme(fkasPrivate, "light");
    expectShellOnThemeElementWins();
  });

  it("resets --inner-corner on a nested theme scope under a shell", () => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <ThemeScope theme={fkasPrivate}>
        <div className={innerCornerShell.menuPopup()}>
          <div role="group" aria-label="Shell row" className="rounded-inner" />
          <ThemeScope theme={tkasCompany}>
            <div role="group" aria-label="Scoped row" className="rounded-inner" />
          </ThemeScope>
        </div>
      </ThemeScope>
    );
    // The internal shell gives its own rows 6px less 4px. The tkas scope rounds with 16px.
    expect(cornerRadius(roleNamed("group", "Shell row"))).toBe(2);
    expect(cornerRadius(roleNamed("group", "Scoped row"))).toBe(16);
  });
});
