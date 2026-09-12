import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { dispatchPredictedPointer } from "../../../test/predicted-pointer";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
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

  it("blocks click and keyboard activation when disabled or pending", async () => {
    const onDisabledClick = vi.fn();
    const onPendingClick = vi.fn();
    renderThemed(
      <>
        <Button disabled onClick={onDisabledClick}>
          Disabled
        </Button>
        <Button isPending onClick={onPendingClick}>
          Saving
        </Button>
      </>
    );

    const disabled = roleNamed("button", "Disabled");
    const pending = roleNamed("button", "Saving");

    await expect.element(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Saving" })).toBeDisabled();
    expect(pending.hasAttribute("data-pending")).toBe(true);
    expect(disabled.hasAttribute("data-pending")).toBe(false);

    disabled.click();
    pending.click();
    disabled.focus();
    await userEvent.keyboard("{Enter}");
    pending.focus();
    await userEvent.keyboard(" ");

    expect(onDisabledClick).not.toHaveBeenCalled();
    expect(onPendingClick).not.toHaveBeenCalled();
  });

  it("stays activatable when visually disabled and suppresses mousedown focus", async () => {
    const onClick = vi.fn();
    const onMouseDown = vi.fn();
    renderThemed(
      <>
        <button type="button">Other</button>
        <Button isVisuallyDisabled onClick={onClick} onMouseDown={onMouseDown}>
          Looks off
        </Button>
      </>
    );

    const other = page.getByRole("button", { name: "Other" }).element();
    const button = roleNamed("button", "Looks off");

    await expect.element(page.getByRole("button", { name: "Looks off" })).not.toBeDisabled();
    expect(Number.parseFloat(getComputedStyle(button).opacity)).toBeCloseTo(0.7);
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBeNull();

    other.focus();
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(other);
    expect(onMouseDown).toHaveBeenCalledTimes(1);

    await userEvent.click(page.getByRole("button", { name: "Looks off" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
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

  it("renders variant and size recipe classes and keeps role when render swaps the tag", () => {
    renderThemed(
      <>
        <Button variant="outline" size="lg">
          Outline
        </Button>
        <Button nativeButton={false} render={<a href="#go" />}>
          Open
        </Button>
      </>
    );

    const outlineButton = roleNamed("button", "Outline");
    expect(getComputedStyle(outlineButton).borderTopWidth).not.toBe("0px");
    expect(Number.parseFloat(getComputedStyle(outlineButton).height)).toBeGreaterThan(36);

    const link = roleNamed("button", "Open");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#go");
  });
});
