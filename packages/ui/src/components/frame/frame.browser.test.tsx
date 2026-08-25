import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Frame } from "./frame";

function slot(name: string): HTMLElement {
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

function panels(): HTMLElement[] {
  return [...document.querySelectorAll('[data-slot="frame-panel"]')].filter(
    (element): element is HTMLElement => element instanceof HTMLElement
  );
}

describe("Frame", () => {
  it("renders children in order and emits each part's data-slot", () => {
    renderThemed(
      <Frame.Root>
        <Frame.Header>
          <Frame.Title>Invoices</Frame.Title>
          <Frame.Description>Last 30 days</Frame.Description>
        </Frame.Header>
        <Frame.Panel>March</Frame.Panel>
        <Frame.Footer>Export</Frame.Footer>
      </Frame.Root>
    );
    const root = slot("frame");
    expect([...root.children].map((child) => child.getAttribute("data-slot"))).toEqual([
      "frame-panel-header",
      "frame-panel",
      "frame-panel-footer",
    ]);
    expect(slot("frame-panel-title").textContent).toBe("Invoices");
    expect(slot("frame-panel-description").textContent).toBe("Last 30 days");
  });

  it("renders real header and footer elements without landmark roles under the div root", () => {
    renderThemed(
      <main>
        <Frame.Root>
          <Frame.Header>
            <Frame.Title>Invoices</Frame.Title>
          </Frame.Header>
          <Frame.Panel>March</Frame.Panel>
          <Frame.Footer>Export</Frame.Footer>
        </Frame.Root>
      </main>
    );
    const header = slot("frame-panel-header");
    const footer = slot("frame-panel-footer");
    expect(header.tagName).toBe("HEADER");
    expect(footer.tagName).toBe("FOOTER");
    expect(slot("frame").tagName).toBe("DIV");
    expect(header.getAttribute("role")).toBeNull();
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
    const [first, second] = panels();
    if (first === undefined || second === undefined) {
      throw new Error("expected two panels");
    }
    expect(getComputedStyle(second).marginTop).toBe("4px");
    expect(first.className.split(/\s+/)).toContain("rounded-xl");
    expect(second.className.split(/\s+/)).toContain("rounded-xl");
    expect(first.className).not.toContain("rounded-b-none");
    expect(second.className).not.toContain("rounded-t-none");
    expect(getComputedStyle(second).borderTopWidth).not.toBe("0px");
  });

  it("fuses adjacent panels at stackedPanels with no inner radius or double border", () => {
    renderThemed(
      <Frame.Root stackedPanels>
        <Frame.Panel>March</Frame.Panel>
        <Frame.Panel>April</Frame.Panel>
      </Frame.Root>
    );
    const [first, second] = panels();
    if (first === undefined || second === undefined) {
      throw new Error("expected two panels");
    }
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
    const overlay = getComputedStyle(slot("frame-panel"), "::before");
    expect(overlay.pointerEvents).toBe("none");
    expect(overlay.position).toBe("absolute");
  });
});
