import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the fill parity test reads --card and --background.
import "../../../dist/themes.css";
import { countryAddon, phoneInput } from "../../../test/phone-browser-queries";
import {
  inputNamed,
  renderThemed,
  roleNamed,
  textNamed,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { PhoneNumberField } from "../phone-number-field/phone-number-field";
import { InputGroup } from "./index";

function groupAround(start: HTMLElement): HTMLElement {
  const group = start.closest('[role="group"]');
  if (!(group instanceof HTMLElement)) {
    throw new Error("expected a group ancestor");
  }
  return group;
}

function rootNamed(name: string): HTMLElement {
  return groupAround(textboxNamed(name));
}

describe("InputGroup", () => {
  it("renders the group chrome around a named control", () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text>NO</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Account" />
      </InputGroup.Root>
    );
    const root = rootNamed("Account");
    const addon = groupAround(textNamed("NO"));
    const control = textboxNamed("Account");
    expect(root.getAttribute("data-slot")).toBe("input-group");
    expect(addon.getAttribute("data-slot")).toBe("input-group-addon");
    expect(control.getAttribute("data-slot")).toBe("input-group-control");
    expect(control.hasAttribute("data-focus-ring-control")).toBe(true);
    expect(textNamed("NO").getAttribute("data-slot")).toBe("input-group-text");
  });

  it("focuses the sibling input when the addon is clicked, but not through a nested button", async () => {
    const clicks: string[] = [];
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon
          onClick={() => {
            clicks.push("addon");
          }}>
          <InputGroup.Text>Search</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input aria-label="Query" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button
            onClick={() => {
              clicks.push("button");
            }}>
            Clear
          </InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    const control = textboxNamed("Query");

    await userEvent.click(page.getByText("Search"));
    expect(document.activeElement).toBe(control);
    expect(clicks).toEqual(["addon"]);

    control.blur();
    await userEvent.click(page.getByRole("button", { name: "Clear", exact: true }));
    expect(document.activeElement).not.toBe(control);
    expect(clicks).toEqual(["addon", "button"]);
  });

  it("focuses the group's own control from addon chrome, leaving a field nested in an addon its own focus", async () => {
    renderThemed(
      <>
        <InputGroup.Root>
          <InputGroup.Textarea aria-label="Message" />
          <InputGroup.Addon align="block-end">
            <InputGroup.Text>0/200</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>Amount</InputGroup.Text>
            <input aria-label="Nested amount" />
          </InputGroup.Addon>
          <InputGroup.Input aria-label="Total" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Text>kr</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
      </>
    );

    await userEvent.click(page.getByText("0/200", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Message"));

    await userEvent.click(page.getByText("kr", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Total"));

    await userEvent.click(textboxNamed("Nested amount"));
    await userEvent.keyboard("42");
    expect(document.activeElement).toBe(textboxNamed("Nested amount"));
    expect(inputNamed("Nested amount").value).toBe("42");
    expect(inputNamed("Total").value).toBe("");

    await userEvent.click(page.getByText("Amount", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Total"));
  });

  it("leaves focus off the own control for a label nested in an addon and for a portalled button", async () => {
    const totalFocus: string[] = [];
    function PortalledButton(): ReactElement {
      return createPortal(<button type="button">Portalled</button>, document.body);
    }
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Addon>
          <label htmlFor="addon-quantity">Quantity</label>
          <input id="addon-quantity" />
          <PortalledButton />
        </InputGroup.Addon>
        <InputGroup.Input
          aria-label="Total"
          onFocus={() => {
            totalFocus.push("focus");
          }}
        />
      </InputGroup.Root>
    );

    await userEvent.click(page.getByText("Quantity", { exact: true }));
    expect(document.activeElement).toBe(textboxNamed("Quantity"));
    expect(totalFocus).toEqual([]);

    await userEvent.click(page.getByRole("button", { name: "Portalled", exact: true }));
    expect(document.activeElement).toBe(roleNamed("button", "Portalled"));
    expect(totalFocus).toEqual([]);
  });

  it("focuses a PhoneNumberField's number input from its country addon chrome", () => {
    renderThemed(
      <LocaleProvider locale="en-US">
        <PhoneNumberField label="Mobile" />
      </LocaleProvider>
    );
    countryAddon().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.activeElement).toBe(phoneInput());
  });

  it("defaults the addon button to type=button so Enter never triggers it", async () => {
    const events: string[] = [];
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          events.push("submit");
        }}>
        <InputGroup.Root>
          <InputGroup.Input aria-label="Address" />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button
              onClick={() => {
                events.push("click");
              }}>
              Look up
            </InputGroup.Button>
          </InputGroup.Addon>
        </InputGroup.Root>
      </form>
    );
    expect(roleNamed("button", "Look up").getAttribute("type")).toBe("button");
    textboxNamed("Address").focus();
    await userEvent.keyboard("{Enter}");
    expect(events).not.toContain("click");
  });

  it("keeps an enabled field editable and undimmed beside a disabled addon", async () => {
    renderThemed(
      <InputGroup.Root>
        <InputGroup.Input aria-label="Editable meter" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button disabled>Copy meter</InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
    );
    expect(getComputedStyle(rootNamed("Editable meter")).opacity).toBe("1");
    await userEvent.fill(page.getByRole("textbox", { name: "Editable meter" }), "12345");
    await expect.element(page.getByRole("textbox", { name: "Editable meter" })).toHaveValue("12345");
    expect(roleNamed("button", "Copy meter").matches(":disabled")).toBe(true);
  });
});
