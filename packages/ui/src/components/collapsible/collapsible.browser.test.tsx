import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { Collapsible } from "./collapsible";

function triggerNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected trigger ${name}`);
  }
  return element;
}

function panel(): HTMLElement | null {
  const element = document.querySelector('[data-slot="collapsible-content"]');
  return element instanceof HTMLElement ? element : null;
}

describe("Collapsible", () => {
  it("toggles the panel on click and wires aria-expanded plus aria-controls", async () => {
    renderThemed(
      <Collapsible.Root>
        <Collapsible.Trigger>Show details</Collapsible.Trigger>
        <Collapsible.Content>Delivery window</Collapsible.Content>
      </Collapsible.Root>
    );

    const trigger = triggerNamed("Show details");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
    expect(panel()).toBeNull();

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(page.getByText("Delivery window", { exact: true }).query()).not.toBeNull();
    });
    const controls = trigger.getAttribute("aria-controls");
    const openPanel = panel();
    expect(controls).toBeTruthy();
    expect(openPanel).not.toBeNull();
    expect(openPanel?.id).toBe(controls);

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
    });
  });

  it("toggles from Tab focus with Enter and with Space", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Collapsible.Root>
          <Collapsible.Trigger>Show details</Collapsible.Trigger>
          <Collapsible.Content>Delivery window</Collapsible.Content>
        </Collapsible.Root>
      </>
    );

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(triggerNamed("Show details"));

    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(triggerNamed("Show details").getAttribute("aria-expanded")).toBe("true");
      expect(page.getByText("Delivery window", { exact: true }).query()).not.toBeNull();
    });

    await userEvent.keyboard(" ");
    await vi.waitFor(() => {
      expect(triggerNamed("Show details").getAttribute("aria-expanded")).toBe("false");
      expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
    });
  });

  it("round-trips controlled open and renders defaultOpen initially", async () => {
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Collapsible.Root
          open={open}
          onOpenChange={(next, details) => {
            onOpenChange(next, details);
            setOpen(next);
          }}>
          <Collapsible.Trigger>Show details</Collapsible.Trigger>
          <Collapsible.Content>Delivery window</Collapsible.Content>
        </Collapsible.Root>
      );
    }

    renderThemed(
      <>
        <Controlled />
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Initially open</Collapsible.Trigger>
          <Collapsible.Content>Already visible</Collapsible.Content>
        </Collapsible.Root>
      </>
    );

    expect(triggerNamed("Show details").getAttribute("aria-expanded")).toBe("false");
    expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
    expect(triggerNamed("Initially open").getAttribute("aria-expanded")).toBe("true");
    expect(page.getByText("Already visible", { exact: true }).query()).not.toBeNull();

    await userEvent.click(triggerNamed("Show details"));
    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(triggerNamed("Show details").getAttribute("aria-expanded")).toBe("true");
      expect(page.getByText("Delivery window", { exact: true }).query()).not.toBeNull();
    });
  });

  it("does not toggle when the trigger is disabled and stamps data-disabled", async () => {
    const onOpenChange = vi.fn();
    renderThemed(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger disabled>Show details</Collapsible.Trigger>
        <Collapsible.Content>Delivery window</Collapsible.Content>
      </Collapsible.Root>
    );

    const trigger = triggerNamed("Show details");
    await expect.element(page.getByRole("button", { name: "Show details", exact: true })).toBeDisabled();

    trigger.click();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
  });

  it("keeps a closed keepMounted panel in the DOM and unmounts by default", () => {
    renderThemed(
      <>
        <Collapsible.Root>
          <Collapsible.Trigger>Default</Collapsible.Trigger>
          <Collapsible.Content>Unmounted when closed</Collapsible.Content>
        </Collapsible.Root>
        <Collapsible.Root>
          <Collapsible.Trigger>Mounted</Collapsible.Trigger>
          <Collapsible.Content keepMounted>Stays mounted</Collapsible.Content>
        </Collapsible.Root>
      </>
    );

    expect(page.getByText("Unmounted when closed", { exact: true }).query()).toBeNull();
    const kept = page.getByText("Stays mounted", { exact: true }).element();
    expect(kept).not.toBeNull();
    const keptPanel = kept.closest('[data-slot="collapsible-content"]');
    expect(keptPanel).not.toBeNull();
    expect(keptPanel?.hasAttribute("hidden")).toBe(true);
  });

  it("keeps hiddenUntilFound content in the DOM and opens on beforematch", async () => {
    const onOpenChange = vi.fn();
    renderThemed(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Show details</Collapsible.Trigger>
        <Collapsible.Content hiddenUntilFound>Meter-reading reconciliation</Collapsible.Content>
      </Collapsible.Root>
    );

    const content = page.getByText("Meter-reading reconciliation", { exact: true }).element();
    const foundPanel = content.closest('[data-slot="collapsible-content"]');
    if (!(foundPanel instanceof HTMLElement)) {
      throw new Error("expected a collapsible panel");
    }
    await vi.waitFor(() => {
      expect(foundPanel.getAttribute("hidden")).toBe("until-found");
    });

    foundPanel.dispatchEvent(new Event("beforematch", { bubbles: true }));
    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(triggerNamed("Show details").getAttribute("aria-expanded")).toBe("true");
      expect(foundPanel.hasAttribute("hidden")).toBe(false);
    });
  });

  it("composes Trigger onto a custom button via render and keeps aria wiring", async () => {
    renderThemed(
      <Collapsible.Root>
        <Collapsible.Trigger render={<button type="button" className="custom-trigger" />}>
          Show details
        </Collapsible.Trigger>
        <Collapsible.Content>Delivery window</Collapsible.Content>
      </Collapsible.Root>
    );

    const trigger = triggerNamed("Show details");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.className.split(/\s+/)).toContain("custom-trigger");
    expect(trigger.getAttribute("data-slot")).toBe("collapsible-trigger");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(page.getByText("Delivery window", { exact: true }).query()).not.toBeNull();
    });
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(panel()?.id).toBe(controls);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Collapsible.Root>
          <Collapsible.Trigger>Show details</Collapsible.Trigger>
          <Collapsible.Content>Delivery window</Collapsible.Content>
        </Collapsible.Root>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before button");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, triggerNamed("Show details"));
  });
});
