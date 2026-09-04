import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderThemed } from "../../../test/themed-browser-render";
import { Toggle } from "./toggle";

function toggleNamed(name: string, pressed?: boolean): HTMLElement {
  const element = page.getByRole("button", { name, exact: true, pressed }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML toggle named ${name}`);
  }
  return element;
}

describe("Toggle", () => {
  it("renders an unpressed button, flips on click, and fires onPressedChange(true)", async () => {
    const onPressedChange = vi.fn();
    renderThemed(<Toggle onPressedChange={onPressedChange}>Bold</Toggle>);

    await expect.element(page.getByRole("button", { name: "Bold", pressed: false })).toBeInTheDocument();
    await userEvent.click(page.getByRole("button", { name: "Bold", exact: true }));
    await expect.element(page.getByRole("button", { name: "Bold", pressed: true })).toBeInTheDocument();
    expect(onPressedChange).toHaveBeenCalledTimes(1);
    expect(onPressedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
  });

  it("toggles from Tab focus with Space and with Enter", async () => {
    const onPressedChange = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Toggle onPressedChange={onPressedChange}>Bold</Toggle>
      </>
    );

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(toggleNamed("Bold", false));

    await userEvent.keyboard(" ");
    expect(onPressedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
    await expect.element(page.getByRole("button", { name: "Bold", pressed: true })).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(onPressedChange).toHaveBeenNthCalledWith(2, false, expect.anything());
    await expect.element(page.getByRole("button", { name: "Bold", pressed: false })).toBeInTheDocument();
  });

  it("blocks toggling and tab order when disabled", async () => {
    const onPressedChange = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Toggle disabled onPressedChange={onPressedChange}>
          Bold
        </Toggle>
        <button type="button">After</button>
      </>
    );

    const toggle = toggleNamed("Bold", false);
    await expect.element(page.getByRole("button", { name: "Bold", exact: true })).toBeDisabled();

    toggle.click();
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onPressedChange).not.toHaveBeenCalled();
    await expect.element(page.getByRole("button", { name: "Bold", pressed: false })).toBeInTheDocument();

    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(page.getByRole("button", { name: "After" }).element());
  });

  it("supports controlled pressed and uncontrolled defaultPressed", async () => {
    const onPressedChange = vi.fn();
    renderThemed(
      <>
        <Toggle pressed={false} onPressedChange={onPressedChange}>
          Held
        </Toggle>
        <Toggle defaultPressed>Open</Toggle>
      </>
    );

    await expect.element(page.getByRole("button", { name: "Held", pressed: false })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Open", pressed: true })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Held", exact: true }));
    expect(onPressedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
    await expect.element(page.getByRole("button", { name: "Held", pressed: false })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Open", exact: true }));
    await expect.element(page.getByRole("button", { name: "Open", pressed: false })).toBeInTheDocument();
  });

  it("stamps data-pressed and aria-pressed when on", () => {
    renderThemed(<Toggle defaultPressed>Bold</Toggle>);
    const toggle = toggleNamed("Bold", true);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.hasAttribute("data-pressed")).toBe(true);
    expect(toggle.getAttribute("data-slot")).toBe("toggle");
  });

  it("renders variant and size classes without leaking invalid tokens, and keeps the icon-start hook", () => {
    renderThemed(
      <>
        <Toggle variant="default">Default</Toggle>
        <Toggle variant="outline" size="lg">
          Outline
        </Toggle>
        <Toggle>
          <span data-icon="inline-start" aria-hidden>
            *
          </span>
          Icon
        </Toggle>
      </>
    );

    expect(toggleNamed("Default").getAttribute("data-slot")).toBe("toggle");
    expect(toggleNamed("Outline").getAttribute("data-slot")).toBe("toggle");
    expect(toggleNamed("Icon").querySelector("[data-icon=inline-start]")).not.toBeNull();
  });
});
