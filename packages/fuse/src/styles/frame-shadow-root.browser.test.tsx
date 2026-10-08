import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import "../../dist/styles.css";
import stylesCss from "../../dist/styles.css?raw";
import themesCss from "../../dist/themes.css?raw";
import { tkasCompany } from "../../test/theme-fixtures";
import { stampDensity } from "../../test/themed-browser-render";
import { Frame } from "../components/frame/frame";
import { Table } from "../components/table/table";
import { ThemeScope } from "../theme/theme-scope";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

/**
 * Render into a shadow root that loads the stylesheets itself, as a web-component host does. The
 * document loads Fuse's stylesheet too, which owns the density metrics on `:root`, and the
 * shadow tree inherits them.
 */
function renderInShadowRoot(node: React.ReactNode): ShadowRoot {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `${stylesCss}\n${themesCss}`;
  const mount = document.createElement("div");
  shadow.append(style, mount);
  const root = createRoot(mount);
  flushSync(() => {
    root.render(node);
  });
  cleanups.push(() => {
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  });
  return shadow;
}

/**
 * The tkas corners and the Frame panel padding in px, written out by hand: the panel takes
 * `rounded-xl` (20px) less the Frame's 4px small-tier padding, a Table inside the panel keeps
 * `rounded-xl`, and the panel pads with the large surface tier, 16px dense and 24px comfortable.
 */
const EXPECTED = {
  dense: { panelCorner: "16px", tableCorner: "20px", panelPadding: "16px" },
  comfortable: { panelCorner: "16px", tableCorner: "20px", panelPadding: "24px" },
} as const;

describe("Frame in a shadow root", () => {
  for (const initial of ["dense", "comfortable"] as const) {
    it(`follows the document density, ${initial} first and then switched live`, () => {
      stampDensity(initial);
      const shadow = renderInShadowRoot(
        <ThemeScope theme={tkasCompany}>
          <Frame.Root>
            <Frame.Panel>
              <Table.Root>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>Cell</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Root>
            </Frame.Panel>
          </Frame.Root>
        </ThemeScope>
      );
      // DOM audit: the shadow tree is outside the page's role queries, so the parts are found by slot.
      const panel = shadow.querySelector('[data-slot="frame-panel"]');
      const body = shadow.querySelector('[data-slot="table-body"]');
      const cell = shadow.querySelector("td");
      if (
        !(panel instanceof HTMLElement) ||
        !(body instanceof HTMLElement) ||
        !(cell instanceof HTMLElement)
      ) {
        throw new Error("expected a panel, a table body and a cell in the shadow root");
      }
      const switched = initial === "dense" ? "comfortable" : "dense";
      for (const density of [initial, switched] as const) {
        stampDensity(density);
        const expected = EXPECTED[density];
        expect(getComputedStyle(panel).borderTopLeftRadius, `${density} panel corner`).toBe(
          expected.panelCorner
        );
        expect(getComputedStyle(panel).paddingLeft, `${density} panel padding`).toBe(expected.panelPadding);
        expect(getComputedStyle(body).borderTopLeftRadius, `${density} body corner`).toBe(
          expected.tableCorner
        );
        expect(getComputedStyle(cell).borderTopLeftRadius, `${density} cell corner`).toBe(
          expected.tableCorner
        );
      }
    });
  }
});
