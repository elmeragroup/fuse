import { useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { DropdownMenu } from "./index";

type ItemRole = "menuitem" | "menuitemcheckbox" | "menuitemradio";

/**
 * Base UI mounts the menu popup and moves focus into it a frame or more after the
 * opening event, so the open helpers wait for it before reading the element.
 */
async function openedMenu(): Promise<HTMLElement> {
  await expect.element(page.getByRole("menu")).toBeInTheDocument();
  const element = page.getByRole("menu").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a menu");
  }
  return element;
}

function itemLocator(name: string, role: ItemRole = "menuitem") {
  return page.getByRole(role, { name, exact: true });
}

/** Waits for an item of an open-on-mount menu, which mounts after the first render. */
async function mountedItem(name: string, role: ItemRole = "menuitem"): Promise<HTMLElement> {
  await expect.element(itemLocator(name, role)).toBeInTheDocument();
  return itemNamed(name, role);
}

function itemNamed(name: string, role: ItemRole = "menuitem"): HTMLElement {
  const element = itemLocator(name, role).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected ${role} ${name}`);
  }
  return element;
}

function BasicMenu({ onOpenChange, extra }: { onOpenChange?: (open: boolean) => void; extra?: ReactNode }) {
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Group>
          <DropdownMenu.Label>Account</DropdownMenu.Label>
          <DropdownMenu.Item>Profile</DropdownMenu.Item>
          <DropdownMenu.Item disabled>Settings</DropdownMenu.Item>
          <DropdownMenu.Item>Logout</DropdownMenu.Item>
        </DropdownMenu.Group>
        {extra}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

async function openWithClick(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Open", exact: true }).element());
  return openedMenu();
}

async function openWithArrowDown(): Promise<HTMLElement> {
  const trigger = page.getByRole("button", { name: "Open", exact: true }).element();
  if (!(trigger instanceof HTMLElement)) {
    throw new Error("expected trigger");
  }
  trigger.focus();
  await userEvent.keyboard("{ArrowDown}");
  return openedMenu();
}

describe("DropdownMenu", () => {
  it("opens from the trigger click, exposes a menu, and closes when an item is clicked", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<BasicMenu onOpenChange={onOpenChange} />);

    const menu = await openWithClick();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(menu.getAttribute("data-slot")).toBe("dropdown-menu-content");
    expect(itemNamed("Profile")).toBeTruthy();

    await userEvent.click(itemNamed("Logout"));
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
  });

  it("closes the entire tree on Escape from a submenu", async () => {
    renderThemed(
      <BasicMenu
        extra={
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item>Team</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        }
      />
    );
    await openWithArrowDown();
    await userEvent.keyboard("{End}{ArrowRight}");
    await vi.waitFor(() => {
      expect(itemNamed("More").getAttribute("data-popup-open")).not.toBeNull();
    });

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    await expect.element(page.getByRole("button", { name: "Open", exact: true })).toHaveFocus();
  });

  it("toggles CheckboxItem and fires onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    function Checkboxes() {
      const [checked, setChecked] = useState(true);
      return (
        <DropdownMenu.Root defaultOpen>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.CheckboxItem
              checked={checked}
              onCheckedChange={(next) => {
                onCheckedChange(next);
                setChecked(next === true);
              }}>
              Show toolbar
            </DropdownMenu.CheckboxItem>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    }
    renderThemed(<Checkboxes />);
    const checkbox = await mountedItem("Show toolbar", "menuitemcheckbox");
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(checkbox.querySelector("svg")).not.toBeNull();

    await userEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(itemNamed("Show toolbar", "menuitemcheckbox").getAttribute("aria-checked")).toBe("false");
    expect(itemNamed("Show toolbar", "menuitemcheckbox").querySelector("svg")).toBeNull();
  });

  it("selects RadioItem within a RadioGroup", async () => {
    const onValueChange = vi.fn();
    function Radios() {
      const [value, setValue] = useState("status");
      return (
        <DropdownMenu.Root defaultOpen>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.RadioGroup
              value={value}
              onValueChange={(next) => {
                onValueChange(next);
                setValue(next === "panel" ? "panel" : "status");
              }}>
              <DropdownMenu.RadioItem value="status">Status bar</DropdownMenu.RadioItem>
              <DropdownMenu.RadioItem value="panel">Panel</DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    }
    renderThemed(<Radios />);
    expect((await mountedItem("Status bar", "menuitemradio")).getAttribute("aria-checked")).toBe("true");
    expect(itemNamed("Panel", "menuitemradio").getAttribute("aria-checked")).toBe("false");

    await userEvent.click(itemNamed("Panel", "menuitemradio"));
    expect(onValueChange).toHaveBeenCalledWith("panel");
    expect(itemNamed("Panel", "menuitemradio").getAttribute("aria-checked")).toBe("true");
    expect(itemNamed("Panel", "menuitemradio").querySelector("svg")).not.toBeNull();
    expect(itemNamed("Status bar", "menuitemradio").querySelector("svg")).toBeNull();
  });

  it("renders LinkItem as a menuitem backed by an anchor", async () => {
    renderThemed(
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.LinkItem href="/settings">Settings</DropdownMenu.LinkItem>
          <DropdownMenu.LinkItem render={<a href="/billing" />}>Billing</DropdownMenu.LinkItem>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
    const settings = await mountedItem("Settings");
    expect(settings.tagName).toBe("A");
    expect(settings.getAttribute("href")).toBe("/settings");
    const billing = itemNamed("Billing");
    expect(billing.tagName).toBe("A");
    expect(billing.getAttribute("href")).toBe("/billing");
  });

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(<BasicMenu />);
    const scope = host.querySelector("[data-theme-brand]");
    const menu = await openWithClick();
    expect(scope).not.toBeNull();
    expect(scope?.contains(menu)).toBe(true);
    expect([...document.body.children].includes(menu)).toBe(false);
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <BasicMenu />
      </>
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = page.getByRole("button", { name: "Open", exact: true }).element();
    if (!(previous instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
      throw new Error("expected buttons");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });
});
