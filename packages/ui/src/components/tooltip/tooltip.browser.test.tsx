import { useRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Tooltip } from "./tooltip";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function triggerNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected trigger ${name}`);
  }
  return element;
}

function tooltipNamed(name: string): HTMLElement {
  const element = page.getByRole("tooltip", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected tooltip ${name}`);
  }
  return element;
}

async function hoverOpen(name: string, tooltipName = name): Promise<HTMLElement> {
  await userEvent.hover(triggerNamed(name));
  await vi.waitFor(() => {
    expect(page.getByRole("tooltip", { name: tooltipName, exact: true }).query()).not.toBeNull();
  });
  return tooltipNamed(tooltipName);
}

describe("Tooltip", () => {
  it("opens on hover after the provider delay and hides on unhover", async () => {
    renderThemed(
      <>
        <p>Outside</p>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger>Hint</Tooltip.Trigger>
            <Tooltip.Content>Add to library</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </>
    );

    const tooltip = await hoverOpen("Hint", "Add to library");
    expect(tooltip.getAttribute("data-slot")).toBe("tooltip-content");

    await userEvent.hover(page.getByText("Outside", { exact: true }).element());
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip").query()).toBeNull();
    });
  });

  it("opens instantly on keyboard focus, closes on blur, and closes immediately on Escape", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Tooltip.Provider delay={400}>
          <Tooltip.Root>
            <Tooltip.Trigger>Hint</Tooltip.Trigger>
            <Tooltip.Content>Add to library</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <button type="button">After</button>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }

    await userEvent.click(previous);
    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: "Add to library", exact: true }).query()).not.toBeNull();
    });

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip").query()).toBeNull();
    });
    expect(document.activeElement).toBe(triggerNamed("Hint"));

    await userEvent.click(previous);
    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: "Add to library", exact: true }).query()).not.toBeNull();
    });

    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip").query()).toBeNull();
    });
  });

  it("wires the trigger's accessible description to the tooltip text while open", async () => {
    renderThemed(
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>Hint</Tooltip.Trigger>
          <Tooltip.Content>Add to library</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );

    const trigger = triggerNamed("Hint");
    await hoverOpen("Hint", "Add to library");
    await expect.element(trigger).toHaveAccessibleDescription("Add to library");
  });

  it("opens a neighbor without re-waiting the delay inside one Provider group", async () => {
    renderThemed(
      <Tooltip.Provider delay={400}>
        <Tooltip.Root>
          <Tooltip.Trigger>First</Tooltip.Trigger>
          <Tooltip.Content>First tip</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>Second</Tooltip.Trigger>
          <Tooltip.Content>Second tip</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );

    await hoverOpen("First", "First tip");
    const started = performance.now();
    await userEvent.hover(triggerNamed("Second"));
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: "Second tip", exact: true }).query()).not.toBeNull();
    });
    expect(performance.now() - started).toBeLessThan(250);
  });

  it("does not open a per-tooltip delay Root before the delay, even after a grouped sibling", async () => {
    renderThemed(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger>Grouped</Tooltip.Trigger>
          <Tooltip.Content>Grouped tip</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root delay={400}>
          <Tooltip.Trigger>Scoped</Tooltip.Trigger>
          <Tooltip.Content>Scoped tip</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );

    await hoverOpen("Grouped", "Grouped tip");
    await userEvent.hover(triggerNamed("Scoped"));
    await sleep(120);
    expect(page.getByRole("tooltip", { name: "Scoped tip", exact: true }).query()).toBeNull();

    await vi.waitFor(
      () => {
        expect(page.getByRole("tooltip", { name: "Scoped tip", exact: true }).query()).not.toBeNull();
      },
      { timeout: 1000 }
    );
  });

  it("defaults the popup to data-side=top and forwards side/align overrides", () => {
    const { rerender } = renderThemed(
      <div style={{ padding: 240 }}>
        <Tooltip.Provider>
          <Tooltip.Root defaultOpen>
            <Tooltip.Trigger>Hint</Tooltip.Trigger>
            <Tooltip.Content>Add to library</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    );

    const tooltip = tooltipNamed("Add to library");
    expect(tooltip.getAttribute("data-side")).toBe("top");
    const arrow = tooltip.querySelector("[data-side]");
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute("data-side")).toBe("top");

    rerender(
      <div style={{ padding: 240 }}>
        <Tooltip.Provider>
          <Tooltip.Root defaultOpen>
            <Tooltip.Trigger>Hint</Tooltip.Trigger>
            <Tooltip.Content side="left" align="start">
              Add to library
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
    );

    const placed = tooltipNamed("Add to library");
    expect(placed.getAttribute("data-side")).toBe("left");
    expect(placed.getAttribute("data-align")).toBe("start");
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>Hint</Tooltip.Trigger>
          <Tooltip.Content>Add to library</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
    const scope = host.querySelector("[data-theme-brand]");
    const tooltip = await hoverOpen("Hint", "Add to library");
    expect(scope).not.toBeNull();
    expect(scope?.contains(tooltip)).toBe(true);
    expect([...document.body.children].includes(tooltip)).toBe(false);
  });

  it("portals into an explicit container element", () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <Tooltip.Provider>
              <Tooltip.Root defaultOpen>
                <Tooltip.Content container={node}>Add to library</Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          ) : null}
        </>
      );
    }
    renderThemed(<ExplicitContainer />);
    const tooltip = tooltipNamed("Add to library");
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(tooltip)).toBe(true);
    expect([...document.body.children].includes(tooltip)).toBe(false);
  });

  it("waits while the resolved container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Tooltip.Provider>
          <Tooltip.Root open>
            <Tooltip.Content container={ref}>Pending</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      );
    }
    renderThemed(<NeverAttached />);

    expect(page.getByRole("tooltip").query()).toBeNull();
    expect(document.querySelector("[data-slot=tooltip-content]")).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    renderThemed(
      <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
        <Tooltip.Provider>
          <Tooltip.Root open>
            <Tooltip.Content>Scoped</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </ThemeScope>
    );
    const tooltip = page.getByRole("tooltip").element();
    const scope = tooltip.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
    expect([...document.body.children].includes(tooltip)).toBe(false);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger>Hint</Tooltip.Trigger>
            <Tooltip.Content>Add to library</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = triggerNamed("Hint");
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });
});
