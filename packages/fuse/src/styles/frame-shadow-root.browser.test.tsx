import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import stylesCss from "../../dist/styles.css?raw";
import themesCss from "../../dist/themes.css?raw";
import { tkasCompany } from "../../test/theme-fixtures";
import { Frame } from "../components/frame/frame";
import { Table } from "../components/table/table";
import { ThemeScope } from "../theme/theme-scope";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

/** Render into a shadow root whose stylesheets load only inside it, as a web-component host does. */
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

describe("Frame in a shadow root", () => {
  it("keeps a Table inside a panel at rounded-xl when the stylesheets load only in the shadow root", () => {
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
    if (!(panel instanceof HTMLElement) || !(body instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
      throw new Error("expected a panel, a table body and a cell in the shadow root");
    }
    // tkas: the panel takes `rounded-xl` (20px) less the Frame's 4px, and the table inside it,
    // 25px from the Frame's edge, keeps `rounded-xl`.
    expect(getComputedStyle(panel).borderTopLeftRadius).toBe("16px");
    expect(getComputedStyle(body).borderTopLeftRadius).toBe("20px");
    expect(getComputedStyle(cell).borderTopLeftRadius).toBe("20px");
  });
});
