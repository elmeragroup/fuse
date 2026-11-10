import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Popover } from "./index";
import type { PopoverContentProps } from "./popover";

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

/** Base UI mounts the popup a frame or more after the opening event, so wait for it. */
async function mountedPopover(name?: string): Promise<HTMLElement> {
  const locator = page.getByRole("dialog", name === undefined ? {} : { name });
  await expect.element(locator).toBeInTheDocument();
  const dialog = locator.element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popup");
  }
  return dialog;
}

async function openPopover(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Details", exact: true }).element());
  return mountedPopover();
}

describe("Popover", () => {
  it("opens from the trigger, is named by its Title, exposes the Description, and moves focus into the popup", async () => {
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
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("opens from Enter and from Space on the trigger", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <BasicPopover />
      </>
    );
    const trigger = page.getByRole("button", { name: "Details", exact: true }).element();
    if (!(trigger instanceof HTMLElement)) {
      throw new Error("expected the trigger");
    }
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(page.getByRole("dialog").query()).toBeNull();

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog", { name: "Dimensions" }).query()).not.toBeNull();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    await expect.element(page.getByRole("button", { name: "Details", exact: true })).toHaveFocus();

    await userEvent.keyboard(" ");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog", { name: "Dimensions" }).query()).not.toBeNull();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on outside press and returns focus to the trigger", async () => {
    renderThemed(
      <>
        <p>Outside the popup</p>
        <BasicPopover />
      </>
    );
    await openPopover();

    await userEvent.click(page.getByText("Outside the popup", { exact: true }).element());
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    await expect.element(page.getByRole("button", { name: "Details", exact: true })).toHaveFocus();
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
    const withArrow = await openPopover();
    const arrow = withArrow.querySelector("[data-side]");
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute("data-side")).toBe(withArrow.getAttribute("data-side"));
    expect(withArrow.getAttribute("data-side")).toBe("top");
  });

  it("places a controlled popover with no trigger against its anchor, and follows the anchor as it moves", async () => {
    function Anchored() {
      const [anchor, setAnchor] = useState<HTMLElement | null>(null);
      return (
        <div style={{ padding: 120 }}>
          <div ref={setAnchor} role="group" aria-label="Anchor" style={{ width: 120, height: 40 }} />
          {anchor === null ? null : (
            <Popover.Root open>
              <Popover.Content
                anchor={anchor}
                side="bottom"
                sideOffset={8}
                initialFocus={false}
                style={{ width: 96 }}>
                <Popover.Title>Anchored</Popover.Title>
              </Popover.Content>
            </Popover.Root>
          )}
        </div>
      );
    }
    renderThemed(<Anchored />);
    const dialog = await mountedPopover("Anchored");
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    const anchor = roleNamed("group", "Anchor");

    // Unit under test: the popup's placement. Oracle: the anchor's own box, read from the page,
    // with the requested bottom side, 8px offset and centred alignment applied by hand.
    const expectPlacedAgainstAnchor = async () => {
      await vi.waitFor(() => {
        const target = anchor.getBoundingClientRect();
        const popup = dialog.getBoundingClientRect();
        expect(popup.top).toBeCloseTo(target.bottom + 8, 0);
        expect(popup.left + popup.width / 2).toBeCloseTo(target.left + target.width / 2, 0);
      });
    };
    expect(dialog.getAttribute("data-side")).toBe("bottom");
    await expectPlacedAgainstAnchor();

    // A transform moves the anchor without a layout change or a scroll.
    const before = dialog.getBoundingClientRect();
    anchor.style.translate = "48px 24px";
    await expectPlacedAgainstAnchor();
    const after = dialog.getBoundingClientRect();
    expect(after.left - before.left).toBeCloseTo(48, 0);
    expect(after.top - before.top).toBeCloseTo(24, 0);
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
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();

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
});
