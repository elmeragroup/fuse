import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { panelControlledBy } from "../../../test/panel-transition";
import { renderThemed } from "../../../test/themed-browser-render";
import { Collapsible } from "./index";

function triggerNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected trigger ${name}`);
  }
  return element;
}

describe("Collapsible", () => {
  it("toggles the panel on click and from Tab focus with Enter and Space, wiring aria-expanded plus aria-controls", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Collapsible.Root>
          <Collapsible.Trigger>Show details</Collapsible.Trigger>
          <Collapsible.Content>Delivery window</Collapsible.Content>
        </Collapsible.Root>
      </>
    );

    const trigger = triggerNamed("Show details");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
    expect(panelControlledBy(trigger)).toBeNull();

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(page.getByText("Delivery window", { exact: true }).query()).not.toBeNull();
    });
    const controls = trigger.getAttribute("aria-controls");
    const openPanel = panelControlledBy(trigger);
    expect(controls).toBeTruthy();
    expect(openPanel).not.toBeNull();
    expect(openPanel).toBe(page.getByText("Delivery window", { exact: true }).element());

    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
    });

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

  it("puts the open panel content in tab order right after the trigger", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Collapsible.Root>
          <Collapsible.Trigger>Show details</Collapsible.Trigger>
          <Collapsible.Content>
            <a href="#window">Delivery window</a>
          </Collapsible.Content>
        </Collapsible.Root>
        <button type="button">After</button>
      </>
    );

    const before = page.getByRole("button", { name: "Before", exact: true }).element();
    const after = page.getByRole("button", { name: "After", exact: true }).element();
    if (!(before instanceof HTMLElement) || !(after instanceof HTMLElement)) {
      throw new Error("expected the surrounding buttons");
    }

    // Closed: the panel is not mounted, so Tab runs trigger -> After.
    before.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(triggerNamed("Show details"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(after);

    triggerNamed("Show details").focus();
    await userEvent.keyboard("{Enter}");
    const link = page.getByRole("link", { name: "Delivery window", exact: true });
    await vi.waitFor(() => {
      expect(link.query()).not.toBeNull();
    });

    // Open: Tab from the trigger lands inside the panel before it reaches After.
    triggerNamed("Show details").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(link.element());
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(after);
  });

  it("does not toggle when the Root is disabled and stamps data-disabled", async () => {
    const onOpenChange = vi.fn();
    renderThemed(
      <Collapsible.Root disabled onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Show details</Collapsible.Trigger>
        <Collapsible.Content>Delivery window</Collapsible.Content>
      </Collapsible.Root>
    );

    const trigger = triggerNamed("Show details");
    await expect.element(page.getByRole("button", { name: "Show details", exact: true })).toBeDisabled();
    expect(trigger.getAttribute("data-disabled")).not.toBeNull();

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    trigger.click();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(page.getByText("Delivery window", { exact: true }).query()).toBeNull();
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
