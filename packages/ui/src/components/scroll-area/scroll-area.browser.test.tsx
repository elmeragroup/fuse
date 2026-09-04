import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { ScrollArea } from "./scroll-area";

afterEach(() => {
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
  // spec §9: the overflow host has no role; locate it by the mandated data-slot.
  const root = labeledText(name).closest("[data-slot=scroll-area]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`Expected a scroll area around ${name}`);
  }
  return root;
}

function viewportFromText(name: string): HTMLElement {
  // spec §9: the viewport has no role; locate it by the mandated data-slot.
  const viewport = labeledText(name).closest("[data-slot=scroll-area-viewport]");
  if (!(viewport instanceof HTMLElement)) {
    throw new Error(`Expected a viewport around ${name}`);
  }
  return viewport;
}

function barsIn(root: HTMLElement): HTMLElement[] {
  // spec §9: scrollbars have no role; locate them by the mandated data-slot.
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
  it("renders content inside the viewport and composes the self focus ring", async () => {
    render(
      <ScrollArea.Root style={{ height: 128 }}>
        <TallList label="Tags" items={20} />
      </ScrollArea.Root>
    );

    await expect.element(page.getByText("Tags", { exact: true })).toBeVisible();
    await waitForOverflow("Tags", "data-has-overflow-y");

    const viewport = viewportFromText("Tags");
    expect(viewport.contains(labeledText("Tags"))).toBe(true);
    expect(viewport.getAttribute("data-slot")).toBe("scroll-area-viewport");
    expect(viewport.tabIndex).toBe(0);
  });

  it("renders exactly one scrollbar for the Root orientation", async () => {
    render(
      <>
        <ScrollArea.Root style={{ height: 128 }}>
          <TallList label="Vertical tags" items={20} />
        </ScrollArea.Root>
        <ScrollArea.Root orientation="horizontal" style={{ width: 128 }}>
          <div style={{ width: 480 }}>{`Horizontal strip`}</div>
        </ScrollArea.Root>
      </>
    );

    await waitForOverflow("Vertical tags", "data-has-overflow-y");
    await waitForOverflow("Horizontal strip", "data-has-overflow-x");

    const verticalBars = barsIn(scrollRootFromText("Vertical tags"));
    expect(verticalBars).toHaveLength(1);
    expect(verticalBars[0]?.getAttribute("data-orientation")).toBe("vertical");

    const horizontalBars = barsIn(scrollRootFromText("Horizontal strip"));
    expect(horizontalBars).toHaveLength(1);
    expect(horizontalBars[0]?.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("maps type to keepMounted visibility classes", async () => {
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

  it("mounts no scrollbar for overflow-free auto and hover content", async () => {
    render(
      <>
        <ScrollArea.Root type="auto" style={{ height: 192 }}>
          <p>Fits auto</p>
        </ScrollArea.Root>
        <ScrollArea.Root type="hover" style={{ height: 192 }}>
          <p>Fits hover</p>
        </ScrollArea.Root>
        <ScrollArea.Root type="always" style={{ height: 192 }}>
          <p>Fits always</p>
        </ScrollArea.Root>
      </>
    );

    await expect
      .poll(() => {
        const bar = barsIn(scrollRootFromText("Fits always"))[0];
        return bar !== undefined && getComputedStyle(bar).visibility !== "hidden";
      })
      .toBe(true);
    expect(barsIn(scrollRootFromText("Fits auto"))).toHaveLength(0);
    expect(barsIn(scrollRootFromText("Fits hover"))).toHaveLength(0);
    expect(scrollRootFromText("Fits always").hasAttribute("data-has-overflow-y")).toBe(false);
  });
});
