import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Tooltip } from "./index";

async function hoverOpen(name: string, tooltipName = name): Promise<HTMLElement> {
  await userEvent.hover(roleNamed("button", name));
  await vi.waitFor(() => {
    expect(page.getByRole("tooltip", { name: tooltipName, exact: true }).query()).not.toBeNull();
  });
  return roleNamed("tooltip", tooltipName);
}

/** An open-on-mount tooltip still mounts its popup after the first commit, so wait for it. */
async function mountedTooltip(name?: string): Promise<HTMLElement> {
  const locator = page.getByRole("tooltip", name === undefined ? {} : { name, exact: true });
  await expect.element(locator).toBeInTheDocument();
  const element = locator.element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a tooltip");
  }
  return element;
}

describe("Tooltip", () => {
  // The provider's delay is zero, so the opening waits on no clock.
  it("opens on hover and hides on unhover", async () => {
    renderThemed(
      <>
        <p>Outside</p>
        <Tooltip.Provider delay={0}>
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

  it("hands the open delay to a grouped neighbor but not to a Root with its own delay", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        {/* A delay no test waits out: only the group hand-off can open a neighbor in time. */}
        <Tooltip.Provider delay={60_000}>
          <Tooltip.Root>
            <Tooltip.Trigger>First</Tooltip.Trigger>
            <Tooltip.Content>First tip</Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger>Second</Tooltip.Trigger>
            <Tooltip.Content>Second tip</Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root delay={60_000}>
            <Tooltip.Trigger>Scoped</Tooltip.Trigger>
            <Tooltip.Content>Scoped tip</Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </>
    );

    // Keyboard focus opens a tooltip at once, whatever the delay.
    await userEvent.click(roleNamed("button", "Before"));
    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByRole("tooltip", { name: "First tip", exact: true })).toBeInTheDocument();

    await hoverOpen("Second", "Second tip");

    await userEvent.hover(roleNamed("button", "Scoped"));
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: "Second tip", exact: true }).query()).toBeNull();
    });
    // A hand-off opens a neighbour on the next render; a Root with its own delay waits it out.
    await nextFrames(2);
    expect(page.getByRole("tooltip", { name: "Scoped tip", exact: true }).query()).toBeNull();
  });

  it("portals into an explicit container element", async () => {
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
    const tooltip = await mountedTooltip("Add to library");
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(tooltip)).toBe(true);
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
    const trigger = roleNamed("button", "Hint");
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });
});
