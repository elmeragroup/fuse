import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Frame } from "./frame";

function textNamed(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected text ${name}`);
  }
  return element;
}

function frameRoot(label: string): HTMLElement {
  const root = roleNamed("region", label).firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected frame root in ${label}`);
  }
  return root;
}

describe("Frame", () => {
  it("renders children in order and emits each part's data-slot", () => {
    renderThemed(
      <section aria-label="Invoice frame">
        <Frame.Root>
          <Frame.Header>
            <Frame.Title>Invoices</Frame.Title>
            <Frame.Description>Last 30 days</Frame.Description>
          </Frame.Header>
          <Frame.Panel>March</Frame.Panel>
          <Frame.Footer>Export</Frame.Footer>
        </Frame.Root>
      </section>
    );
    const root = frameRoot("Invoice frame");
    expect(root.getAttribute("data-slot")).toBe("frame");
    expect([...root.children].map((child) => child.getAttribute("data-slot"))).toEqual([
      "frame-panel-header",
      "frame-panel",
      "frame-panel-footer",
    ]);
    expect(textNamed("Invoices").getAttribute("data-slot")).toBe("frame-panel-title");
    expect(textNamed("Last 30 days").getAttribute("data-slot")).toBe("frame-panel-description");
  });

  it("renders real header and footer elements without landmark roles under the div root", () => {
    renderThemed(
      <main>
        <section aria-label="Invoice frame">
          <Frame.Root>
            <Frame.Header>
              <Frame.Title>Invoices</Frame.Title>
            </Frame.Header>
            <Frame.Panel>March</Frame.Panel>
            <Frame.Footer>Export</Frame.Footer>
          </Frame.Root>
        </section>
      </main>
    );
    const title = textNamed("Invoices");
    const header = title.parentElement;
    const footer = textNamed("Export");
    const root = frameRoot("Invoice frame");
    expect(header?.tagName).toBe("HEADER");
    expect(footer.tagName).toBe("FOOTER");
    expect(root.tagName).toBe("DIV");
    expect(header?.getAttribute("role")).toBeNull();
    expect(footer.getAttribute("role")).toBeNull();
    expect(page.getByRole("banner").elements()).toEqual([]);
    expect(page.getByRole("contentinfo").elements()).toEqual([]);
  });

  it("separates adjacent panels with a 4px muted gutter by default", () => {
    renderThemed(
      <Frame.Root>
        <Frame.Panel>March</Frame.Panel>
        <Frame.Panel>April</Frame.Panel>
      </Frame.Root>
    );
    const second = textNamed("April");
    expect(getComputedStyle(second).marginTop).toBe("4px");
    expect(getComputedStyle(second).borderTopWidth).not.toBe("0px");
  });

  it("fuses adjacent panels at stackedPanels with no inner radius or double border", () => {
    renderThemed(
      <Frame.Root stackedPanels>
        <Frame.Panel>March</Frame.Panel>
        <Frame.Panel>April</Frame.Panel>
      </Frame.Root>
    );
    const first = textNamed("March");
    const second = textNamed("April");
    expect(getComputedStyle(first).borderBottomLeftRadius).toBe("0px");
    expect(getComputedStyle(first).borderBottomRightRadius).toBe("0px");
    expect(getComputedStyle(second).borderTopLeftRadius).toBe("0px");
    expect(getComputedStyle(second).borderTopRightRadius).toBe("0px");
    expect(getComputedStyle(second).borderTopWidth).toBe("0px");
    expect(getComputedStyle(second).marginTop).toBe("0px");
    expect(getComputedStyle(first, "::before").display).toBe("none");
  });

  it("keeps the panel hairline overlay non-interactive", () => {
    renderThemed(
      <Frame.Root>
        <Frame.Panel>March</Frame.Panel>
      </Frame.Root>
    );
    const overlay = getComputedStyle(textNamed("March"), "::before");
    expect(overlay.pointerEvents).toBe("none");
    expect(overlay.position).toBe("absolute");
  });
});
