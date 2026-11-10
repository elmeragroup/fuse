import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { dispatchPredictedPointer } from "../../../test/predicted-pointer";
import { effectiveOpacity, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Tooltip } from "../tooltip";
import { Button } from "./button";

describe("Button", () => {
  it("activates once on click, Enter, and Space", async () => {
    const onClick = vi.fn();
    renderThemed(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(page.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    const button = roleNamed("button", "Save");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);

    button.focus();
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  describe("pending", () => {
    it("keeps focus on the button that started the action and announces busy", async () => {
      function Fixture({ pending }: { pending: boolean }) {
        return (
          <Button isPending={pending} className="transition-none" onClick={() => undefined}>
            Save
          </Button>
        );
      }
      const { rerender } = renderThemed(<Fixture pending={false} />);
      const button = roleNamed("button", "Save");
      button.focus();
      expect(document.activeElement).toBe(button);

      rerender(<Fixture pending />);
      // The same element: no native `disabled`, so focus never fell to <body>.
      expect(document.activeElement).toBe(button);
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.tabIndex).toBe(0);
      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.getAttribute("aria-disabled")).toBe("true");
      // The disabled treatment still paints once.
      expect(effectiveOpacity(button)).toBe(0.5);
      expect(getComputedStyle(button).cursor).toBe("not-allowed");

      // Tab still leaves it, so a user is not trapped on a busy control.
      await userEvent.keyboard("{Tab}");
      expect(document.activeElement).not.toBe(button);

      rerender(<Fixture pending={false} />);
      expect(button.hasAttribute("aria-busy")).toBe(false);
      expect(button.hasAttribute("aria-disabled")).toBe(false);
      expect(button.hasAttribute("data-pending")).toBe(false);
    });

    it("restores the native disabled attribute when a consumer opts out of staying focusable", async () => {
      renderThemed(
        <Button isPending focusableWhenDisabled={false}>
          Saving
        </Button>
      );
      await expect.element(page.getByRole("button", { name: "Saving" })).toBeDisabled();
      expect(roleNamed("button", "Saving").hasAttribute("aria-busy")).toBe(true);
    });
  });

  it("keeps a focusable disabled button hoverable, so a tooltip on it still opens", async () => {
    renderThemed(
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger render={<Button disabled focusableWhenDisabled />}>Why</Tooltip.Trigger>
          <Tooltip.Content>Needs a signed contract</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
    const button = roleNamed("button", "Why");

    // Base UI keeps a focusable disabled button out of `:disabled` and marks it with
    // `data-disabled`, so the dim follows that attribute while pointer events stay on.
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(effectiveOpacity(button)).toBe(0.5);
    expect(getComputedStyle(button).pointerEvents).toBe("auto");

    await userEvent.hover(button);
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: "Needs a signed contract" }).query()).not.toBeNull();
    });
  });

  it("dims a non-native disabled button through the disabled state attribute", () => {
    renderThemed(
      <>
        <Button render={<a href="/docs" />} nativeButton={false} disabled>
          Anchor
        </Button>
        <Button>Enabled</Button>
      </>
    );

    // A rendered <a> never matches `:disabled`; Base UI marks it with the disabled state
    // attribute instead, and the dim must follow that attribute.
    expect(effectiveOpacity(roleNamed("button", "Anchor"))).toBe(0.5);
    expect(effectiveOpacity(roleNamed("button", "Enabled"))).toBe(1);
  });

  it("forwards a predicted path to onIntent only while live: not disabled, pending, or visually disabled", () => {
    const live = vi.fn();
    const disabled = vi.fn();
    const pending = vi.fn();
    const visual = vi.fn();

    renderThemed(
      <>
        <Button onIntent={live}>Prefetch</Button>
        <Button disabled onIntent={disabled}>
          Disabled prefetch
        </Button>
        <Button isPending onIntent={pending}>
          Pending prefetch
        </Button>
        <Button isVisuallyDisabled onIntent={visual}>
          Visual prefetch
        </Button>
      </>
    );

    const liveButton = roleNamed("button", "Prefetch");
    const rect = liveButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchPredictedPointer(x, y);
    expect(live).toHaveBeenCalledTimes(1);

    for (const name of ["Disabled prefetch", "Pending prefetch", "Visual prefetch"]) {
      const blocked = roleNamed("button", name).getBoundingClientRect();
      dispatchPredictedPointer(blocked.left + blocked.width / 2, blocked.top + blocked.height / 2);
    }
    expect(disabled).not.toHaveBeenCalled();
    expect(pending).not.toHaveBeenCalled();
    expect(visual).not.toHaveBeenCalled();
  });

  it("merges an external ref when onIntent is set and shares one pointermove listener", () => {
    const firstRef = createRef<HTMLButtonElement>();
    const secondRef = createRef<HTMLButtonElement>();
    const add = vi.spyOn(document, "addEventListener");

    renderThemed(
      <>
        <Button ref={firstRef} onIntent={() => undefined}>
          First
        </Button>
        <Button ref={secondRef} onIntent={() => undefined}>
          Second
        </Button>
      </>
    );

    expect(firstRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(secondRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(firstRef.current).toBe(roleNamed("button", "First"));
    expect(add.mock.calls.filter((call) => call[0] === "pointermove")).toHaveLength(1);
    add.mockRestore();
  });

  it("clears a callback ref on unmount", () => {
    let trigger: HTMLElement | null = null;
    const { unmount } = renderThemed(
      <Button
        ref={(element) => {
          trigger = element;
        }}>
        Trigger
      </Button>
    );

    expect(trigger).toBe(roleNamed("button", "Trigger"));
    unmount();
    expect(trigger).toBeNull();
  });
});
