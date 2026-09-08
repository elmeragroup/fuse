import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Button } from "./button";

function flushEffects(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function dispatchPredictedPointer(clientX: number, clientY: number): void {
  const event = new PointerEvent("pointermove", { bubbles: true, clientX: 0, clientY: 0 });
  Object.defineProperty(event, "getPredictedEvents", {
    value: () => [new PointerEvent("pointermove", { clientX, clientY })],
  });
  document.dispatchEvent(event);
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

describe("Button", () => {
  it("activates once on click, Enter, and Space", async () => {
    const onClick = vi.fn();
    renderThemed(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(page.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    const button = buttonNamed("Save");
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

    const disabled = buttonNamed("Disabled");
    const pending = buttonNamed("Saving");

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
    const button = buttonNamed("Looks off");

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

  it("fires onIntent once from a predicted path and never when disabled, pending, or visually disabled", async () => {
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
    await flushEffects();

    const liveButton = buttonNamed("Prefetch");
    const rect = liveButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);
    expect(live).toHaveBeenCalledTimes(1);

    for (const name of ["Disabled prefetch", "Pending prefetch", "Visual prefetch"]) {
      const blocked = buttonNamed(name).getBoundingClientRect();
      dispatchPredictedPointer(blocked.left + blocked.width / 2, blocked.top + blocked.height / 2);
    }
    expect(disabled).not.toHaveBeenCalled();
    expect(pending).not.toHaveBeenCalled();
    expect(visual).not.toHaveBeenCalled();
  });

  it("stops measuring a fired registration and removes the last pointermove listener", async () => {
    const live = vi.fn();
    renderThemed(<Button onIntent={live}>Prefetch</Button>);
    await flushEffects();

    const liveButton = buttonNamed("Prefetch");
    const rect = liveButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const measure = vi.spyOn(liveButton, "getBoundingClientRect");
    const remove = vi.spyOn(document, "removeEventListener");

    try {
      dispatchPredictedPointer(x, y);
      expect(live).toHaveBeenCalledTimes(1);
      expect(remove.mock.calls.filter((call) => call[0] === "pointermove").length).toBeGreaterThanOrEqual(1);

      measure.mockClear();
      dispatchPredictedPointer(x, y);
      dispatchPredictedPointer(x, y);
      expect(measure).not.toHaveBeenCalled();
      expect(live).toHaveBeenCalledTimes(1);
    } finally {
      measure.mockRestore();
      remove.mockRestore();
    }
  });

  it("keeps the shared pointermove listener while a sibling registration is still pending", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");

    renderThemed(
      <div style={{ display: "flex", gap: 120 }}>
        <Button onIntent={first}>First</Button>
        <Button onIntent={second}>Second</Button>
      </div>
    );
    await flushEffects();

    const firstButton = buttonNamed("First");
    const secondButton = buttonNamed("Second");
    const firstRect = firstButton.getBoundingClientRect();
    const secondRect = secondButton.getBoundingClientRect();
    const firstX = firstRect.left + firstRect.width / 2;
    const firstY = firstRect.top + firstRect.height / 2;
    const secondX = secondRect.left + secondRect.width / 2;
    const secondY = secondRect.top + secondRect.height / 2;

    try {
      dispatchPredictedPointer(firstX, firstY);
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).not.toHaveBeenCalled();
      expect(remove.mock.calls.filter((call) => call[0] === "pointermove")).toHaveLength(0);

      const measureFirst = vi.spyOn(firstButton, "getBoundingClientRect");
      try {
        dispatchPredictedPointer(secondX, secondY);
        expect(second).toHaveBeenCalledTimes(1);
        expect(measureFirst).not.toHaveBeenCalled();
        expect(remove.mock.calls.filter((call) => call[0] === "pointermove").length).toBeGreaterThanOrEqual(
          1
        );
      } finally {
        measureFirst.mockRestore();
      }
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it("unmounts safely from inside onIntent without double-removing the listener", async () => {
    let calls = 0;
    let unmount: () => void = () => {
      throw new Error("unmount was called before render completed");
    };
    ({ unmount } = renderThemed(
      <Button
        onIntent={() => {
          calls += 1;
          unmount();
        }}>
        Gone
      </Button>
    ));
    await flushEffects();

    const goneButton = buttonNamed("Gone");
    const rect = goneButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);

    expect(calls).toBe(1);
    expect(document.contains(goneButton)).toBe(false);
  });

  it("uses the latest onIntent before the first hit and does not rearm afterwards", async () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const third = vi.fn();
    const { rerender } = renderThemed(<Button onIntent={stale}>Prefetch</Button>);
    await flushEffects();

    rerender(<Button onIntent={fresh}>Prefetch</Button>);
    await flushEffects();

    const liveButton = buttonNamed("Prefetch");
    const rect = liveButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchPredictedPointer(x, y);
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();

    rerender(<Button onIntent={third}>Prefetch</Button>);
    await flushEffects();
    dispatchPredictedPointer(x, y);
    expect(third).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("does not accumulate pointermove listeners across a predictionZoneSize rerender", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = renderThemed(
      <Button predictionZoneSize={30} onIntent={() => undefined}>
        Prefetch
      </Button>
    );
    await flushEffects();

    rerender(
      <Button predictionZoneSize={60} onIntent={() => undefined}>
        Prefetch
      </Button>
    );
    await flushEffects();

    try {
      const liveButton = buttonNamed("Prefetch");
      const rect = liveButton.getBoundingClientRect();
      dispatchPredictedPointer(rect.left + rect.width / 2, rect.top + rect.height / 2);
      unmount();

      const additions = add.mock.calls.filter((call) => call[0] === "pointermove");
      const removals = remove.mock.calls.filter((call) => call[0] === "pointermove");
      expect(additions.length).toBeLessThanOrEqual(2);
      expect(additions).toHaveLength(removals.length);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it("merges an external ref when onIntent is set and shares one pointermove listener", async () => {
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
    await flushEffects();

    expect(firstRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(secondRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(firstRef.current).toBe(buttonNamed("First"));
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

    expect(trigger).toBe(buttonNamed("Trigger"));
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

    const outlineButton = buttonNamed("Outline");
    expect(getComputedStyle(outlineButton).borderTopWidth).not.toBe("0px");
    expect(Number.parseFloat(getComputedStyle(outlineButton).height)).toBeGreaterThan(36);

    const link = buttonNamed("Open");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#go");
  });
});
