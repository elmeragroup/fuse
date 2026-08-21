import { createRef } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render as renderBrowser } from "../../../test/browser-render";
import { ThemeScope } from "../../theme";
import { Button } from "./button";
import { buttonVariants } from "./button-variants";

const fkasPrivate = { variant: "internal", brand: "fkas", segment: "private" } as const;

function render(node: ReactNode) {
  return renderBrowser(<ThemeScope theme={fkasPrivate}>{node}</ThemeScope>);
}

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
    render(<Button onClick={onClick}>Save</Button>);

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
    render(
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
    render(
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
    expect(button.className.split(/\s+/)).toContain("opacity-70");
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

    render(
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

  it("merges an external ref when onIntent is set and shares one pointermove listener", async () => {
    const firstRef = createRef<HTMLButtonElement>();
    const secondRef = createRef<HTMLButtonElement>();
    const add = vi.spyOn(document, "addEventListener");

    render(
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
    const { unmount } = render(
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
    const outline = buttonVariants({ variant: "outline", size: "lg" });
    render(
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
    for (const token of ["border-border", "h-(--control-h-lg)", "shadow-xs"]) {
      expect(outline).toContain(token);
      expect(outlineButton.className.split(/\s+/)).toContain(token);
    }

    const link = buttonNamed("Open");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#go");
  });
});
