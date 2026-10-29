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
    const open = toggleNamed("Open", true);
    expect(open.getAttribute("aria-pressed")).toBe("true");
    expect(open.hasAttribute("data-pressed")).toBe(true);
    expect(open.getAttribute("data-slot")).toBe("toggle");

    await userEvent.click(page.getByRole("button", { name: "Held", exact: true }));
    expect(onPressedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
    await expect.element(page.getByRole("button", { name: "Held", pressed: false })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Open", exact: true }));
    await expect.element(page.getByRole("button", { name: "Open", pressed: false })).toBeInTheDocument();
  });
});
