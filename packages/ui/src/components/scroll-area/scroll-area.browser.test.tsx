import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render as renderBrowser } from "../../../test/browser-render";
import { focusRing } from "../../styles/utils";
import { ThemeScope } from "../../theme";
import { ScrollArea } from "./scroll-area";

const fkasPrivate = { variant: "internal", brand: "fkas", segment: "private" } as const;
const focusSelf = focusRing({ target: "self" }).root();

afterEach(() => {
  for (const styles of document.querySelectorAll("[data-scroll-area-test-styles]")) {
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
  return renderBrowser(<ThemeScope theme={fkasPrivate}>{node}</ThemeScope>);
}

function labeledText(name: string): HTMLElement {
  const element = page.getByText(name, { exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected labeled text ${name}`);
  }
  return element;
}

function scrollRootFromText(name: string): HTMLElement {
  const root = labeledText(name).closest("[data-slot=scroll-area]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`Expected a scroll area around ${name}`);
  }
  return root;
}

function viewportFromText(name: string): HTMLElement {
  const viewport = labeledText(name).closest("[data-slot=scroll-area-viewport]");
  if (!(viewport instanceof HTMLElement)) {
    throw new Error(`Expected a viewport around ${name}`);
  }
  return viewport;
}

function barsIn(root: HTMLElement): HTMLElement[] {
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
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(viewport.className.split(/\s+/)).toContain(token);
    }
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

    const always = barsIn(scrollRootFromText("Always on"));
    expect(always).toHaveLength(1);
    expect(always[0]?.className.split(/\s+/)).toContain("opacity-100");
    expect(always[0]?.className.split(/\s+/)).not.toContain("pointer-events-none");

    const hover = barsIn(scrollRootFromText("Hover gated"));
    expect(hover).toHaveLength(1);
    expect(hover[0]?.className.split(/\s+/)).toContain("pointer-events-none");
    expect(hover[0]?.className).toContain("data-[hovering]:opacity-100");
    expect(hover[0]?.className).toContain("data-[hovering]:pointer-events-auto");
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
