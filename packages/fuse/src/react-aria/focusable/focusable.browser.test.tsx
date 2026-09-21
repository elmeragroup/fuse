import { useRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Focusable, useFocusable } from "./focusable";

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

function imgNamed(name: string): HTMLElement {
  const element = page.getByRole("img", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected img ${name}`);
  }
  return element;
}

function CustomTrigger({
  excludeFromTabOrder,
  onFocus,
}: {
  excludeFromTabOrder?: boolean;
  onFocus?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { focusableProps } = useFocusable({ excludeFromTabOrder, onFocus }, ref);
  return (
    <span {...focusableProps} ref={ref} role="img" aria-label="Custom trigger">
      Custom
    </span>
  );
}

describe("Focusable", () => {
  it("makes a wrapped span tabbable and fires focus events", async () => {
    const onFocus = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Focusable onFocus={onFocus}>
          <span role="img" aria-label="Meter status">
            Offline
          </span>
        </Focusable>
      </>
    );

    const status = imgNamed("Meter status");
    buttonNamed("Before").focus();
    await userEvent.tab();
    expect(document.activeElement, "tab lands on the wrapped span").toBe(status);
    expect(onFocus).toHaveBeenCalled();
  });

  it("drops the tab stop with excludeFromTabOrder but keeps programmatic focus", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Focusable excludeFromTabOrder>
          <span role="img" aria-label="Meter status">
            Offline
          </span>
        </Focusable>
        <button type="button">After</button>
      </>
    );

    const status = imgNamed("Meter status");
    buttonNamed("Before").focus();
    await userEvent.tab();
    expect(document.activeElement, "excludeFromTabOrder skips the wrapped span").toBe(buttonNamed("After"));

    status.focus();
    expect(document.activeElement, "programmatic focus still lands on the wrapped span").toBe(status);
  });
});

describe("useFocusable", () => {
  it("spreads focusableProps that make a custom element tabbable", async () => {
    const onFocus = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <CustomTrigger onFocus={onFocus} />
      </>
    );

    const trigger = imgNamed("Custom trigger");
    buttonNamed("Before").focus();
    await userEvent.tab();
    expect(document.activeElement, "tab lands on the custom element").toBe(trigger);
    expect(onFocus).toHaveBeenCalled();
  });

  it("honors excludeFromTabOrder on the spread props while keeping element.focus()", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <CustomTrigger excludeFromTabOrder />
        <button type="button">After</button>
      </>
    );

    const trigger = imgNamed("Custom trigger");
    buttonNamed("Before").focus();
    await userEvent.tab();
    expect(document.activeElement, "excludeFromTabOrder skips the custom element").toBe(buttonNamed("After"));

    trigger.focus();
    expect(document.activeElement, "programmatic focus still lands on the custom element").toBe(trigger);
  });
});
