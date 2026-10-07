import { compile } from "tailwindcss";
import preflightCss from "tailwindcss/preflight.css?raw";
import themeCss from "tailwindcss/theme.css?raw";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { DENSITIES, edgeInset } from "../../../test/inner-corner-specimens";
import { fkasPrivate } from "../../../test/theme-fixtures";
import {
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { Tabs } from "./index";

/** The stylesheets the preflight build imports, keyed by the specifier. */
const STYLESHEETS = new Map([
  ["tailwindcss/theme.css", themeCss],
  ["tailwindcss/preflight.css", preflightCss],
]);

/** Tailwind's preflight as a Tailwind-source consumer compiles it, `box-sizing: border-box` included. */
async function preflight(): Promise<string> {
  const compiler = await compile('@import "tailwindcss/theme.css";\n@import "tailwindcss/preflight.css";', {
    base: "/",
    loadStylesheet: (id, base) => {
      const content = STYLESHEETS.get(id);
      if (content === undefined) {
        throw new Error(`the preflight build imports no stylesheet named ${id}`);
      }
      return Promise.resolve({ path: id, base, content });
    },
  });
  return compiler.build([]);
}

/** Root font sizes a host may set: the 16px default and a smaller 14px root. */
const ROOT_FONT_SIZES = ["16px", "14px"] as const;

describe("Tabs in a preflight consumer", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeAll(async () => {
    const style = document.createElement("style");
    style.textContent = await preflight();
    document.head.append(style);
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  it.each(ROOT_FONT_SIZES)(
    "keeps a trigger at the 24px target floor with room for its focus ring at a %s root",
    async (fontSize) => {
      restoreDocumentTheme = snapshotDocumentTheme();
      stampDocumentTheme(fkasPrivate, "light");
      document.documentElement.style.fontSize = fontSize;
      for (const density of DENSITIES) {
        stampDensity(density);
        const { unmount } = render(
          <>
            <button type="button">Before</button>
            <Tabs.Root defaultValue="one">
              <Tabs.List aria-label="Sections">
                <Tabs.Trigger value="one">One</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
          </>
        );
        await userEvent.click(roleNamed("button", "Before"));
        await userEvent.keyboard("{Tab}");
        const tab = roleNamed("tab", "One");
        const list = roleNamed("tablist", "Sections");
        expect(tab.matches(":focus-visible"), `${fontSize} ${density}`).toBe(true);
        expect(tab.getBoundingClientRect().height, `${fontSize} ${density} target`).toBeGreaterThanOrEqual(
          24
        );
        // The shared ring is 2px wide on a 2px offset, so it reaches 4px past the trigger.
        const tabBox = tab.getBoundingClientRect();
        const listBox = list.getBoundingClientRect();
        for (const edge of ["start", "end"] as const) {
          expect(edgeInset(tab, list, edge), `${fontSize} ${density} ${edge}`).toBeGreaterThanOrEqual(4);
        }
        expect(tabBox.top - listBox.top, `${fontSize} ${density} top`).toBeGreaterThanOrEqual(4);
        expect(listBox.bottom - tabBox.bottom, `${fontSize} ${density} bottom`).toBeGreaterThanOrEqual(4);
        unmount();
      }
    }
  );
});
