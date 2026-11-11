import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { ScrollArea } from "./index";

afterEach(() => {
  // Injected test styles have no role; remove them by the marker attribute.
  for (const styles of document.head.querySelectorAll("[data-scroll-area-test-styles]")) {
    styles.remove();
  }
});

function render(node: ReactNode) {
  const styles = document.createElement("style");
  styles.dataset.scrollAreaTestStyles = "";
  styles.textContent = [
    "html, body { margin: 0; height: 100%; overflow: hidden; }",
    '[data-slot="scroll-area-viewport"] { width: 100%; height: 100%; box-sizing: border-box; }',
    // Visibility, not the fade, is the contract, so a hover bar reaches its end opacity at once.
    '[data-slot="scroll-area-scrollbar"] { transition: none; }',
  ].join("");
  document.head.append(styles);
  return renderThemed(node);
}

function labeledText(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected labeled text ${name}`);
  }
  return element;
}

function scrollRootFromText(name: string): HTMLElement {
  // The overflow host has no role; locate it by the mandated data-slot.
  const root = labeledText(name).closest("[data-slot=scroll-area]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`Expected a scroll area around ${name}`);
  }
  return root;
}

function viewportFromText(name: string): HTMLElement {
  // The viewport has no role; locate it by the mandated data-slot.
  const viewport = labeledText(name).closest("[data-slot=scroll-area-viewport]");
  if (!(viewport instanceof HTMLElement)) {
    throw new Error(`Expected a viewport around ${name}`);
  }
  return viewport;
}

function barsIn(root: HTMLElement): HTMLElement[] {
  // Scrollbars have no role; locate them by the mandated data-slot.
  return [...root.querySelectorAll("[data-slot=scroll-area-scrollbar]")].filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  );
}

async function waitForOverflow(name: string, attribute: "data-has-overflow-y" | "data-has-overflow-x") {
  await expect.poll(() => scrollRootFromText(name).hasAttribute(attribute)).toBe(true);
}

function TallList({ label, items }: { label: string; items: number }) {
  return (
    <ul>
      <li>{label}</li>
      {Array.from({ length: items }, (_, index) => (
        <li key={index}>{`${label} row ${String(index + 1)}`}</li>
      ))}
    </ul>
  );
}

describe("ScrollArea", () => {
  it("keeps an always bar visible and reveals a hover bar only while its own area is hovered", async () => {
    render(
      <>
        <ScrollArea.Root type="always" style={{ height: 128 }}>
          <TallList label="Always on" items={20} />
        </ScrollArea.Root>
        <ScrollArea.Root type="hover" style={{ height: 128 }}>
          <TallList label="Hover gated" items={20} />
        </ScrollArea.Root>
      </>
    );

    await waitForOverflow("Always on", "data-has-overflow-y");
    await waitForOverflow("Hover gated", "data-has-overflow-y");

    const always = barsIn(scrollRootFromText("Always on"))[0];
    if (!(always instanceof HTMLElement)) {
      throw new Error("expected an always-visible scrollbar");
    }
    expect(getComputedStyle(always).opacity).toBe("1");

    const hover = barsIn(scrollRootFromText("Hover gated"))[0];
    if (!(hover instanceof HTMLElement)) {
      throw new Error("expected a hover-gated scrollbar");
    }
    await userEvent.hover(labeledText("Always on"));
    await expect.poll(() => Number.parseFloat(getComputedStyle(hover).opacity)).toBe(0);
    expect(getComputedStyle(hover).pointerEvents).toBe("none");

    await userEvent.hover(labeledText("Hover gated"));
    await expect.poll(() => Number.parseFloat(getComputedStyle(hover).opacity)).toBe(1);
    expect(getComputedStyle(hover).pointerEvents).toBe("auto");
  });

  it("keeps ArrowDown and PageDown on a focused overflow viewport as native scroll", async () => {
    render(
      <ScrollArea.Root style={{ height: 128 }}>
        <TallList label="Keyboard list" items={30} />
      </ScrollArea.Root>
    );

    await waitForOverflow("Keyboard list", "data-has-overflow-y");
    const viewport = viewportFromText("Keyboard list");
    expect(viewport.tabIndex).toBe(0);

    await userEvent.click(viewport);
    expect(document.activeElement).toBe(viewport);
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    expect(getComputedStyle(viewport).overflowY).toBe("scroll");

    // Trusted ArrowDown/PageDown in this iframe never move scrollTop; the default must stay uncancelled.
    const arrow = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    const pageDown = new KeyboardEvent("keydown", { key: "PageDown", bubbles: true, cancelable: true });
    expect(viewport.dispatchEvent(arrow)).toBe(true);
    expect(viewport.dispatchEvent(pageDown)).toBe(true);
    expect(arrow.defaultPrevented).toBe(false);
    expect(pageDown.defaultPrevented).toBe(false);

    await userEvent.wheel(viewport, { delta: { y: 160 } });
    expect(viewport.scrollTop).toBeGreaterThan(0);
  });
});
