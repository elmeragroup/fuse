import { useRef, useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertFocusRingOnKeyboardAbsentOnMouse,
  expectFocusRing,
  expectNoFocusRing,
} from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import type { PopoverContentProps } from "./popover";
import { Popover } from "./popover";

function BasicPopover({
  onOpenChange,
  ...contentProps
}: PopoverContentProps & {
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Popover.Root onOpenChange={onOpenChange}>
      <Popover.Trigger>Details</Popover.Trigger>
      <Popover.Content {...contentProps}>
        <Popover.Header>
          <Popover.Title>Dimensions</Popover.Title>
          <Popover.Description>Set the dimensions for the layer.</Popover.Description>
        </Popover.Header>
        <input aria-label="Width" />
      </Popover.Content>
    </Popover.Root>
  );
}

async function openPopover(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Details", exact: true }).element());
  const dialog = page.getByRole("dialog").element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popup");
  }
  return dialog;
}

describe("Popover", () => {
  it("opens from the trigger, is named by its Title, and exposes the Description", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<BasicPopover onOpenChange={onOpenChange} />);

    const dialog = await openPopover();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(page.getByRole("dialog", { name: "Dimensions" }).element()).toBe(dialog);
    expect(dialog.getAttribute("data-slot")).toBe("popover-content");
    await expect
      .element(page.getByRole("dialog"))
      .toHaveAccessibleDescription("Set the dimensions for the layer.");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(<BasicPopover />);
    const trigger = page.getByRole("button", { name: "Details", exact: true }).element();
    await openPopover();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on outside press and returns focus to the trigger", async () => {
    renderThemed(
      <>
        <p>Outside the popup</p>
        <BasicPopover />
      </>
    );
    const trigger = page.getByRole("button", { name: "Details", exact: true }).element();
    await openPopover();

    await userEvent.click(page.getByText("Outside the popup", { exact: true }).element());
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("moves focus into the popup on open", async () => {
    renderThemed(<BasicPopover />);
    const dialog = await openPopover();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("omits the arrow by default and renders it with matching data-side when showArrow is set", async () => {
    const { rerender } = renderThemed(<BasicPopover />);
    const dialog = await openPopover();
    expect(dialog.querySelector("[data-side]")).toBeNull();

    rerender(
      <div style={{ padding: 240 }}>
        <BasicPopover showArrow side="top" style={{ width: 96 }} />
      </div>
    );
    await userEvent.click(page.getByRole("button", { name: "Details", exact: true }).element());
    const withArrow = page.getByRole("dialog").element();
    if (!(withArrow instanceof HTMLElement)) {
      throw new Error("expected the popup");
    }
    const arrow = withArrow.querySelector("[data-side]");
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute("data-side")).toBe(withArrow.getAttribute("data-side"));
    expect(withArrow.getAttribute("data-side")).toBe("top");
  });

  it("forwards side and align onto the popup", async () => {
    renderThemed(
      <div style={{ padding: 240 }}>
        <BasicPopover side="left" align="start" style={{ width: 96 }} />
      </div>
    );
    const dialog = await openPopover();
    expect(dialog.getAttribute("data-side")).toBe("left");
    expect(dialog.getAttribute("data-align")).toBe("start");
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(<BasicPopover />);
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openPopover();
    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("portals into an explicit container element", () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <Popover.Root defaultOpen>
              <Popover.Content container={node}>
                <Popover.Title>Dimensions</Popover.Title>
              </Popover.Content>
            </Popover.Root>
          ) : null}
        </>
      );
    }
    renderThemed(<ExplicitContainer />);
    const dialog = page.getByRole("dialog", { name: "Dimensions" }).element();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("waits while the resolved container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Popover.Root open>
          <Popover.Content container={ref}>
            <Popover.Title>Pending</Popover.Title>
          </Popover.Content>
        </Popover.Root>
      );
    }
    renderThemed(<NeverAttached />);

    expect(page.getByRole("dialog").query()).toBeNull();
    expect(document.querySelector("[data-slot=popover-content]")).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    renderThemed(
      <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
        <Popover.Root open>
          <Popover.Content>
            <Popover.Title>Scoped</Popover.Title>
          </Popover.Content>
        </Popover.Root>
      </ThemeScope>
    );
    const dialog = page.getByRole("dialog").element();
    const scope = dialog.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("round-trips controlled open state on trigger click and Escape", async () => {
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Popover.Root
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}>
          <Popover.Trigger>Details</Popover.Trigger>
          <Popover.Content>
            <Popover.Title>Dimensions</Popover.Title>
            <input aria-label="Width" />
          </Popover.Content>
        </Popover.Root>
      );
    }
    renderThemed(<Controlled />);
    const trigger = page.getByRole("button", { name: "Details", exact: true }).element();

    await userEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(page.getByRole("dialog").element()).toBeTruthy();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <BasicPopover />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = page.getByRole("button", { name: "Details", exact: true }).element();
    if (!(previous instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
      throw new Error("expected buttons");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });

  it("paints the shared ring when the popup itself receives keyboard focus", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Popover.Root>
          <Popover.Trigger>Details</Popover.Trigger>
          <Popover.Content>
            <Popover.Title>Dimensions</Popover.Title>
          </Popover.Content>
        </Popover.Root>
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected before");
    }
    previous.focus();
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Enter}");
    const dialog = page.getByRole("dialog", { name: "Dimensions" }).element();
    if (!(dialog instanceof HTMLElement)) {
      throw new Error("expected the popup");
    }
    expect(document.activeElement).toBe(dialog);
    expect(dialog.matches(":focus-visible"), "keyboard open must land with :focus-visible").toBe(true);
    expectFocusRing(dialog, "keyboard-focused popup must paint the shared ring");

    dialog.blur();
    await userEvent.click(dialog);
    expect(dialog.matches(":focus-visible"), "mouse focus must not match :focus-visible").toBe(false);
    expectNoFocusRing(dialog, "mouse focus must not paint the shared ring");
  });
});
