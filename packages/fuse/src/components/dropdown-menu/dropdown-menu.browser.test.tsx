import { useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import {
  colorPixel,
  expectFocusInsideFill,
  expectGrayTextOnCanvas,
  expectStateFill,
  expectTextOnFill,
  highlightColors,
  groundOf,
  insetOutline,
} from "../../../test/forced-highlight";
import { systemFace, withForcedColors } from "../../../test/media-emulation";
import {
  differsFromCanvas,
  finishPopupEntrance,
  pixelContrast,
  pixelsAt,
} from "../../../test/screenshot-pixels";
import { renderThemed } from "../../../test/themed-browser-render";
import { roleNamed } from "../../../test/themed-browser-render";
import { DropdownMenu } from "./index";

type ItemRole = "menuitem" | "menuitemcheckbox" | "menuitemradio";

/**
 * Base UI mounts the menu popup and moves focus into it a frame or more after the
 * opening event, so the open helpers wait for it and for its entrance before reading the element.
 */
async function openedMenu(): Promise<HTMLElement> {
  await expect.element(page.getByRole("menu")).toBeInTheDocument();
  const element = page.getByRole("menu").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected a menu");
  }
  await finishPopupEntrance(element);
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

  it("draws its separator in forced-colors mode", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<BasicMenu extra={<DropdownMenu.Separator />} />);
      const menu = await openWithClick();
      const line = page.getByRole("separator").element().getBoundingClientRect();
      expect(await differsFromCanvas(menu, [line])).toEqual([true]);
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

describe("DropdownMenu", () => {
  it("portals Content and SubContent into an explicit container element", async () => {
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
    const { unmount } = renderThemed(<ExplicitContainer />);
    const menu = await openedMenu();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(menu)).toBe(true);
    expect([...document.body.children].includes(menu)).toBe(false);
    unmount();

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
    const team = await mountedItem("Team");
    const subIsland = roleNamed("region", "Sub island");
    expect(subIsland.contains(team)).toBe(true);
  });
});

describe("DropdownMenu highlighted row in forced-colors mode", () => {
  /** A square icon that fills its box, so its ink reads at its middle. */
  const SQUARE = (
    <svg viewBox="0 0 16 16" aria-hidden>
      <rect x="2" y="2" width="12" height="12" fill="currentColor" />
    </svg>
  );

  /** Pairs of rows of each kind, the first of a pair the one the tests highlight. */
  function KindsMenu() {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Profile</DropdownMenu.Item>
          <DropdownMenu.Item>Billing</DropdownMenu.Item>
          <DropdownMenu.CheckboxItem defaultChecked>Pinned</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem defaultChecked>Starred</DropdownMenu.CheckboxItem>
          <DropdownMenu.RadioGroup defaultValue="alpha">
            <DropdownMenu.RadioItem value="alpha">Alpha</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="bravo">Bravo</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item>Email</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>Moved</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item>Archive</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Item variant="destructive">
            {SQUARE}
            Delete
          </DropdownMenu.Item>
          <DropdownMenu.Item variant="destructive">
            {SQUARE}
            Remove
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
  }

  const KINDS = [
    ["item", "menuitem", "Profile", "Billing"],
    ["checkbox item", "menuitemcheckbox", "Pinned", "Starred"],
    ["radio item", "menuitemradio", "Alpha", "Bravo"],
    ["sub-trigger", "menuitem", "Share", "Moved"],
  ] as const;

  async function highlightWithKeyboard(name: string, role: ItemRole): Promise<HTMLElement> {
    await openWithArrowDown();
    const row = await mountedItem(name, role);
    for (let step = 0; step < 12 && !row.hasAttribute("data-highlighted"); step++) {
      await userEvent.keyboard("{ArrowDown}");
    }
    expect(row.hasAttribute("data-highlighted")).toBe(true);
    return row;
  }

  it.each(KINDS)(
    "fills the %s the keyboard highlights, apart from its neighbor",
    async (kind, role, name, neighbor) => {
      await withForcedColors("active", async () => {
        renderThemed(<KindsMenu />);
        const row = await highlightWithKeyboard(name, role);
        await expectStateFill(row, itemNamed(neighbor, role), `keyboard-highlighted ${kind}`);
        await expectFocusInsideFill(row, `keyboard-highlighted ${kind} focus outline`);
      });
    }
  );

  // A hovered sub-trigger opens its submenu, so the pointer cases leave it out.
  it.each(KINDS.slice(0, 3))(
    "fills the %s the pointer highlights in a menu opened by a click, apart from its neighbor",
    async (kind, role, name, neighbor) => {
      await withForcedColors("active", async () => {
        renderThemed(<KindsMenu />);
        await openWithClick();
        const row = await mountedItem(name, role);
        await userEvent.hover(row);
        await vi.waitFor(() => expect(row.hasAttribute("data-highlighted")).toBe(true));
        await expectStateFill(row, itemNamed(neighbor, role), `pointer-highlighted ${kind}`);
      });
    }
  );

  it("fills a highlighted destructive item, with its label legible on the fill and its icon in HighlightText", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<KindsMenu />);
      const row = await highlightWithKeyboard("Delete", "menuitem");
      const icon = row.querySelector("svg");
      if (icon === null) throw new Error("expected the destructive item's icon");
      // Oracle: the Highlight and HighlightText system colors the page resolves, and WCAG's 4.5:1
      // text minimum, which the destructive red on Highlight misses.
      const colorOf = highlightColors();
      const fill = await groundOf(row);
      expect(colorOf(fill), "row fill").toBe("Highlight");
      await expectTextOnFill(row, fill, "destructive label");
      const box = icon.getBoundingClientRect();
      const [center] = await pixelsAt(icon, [[box.width / 2, box.height / 2]]);
      if (center === undefined) throw new Error("expected the icon's center pixel");
      expect(colorOf(center), "icon ink").toBe("HighlightText");
    });
  });

  it("draws a keyboard-highlighted disabled item in GrayText on Canvas, inside an undimmed outline", async () => {
    await withForcedColors("active", async () => {
      renderThemed(
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Download</DropdownMenu.Item>
            <DropdownMenu.Item disabled>
              Send <span>reminder</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
      const row = await highlightWithKeyboard("Send reminder", "menuitem");
      expect(row.matches(":focus-visible"), "keyboard focus on the row").toBe(true);
      // Oracle: the Canvas, CanvasText and GrayText system colors the page resolves, and WCAG
      // 1.4.11's 3:1 for a focus indicator against what it sits on.
      const { pixel: outline, ground } = await insetOutline(row);
      expect(pixelContrast(outline, ground), "focus outline against the row").toBeGreaterThanOrEqual(3);
      expect(
        pixelContrast(outline, colorPixel(systemFace("Canvas").text)),
        "focus outline against CanvasText"
      ).toBeLessThan(1.1);
      // The row's own text and the span's, which a descendant color arm reaches, each count as a run.
      await expectGrayTextOnCanvas(row, "disabled item");
    });
  });

  it("draws a sub-trigger disabled while its submenu is open in GrayText on Canvas, without the fill", async () => {
    await withForcedColors("active", async () => {
      function ShareMenu({ disabled }: { readonly disabled: boolean }) {
        return (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>Open</DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>Download</DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger disabled={disabled}>Share</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.Item>Email</DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        );
      }
      const { rerender } = renderThemed(<ShareMenu disabled={false} />);
      const share = await highlightWithKeyboard("Share", "menuitem");
      await userEvent.keyboard("{ArrowRight}");
      await vi.waitFor(() => expect(document.activeElement).toBe(itemNamed("Email")));
      rerender(<ShareMenu disabled />);
      await vi.waitFor(() => expect(share.hasAttribute("data-disabled")).toBe(true));
      expect(share.hasAttribute("data-popup-open"), "submenu still open").toBe(true);
      // Oracle: the Canvas and GrayText system colors the page resolves.
      await expectGrayTextOnCanvas(share, "disabled open sub-trigger");
    });
  });

  it("fills the sub-trigger whose submenu is open, apart from a closed one, with focus in the submenu", async () => {
    await withForcedColors("active", async () => {
      renderThemed(<KindsMenu />);
      const share = await highlightWithKeyboard("Share", "menuitem");
      await userEvent.keyboard("{ArrowRight}");
      await vi.waitFor(() => expect(document.activeElement).toBe(itemNamed("Email")));
      expect(share.hasAttribute("data-popup-open")).toBe(true);
      await expectStateFill(share, itemNamed("Moved"), "open sub-trigger");
    });
  });
});
