import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, useFakeTimeouts } from "../../../test/animation-frames";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { withLocale } from "../../../test/locale-matrix";
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

  it("holds a hover open back for the provider delay", async () => {
    // Fake timeouts: the delay runs out only when the test moves the clock.
    useFakeTimeouts();
    renderThemed(
      <Tooltip.Provider delay={600}>
        <Tooltip.Root>
          <Tooltip.Trigger>Hint</Tooltip.Trigger>
          <Tooltip.Content>Add to library</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
    await userEvent.hover(roleNamed("button", "Hint"));
    vi.advanceTimersByTime(599);
    await nextFrames(2);
    expect(page.getByRole("tooltip").query()).toBeNull();
    vi.advanceTimersByTime(1);
    await expect.element(page.getByRole("tooltip", { name: "Add to library" })).toBeInTheDocument();
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

describe("Tooltip", () => {
  it("defaults the popup to data-side=top and forwards side/align overrides", async () => {
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

    const tooltip = await mountedTooltip("Add to library");
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

    const placed = roleNamed("tooltip", "Add to library");
    await expect.poll(() => placed.getAttribute("data-side")).toBe("left");
    expect(placed.getAttribute("data-align")).toBe("start");
  });
});

describe("identity", () => {
  function descriptionIds(name: string): string[] {
    return (roleNamed("button", name).getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  }

  function describedText(name: string): string {
    return descriptionIds(name)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
  }

  describe("Tooltip description identity", () => {
    it("keeps custom ids and existing description tokens connected through rerender, close and reopen", async () => {
      const field = (id: string, open: boolean) =>
        withLocale(
          "en-US",
          <>
            <p id="caller-help">Caller guidance</p>
            <Tooltip.Root open={open}>
              <Tooltip.Trigger aria-describedby="caller-help">Help</Tooltip.Trigger>
              <Tooltip.Content id={id}>Account guidance</Tooltip.Content>
            </Tooltip.Root>
          </>
        );
      const { rerender } = renderThemed(field("account-help", true));
      await expect.poll(() => describedText("Help")).toBe("Caller guidance Account guidance");
      await expect
        .element(page.getByRole("button", { name: "Help" }))
        .toHaveAccessibleDescription("Caller guidance Account guidance");
      expect(descriptionIds("Help")).toEqual(["caller-help", "account-help"]);
      expect(roleNamed("tooltip", "Account guidance").id).toBe("account-help");
      rerender(field("renamed-help", true));
      await expect.poll(() => descriptionIds("Help")).toEqual(["caller-help", "renamed-help"]);
      expect(document.getElementById("account-help")).toBeNull();
      rerender(field("renamed-help", false));
      await expect.poll(() => page.getByRole("tooltip").query()).toBeNull();
      expect(descriptionIds("Help")).toEqual(["caller-help"]);
      await expect
        .element(page.getByRole("button", { name: "Help" }))
        .toHaveAccessibleDescription("Caller guidance");
      rerender(field("renamed-help", true));
      await expect.poll(() => describedText("Help")).toBe("Caller guidance Account guidance");
      expect(descriptionIds("Help")).toEqual(["caller-help", "renamed-help"]);
    });

    it("follows the actual custom render element id across commits", async () => {
      const field = (id: string) =>
        withLocale(
          "en-US",
          <Tooltip.Root open>
            <Tooltip.Trigger>Rendered help</Tooltip.Trigger>
            <Tooltip.Content render={<div id={id} />}>Rendered guidance</Tooltip.Content>
          </Tooltip.Root>
        );
      const { rerender } = renderThemed(field("rendered-help"));
      await expect
        .element(page.getByRole("button", { name: "Rendered help" }))
        .toHaveAccessibleDescription("Rendered guidance");
      expect(descriptionIds("Rendered help")).toEqual(["rendered-help"]);
      rerender(field("updated-rendered-help"));
      await expect.poll(() => descriptionIds("Rendered help")).toEqual(["updated-rendered-help"]);
      await expect
        .element(page.getByRole("button", { name: "Rendered help" }))
        .toHaveAccessibleDescription("Rendered guidance");
    });

    it("keeps generated and custom tooltip identities separate across multiple instances", async () => {
      renderThemed(
        withLocale(
          "en-US",
          <>
            <Tooltip.Root open>
              <Tooltip.Trigger>Generated</Tooltip.Trigger>
              <Tooltip.Content>Generated guidance</Tooltip.Content>
            </Tooltip.Root>
            <Tooltip.Root open>
              <Tooltip.Trigger>Custom</Tooltip.Trigger>
              <Tooltip.Content id="custom-help">Custom guidance</Tooltip.Content>
            </Tooltip.Root>
          </>
        )
      );
      await expect.poll(() => describedText("Generated")).toBe("Generated guidance");
      await expect.poll(() => describedText("Custom")).toBe("Custom guidance");
      expect(descriptionIds("Generated")).not.toContain("custom-help");
      expect(descriptionIds("Custom")).toEqual(["custom-help"]);
      expect(roleNamed("tooltip", "Generated guidance").id).not.toBe("custom-help");
    });
  });
});
