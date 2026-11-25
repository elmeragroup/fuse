import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { rows } from "../../../test/chart/sparkline";
import { withForcedColors } from "../../../test/media-emulation";
import { toSrgb } from "../../../test/surface-paint";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
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

// Inline, so the line truncates whether or not the built stylesheet carries Tailwind's `truncate`.
const TRUNCATED_LINE = { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } as const;
const LONG_LINE = "A single line of text far longer than the narrow scroll area that holds it";

/**
 * The colors of the root's screenshot halfway across its padding box: the two rows of its top edge,
 * then the one row just inside them.
 */
async function topEdge(root: HTMLElement): Promise<{ edge: number[][]; inner: number[][] }> {
  const column = root.clientLeft + Math.round(root.clientWidth / 2);
  const samples = await rows(
    root,
    column,
    [0, 1, 2].map((row) => root.clientTop + row)
  );
  return { edge: samples.slice(0, 2), inner: samples.slice(2) };
}

/**
 * Tabs into the "Focus list" area and checks what the screen shows: the viewport takes keyboard
 * focus, and the 2px at the top of the root's padding box change color while the row below them keeps
 * its color. Outside forced-colors mode, the changed edge is the `--ring` color.
 */
async function expectFocusPaint(forcedColors: "none" | "active"): Promise<void> {
  await waitForOverflow("Focus list", "data-has-overflow-y");
  const root = scrollRootFromText("Focus list");
  const viewport = viewportFromText("Focus list");
  page.getByRole("button", { name: "Before the area" }).element().focus();
  const before = await topEdge(root);
  await userEvent.tab();
  expect(document.activeElement).toBe(viewport);
  expect(viewport.matches(":focus-visible")).toBe(true);
  const after = await topEdge(root);

  for (const [index, row] of after.edge.entries()) {
    expect(row, `edge row ${String(index)}`).not.toEqual(before.edge[index]);
  }
  expect(after.inner, "inner row").toEqual(before.inner);
  if (forcedColors === "none") {
    const { r, g, b, alpha } = toSrgb(cssVarColor(viewport, "--ring"));
    const ring = [r, g, b, alpha].map((channel) => channel * 255);
    for (const [index, row] of after.edge.entries()) {
      for (const [channel, value] of ring.entries()) {
        expect(
          Math.abs((row[channel] ?? Number.NaN) - value),
          `edge row ${String(index)}`
        ).toBeLessThanOrEqual(1);
      }
    }
  }
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

  it.each(["ArrowDown", "PageDown"])("scrolls a focused overflow viewport natively on %s", async (key) => {
    render(
      <ScrollArea.Root style={{ height: 128 }}>
        <TallList label="Keyboard list" items={30} />
      </ScrollArea.Root>
    );

    await waitForOverflow("Keyboard list", "data-has-overflow-y");
    const viewport = viewportFromText("Keyboard list");
    expect(viewport.tabIndex).toBe(0);

    viewport.focus();
    expect(document.activeElement).toBe(viewport);
    expect(viewport.scrollTop).toBe(0);

    const keydowns: KeyboardEvent[] = [];
    viewport.addEventListener("keydown", (event) => keydowns.push(event));
    await userEvent.keyboard(`{${key}}`);
    // The browser scrolls after the trusted keydown resolves.
    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
    // A script can move scrollTop after cancelling the key, so the scroll alone does not prove a native one.
    expect(
      keydowns.map((event) => ({
        key: event.key,
        isTrusted: event.isTrusted,
        defaultPrevented: event.defaultPrevented,
      }))
    ).toEqual([{ key, isTrusted: true, defaultPrevented: false }]);
  });

  it("scrolls an overflow viewport natively on a trusted wheel", async () => {
    render(
      <ScrollArea.Root style={{ height: 128 }}>
        <TallList label="Wheel list" items={30} />
      </ScrollArea.Root>
    );

    await waitForOverflow("Wheel list", "data-has-overflow-y");
    const viewport = viewportFromText("Wheel list");
    viewport.focus();
    expect(document.activeElement).toBe(viewport);

    const wheels: WheelEvent[] = [];
    viewport.addEventListener("wheel", (event) => wheels.push(event), { passive: true });
    await userEvent.wheel(viewport, { delta: { y: 160 } });
    // userEvent.wheel can resolve before Chromium updates scrollTop.
    await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0);
    expect(wheels.map(({ isTrusted, defaultPrevented }) => ({ isTrusted, defaultPrevented }))).toEqual([
      { isTrusted: true, defaultPrevented: false },
    ]);
  });

  describe.each(["none", "active"] as const)("with forced colors %s", (forcedColors) => {
    it.each([
      {
        content: "a sticky header",
        area: (
          <ScrollArea.Root style={{ width: 320, height: 128 }}>
            <div className="bg-background" style={{ position: "sticky", top: 0, zIndex: 20, height: 24 }}>
              Sticky header
            </div>
            <TallList label="Focus list" items={30} />
          </ScrollArea.Root>
        ),
      },
      {
        content: "an opaque raised banner",
        area: (
          <ScrollArea.Root style={{ width: 320, height: 128 }}>
            <div className="bg-background" style={{ position: "relative", zIndex: 40, height: 24 }}>
              Raised banner
            </div>
            <TallList label="Focus list" items={30} />
          </ScrollArea.Root>
        ),
      },
      {
        content: "a padded area whose render wraps its parts in a contents box",
        area: (
          <ScrollArea.Root
            className="p-2"
            style={{ width: 320, height: 128 }}
            render={(props) => (
              <div {...props}>
                <div style={{ display: "contents" }}>{props.children}</div>
              </div>
            )}>
            <TallList label="Focus list" items={30} />
          </ScrollArea.Root>
        ),
      },
    ])("paints the keyboard focus indicator at the edge of $content", async ({ area }) => {
      await withForcedColors(forcedColors, async () => {
        render(
          <>
            <button type="button">Before the area</button>
            {area}
          </>
        );
        await expectFocusPaint(forcedColors);
      });
    });
  });

  it("keeps the focus indicator under a host's sticky header that covers part of the area", async () => {
    const headerColor = "rgb(200, 30, 120)";
    render(
      <>
        <button type="button">Before the area</button>
        <div style={{ position: "sticky", top: 0, zIndex: 10, height: 40, background: headerColor }} />
        <ScrollArea.Root style={{ width: 320, height: 128, marginTop: -20 }}>
          <TallList label="Focus list" items={30} />
        </ScrollArea.Root>
      </>
    );
    await waitForOverflow("Focus list", "data-has-overflow-y");
    const root = scrollRootFromText("Focus list");
    page.getByRole("button", { name: "Before the area" }).element().focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(viewportFromText("Focus list"));

    const header = [200, 30, 120, 255];
    const [left, right] = [root.clientLeft, root.clientLeft + root.clientWidth - 1];
    // The top edge runs under the header's bottom 20px, and so do the first rows of the side edges.
    expect(await topEdge(root)).toEqual({ edge: [header, header], inner: [header] });
    for (const column of [left, right]) {
      expect(await rows(root, column, [root.clientTop + 10]), `column ${String(column)}`).toEqual([header]);
    }
  });

  it("lets a raised element inside an unfocused area take the pointer over a lower sibling of the area", async () => {
    render(
      <div style={{ position: "relative" }}>
        <ScrollArea.Root style={{ width: 320, height: 128 }}>
          <TallList label="Menu list" items={30} />
          <button type="button" style={{ position: "absolute", top: 8, left: 8, zIndex: 50 }}>
            Inline menu item
          </button>
        </ScrollArea.Root>
        <div style={{ position: "absolute", inset: "0 0 auto 0", height: 48, zIndex: 10 }} />
      </div>
    );
    await waitForOverflow("Menu list", "data-has-overflow-y");
    const item = page.getByRole("button", { name: "Inline menu item" }).element();
    const box = item.getBoundingClientRect();
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(item);
  });

  it("lets a raised element in an outer area take the pointer while a nested area's viewport has focus", async () => {
    render(
      <div style={{ position: "relative" }}>
        <ScrollArea.Root style={{ width: 320, height: 160 }}>
          <button type="button" style={{ position: "absolute", top: 8, left: 8, zIndex: 50 }}>
            Inline menu item
          </button>
          <ScrollArea.Root style={{ width: 280, height: 96 }}>
            <TallList label="Inner list" items={30} />
          </ScrollArea.Root>
          <TallList label="Outer list" items={30} />
        </ScrollArea.Root>
        <div style={{ position: "absolute", inset: "0 0 auto 0", height: 80, zIndex: 10 }} />
      </div>
    );
    await waitForOverflow("Inner list", "data-has-overflow-y");
    const inner = viewportFromText("Inner list");
    inner.focus({ preventScroll: true });
    expect(inner.matches(":focus-visible")).toBe(true);

    const item = page.getByRole("button", { name: "Inline menu item" }).element();
    const box = item.getBoundingClientRect();
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(item);
  });

  it("holds a vertical area's content to the viewport so a truncated line ellipsizes at its edge", () => {
    render(
      <ScrollArea.Root style={{ width: 160, height: 96 }}>
        <p style={TRUNCATED_LINE}>{LONG_LINE}</p>
      </ScrollArea.Root>
    );

    const line = labeledText(LONG_LINE);
    const viewport = viewportFromText(LONG_LINE);
    // The line keeps more text than it shows: it is clipped, not widened to its length.
    expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
    expect(line.getBoundingClientRect().width).toBe(viewport.clientWidth);
    // Nothing reaches past the viewport, so there is no horizontal scroll.
    expect(viewport.scrollWidth).toBe(viewport.clientWidth);
  });

  it("lets a horizontal area's content grow to its widest line so the viewport scrolls across it", () => {
    render(
      <ScrollArea.Root orientation="horizontal" style={{ width: 160, height: 96 }}>
        <p style={TRUNCATED_LINE}>{LONG_LINE}</p>
      </ScrollArea.Root>
    );

    const line = labeledText(LONG_LINE);
    const viewport = viewportFromText(LONG_LINE);
    // The whole line shows; the viewport overflows sideways instead.
    expect(line.scrollWidth).toBe(line.clientWidth);
    expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
  });
});
