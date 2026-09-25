import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { DropdownMenu } from "./index";

function menuNamed(name?: string): HTMLElement {
  const locator = name === undefined ? page.getByRole("menu") : page.getByRole("menu", { name, exact: true });
  const element = locator.element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a menu");
  }
  return element;
}

function itemNamed(
  name: string,
  role: "menuitem" | "menuitemcheckbox" | "menuitemradio" = "menuitem"
): HTMLElement {
  const element = page.getByRole(role, { name, exact: true }).element();
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

function triggerButton(): HTMLElement {
  const element = page.getByRole("button", { name: "Open", exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the menu trigger");
  }
  return element;
}

async function openWithClick(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Open", exact: true }).element());
  return menuNamed();
}

async function openWithArrowDown(): Promise<HTMLElement> {
  const trigger = page.getByRole("button", { name: "Open", exact: true }).element();
  if (!(trigger instanceof HTMLElement)) {
    throw new Error("expected trigger");
  }
  trigger.focus();
  await userEvent.keyboard("{ArrowDown}");
  return menuNamed();
}

describe("DropdownMenu", () => {
  it("opens from the trigger click and exposes a menu", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<BasicMenu onOpenChange={onOpenChange} />);

    const menu = await openWithClick();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(menu.getAttribute("data-slot")).toBe("dropdown-menu-content");
    expect(itemNamed("Profile")).toBeTruthy();
  });

  it("opens from ArrowDown on the trigger and highlights the first item", async () => {
    renderThemed(<BasicMenu />);
    await openWithArrowDown();
    expect(document.activeElement).toBe(itemNamed("Profile"));
  });

  it("opens from Enter and from Space on the trigger, highlighting the first item", async () => {
    renderThemed(<BasicMenu />);
    const trigger = triggerButton();

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).not.toBeNull();
    });
    expect(document.activeElement).toBe(itemNamed("Profile"));

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);

    await userEvent.keyboard(" ");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).not.toBeNull();
    });
    expect(document.activeElement).toBe(itemNamed("Profile"));
  });

  it("opens to the last item from ArrowUp on the trigger", async () => {
    renderThemed(<BasicMenu />);
    triggerButton().focus();

    await userEvent.keyboard("{ArrowUp}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).not.toBeNull();
    });
    expect(document.activeElement).toBe(itemNamed("Logout"));
  });

  it("lets arrows reach a disabled item but refuses to activate it", async () => {
    const onSettings = vi.fn();
    renderThemed(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Profile</DropdownMenu.Item>
          <DropdownMenu.Item disabled onClick={onSettings}>
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Item>Logout</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
    await openWithArrowDown();
    expect(document.activeElement).toBe(itemNamed("Profile"));

    // base-ui keeps a disabled item in the roving sequence so a
    // screen-reader user hears that the option exists; it announces aria-disabled instead.
    await userEvent.keyboard("{ArrowDown}");
    const settings = itemNamed("Settings");
    expect(document.activeElement).toBe(settings);
    expect(settings.getAttribute("aria-disabled")).toBe("true");

    await userEvent.keyboard("{Enter}");
    expect(onSettings, "Enter on a disabled item must not activate it").not.toHaveBeenCalled();
    expect(page.getByRole("menu").query(), "the menu must stay open").not.toBeNull();

    await userEvent.keyboard(" ");
    expect(onSettings).not.toHaveBeenCalled();
    expect(page.getByRole("menu").query()).not.toBeNull();

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(itemNamed("Logout"));
  });

  it("activates the highlighted item with Enter and with Space, closing the menu", async () => {
    const onProfile = vi.fn();
    const onLogout = vi.fn();
    function ActivatableMenu() {
      return (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={onProfile}>Profile</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onLogout}>Logout</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    }
    renderThemed(<ActivatableMenu />);

    await openWithArrowDown();
    expect(document.activeElement).toBe(itemNamed("Profile"));
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    expect(onProfile).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(triggerButton());

    await openWithArrowDown();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(itemNamed("Logout"));
    await userEvent.keyboard(" ");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onProfile).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(<BasicMenu />);
    const trigger = page.getByRole("button", { name: "Open", exact: true }).element();
    await openWithClick();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when an item is activated", async () => {
    renderThemed(<BasicMenu />);
    await openWithClick();
    await userEvent.click(itemNamed("Logout"));
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
  });

  it("cycles arrow keys and Home/End across menuitems", async () => {
    renderThemed(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Profile</DropdownMenu.Item>
          <DropdownMenu.Item>Billing</DropdownMenu.Item>
          <DropdownMenu.Item>Logout</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
    await openWithArrowDown();
    expect(document.activeElement).toBe(itemNamed("Profile"));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(itemNamed("Billing"));

    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(itemNamed("Profile"));

    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(itemNamed("Logout"));

    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(itemNamed("Profile"));
  });

  it("dims disabled items via data-disabled", async () => {
    renderThemed(<BasicMenu />);
    await openWithClick();
    const settings = itemNamed("Settings");
    expect(settings.getAttribute("data-disabled")).not.toBeNull();
    expect(settings.getAttribute("aria-disabled")).toBe("true");
  });

  it("jumps to a matching item on typeahead", async () => {
    renderThemed(<BasicMenu />);
    await openWithArrowDown();
    await userEvent.keyboard("l");
    expect(document.activeElement).toBe(itemNamed("Logout"));
  });

  it("opens a submenu with ArrowRight and closes it with ArrowLeft", async () => {
    renderThemed(
      <BasicMenu
        extra={
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item>Team</DropdownMenu.Item>
              <DropdownMenu.Item>Invite</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        }
      />
    );
    await openWithArrowDown();
    await userEvent.keyboard("{End}");
    const subTrigger = itemNamed("More");
    expect(document.activeElement).toBe(subTrigger);

    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() => {
      expect(subTrigger.getAttribute("data-popup-open")).not.toBeNull();
    });
    expect(page.getByRole("menu").elements()).toHaveLength(2);
    expect(document.activeElement).toBe(itemNamed("Team"));
    expect(itemNamed("Team").closest('[role="menu"]')).not.toBeNull();

    await userEvent.keyboard("{ArrowLeft}");
    await vi.waitFor(() => {
      expect(subTrigger.getAttribute("data-popup-open")).toBeNull();
    });
    expect(document.activeElement).toBe(subTrigger);
  });

  it("places the submenu beside its trigger with the lifted popup metrics", async () => {
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
    const subTrigger = itemNamed("More");
    await vi.waitFor(() => {
      expect(subTrigger.getAttribute("data-popup-open")).not.toBeNull();
    });

    const submenu = itemNamed("Team").closest('[role="menu"]');
    if (!(submenu instanceof HTMLElement)) {
      throw new Error("expected the submenu to be a menu");
    }
    const parentMenu = subTrigger.closest('[role="menu"]');
    if (!(parentMenu instanceof HTMLElement)) {
      throw new Error("expected the sub-trigger to sit in a menu");
    }

    // side="right": the submenu opens off the parent's right edge rather than
    // stacking under it, so it starts past the parent's midline and ends beyond
    // the parent's right edge.
    const submenuBox = submenu.getBoundingClientRect();
    const parentBox = parentMenu.getBoundingClientRect();
    expect(submenuBox.left).toBeGreaterThan(parentBox.left + parentBox.width / 2);
    expect(submenuBox.right).toBeGreaterThan(parentBox.right);
    // alignOffset={-3}: its first item lines up a hair above the trigger.
    expect(submenuBox.top).toBeLessThan(subTrigger.getBoundingClientRect().top);
    // min-w-[96px] and the deeper elevation the nested popup carries.
    expect(submenuBox.width).toBeGreaterThanOrEqual(96);
    expect(getComputedStyle(submenu).boxShadow).not.toBe("none");
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
    const trigger = page.getByRole("button", { name: "Open", exact: true }).element();
    await openWithArrowDown();
    await userEvent.keyboard("{End}{ArrowRight}");
    await vi.waitFor(() => {
      expect(itemNamed("More").getAttribute("data-popup-open")).not.toBeNull();
    });

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
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
    const checkbox = itemNamed("Show toolbar", "menuitemcheckbox");
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(checkbox.querySelector("svg")).not.toBeNull();

    await userEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(itemNamed("Show toolbar", "menuitemcheckbox").getAttribute("aria-checked")).toBe("false");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    await openWithClick();
    expect(itemNamed("Show toolbar", "menuitemcheckbox").getAttribute("aria-checked")).toBe("false");
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
    expect(itemNamed("Status bar", "menuitemradio").getAttribute("aria-checked")).toBe("true");
    expect(itemNamed("Panel", "menuitemradio").getAttribute("aria-checked")).toBe("false");

    await userEvent.click(itemNamed("Panel", "menuitemradio"));
    expect(onValueChange).toHaveBeenCalledWith("panel");
    expect(itemNamed("Panel", "menuitemradio").getAttribute("aria-checked")).toBe("true");
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("menu").query()).toBeNull();
    });
    await openWithClick();
    expect(itemNamed("Panel", "menuitemradio").getAttribute("aria-checked")).toBe("true");
    expect(itemNamed("Panel", "menuitemradio").querySelector("svg")).not.toBeNull();
  });

  it("renders LinkItem as a menuitem backed by an anchor", () => {
    renderThemed(
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.LinkItem href="/settings">Settings</DropdownMenu.LinkItem>
          <DropdownMenu.LinkItem render={<a href="/billing" />}>Billing</DropdownMenu.LinkItem>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
    const settings = itemNamed("Settings");
    expect(settings.tagName).toBe("A");
    expect(settings.getAttribute("href")).toBe("/settings");
    const billing = itemNamed("Billing");
    expect(billing.tagName).toBe("A");
    expect(billing.getAttribute("href")).toBe("/billing");
  });

  it("emits data-variant destructive and data-inset, with error-token classes", () => {
    renderThemed(
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item inset variant="destructive">
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
    const item = itemNamed("Delete");
    expect(item.getAttribute("data-variant")).toBe("destructive");
    expect(item.getAttribute("data-inset")).toBe("true");
    expect(getComputedStyle(item).color).toBe(cssVarColor(item, "--error"));
  });

  it("portals Content into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(<BasicMenu />);
    const scope = host.querySelector("[data-theme-brand]");
    const menu = await openWithClick();
    expect(scope).not.toBeNull();
    expect(scope?.contains(menu)).toBe(true);
    expect([...document.body.children].includes(menu)).toBe(false);
  });

  it("portals Content into an explicit container element", () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <DropdownMenu.Root defaultOpen>
              <DropdownMenu.Content container={node}>
                <DropdownMenu.Item>Profile</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          ) : null}
        </>
      );
    }
    renderThemed(<ExplicitContainer />);
    const menu = menuNamed();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(menu)).toBe(true);
    expect([...document.body.children].includes(menu)).toBe(false);
  });

  it("portals SubContent into an explicit container element", () => {
    function ExplicitSubContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Sub island" />
          {node ? (
            <DropdownMenu.Root defaultOpen>
              <DropdownMenu.Content>
                <DropdownMenu.Sub defaultOpen>
                  <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent container={node}>
                    <DropdownMenu.Item>Team</DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          ) : null}
        </>
      );
    }
    renderThemed(<ExplicitSubContainer />);
    const team = itemNamed("Team");
    const island = page.getByRole("region", { name: "Sub island", exact: true }).element();
    expect(island.contains(team)).toBe(true);
  });

  it("waits while the resolved Content container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <DropdownMenu.Root open>
          <DropdownMenu.Content container={ref}>
            <DropdownMenu.Item>Pending</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    }
    renderThemed(<NeverAttached />);
    expect(page.getByRole("menu").query()).toBeNull();
  });

  it("waits while the resolved SubContent container element is still null", () => {
    function NeverAttachedSub() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <DropdownMenu.Root open>
          <DropdownMenu.Content>
            <DropdownMenu.Sub open>
              <DropdownMenu.SubTrigger>More</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent container={ref}>
                <DropdownMenu.Item>Pending</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    }
    renderThemed(<NeverAttachedSub />);
    expect(page.getByRole("menuitem", { name: "Pending", exact: true }).query()).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    renderThemed(
      <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
        <DropdownMenu.Root open>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Scoped</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </ThemeScope>
    );
    const menu = menuNamed();
    const scope = menu.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
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
