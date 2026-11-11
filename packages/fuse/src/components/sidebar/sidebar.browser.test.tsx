import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { withLocale } from "../../../test/locale-matrix";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import {
  ContextProbe,
  Frame,
  MOBILE,
  OrdersLink,
  bySlot,
  captureCookieWrites,
  railNamed,
  setupSidebarBrowser,
  sidebarRoot,
} from "../../../test/sidebar-browser-fixtures";
import { DESCRIPTION_COPY, TITLE_COPY, TOGGLE_COPY } from "../../../test/sidebar-contract";
import { px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { Sidebar } from "./index";
import type { SidebarContextValue, SidebarProviderProps } from "./sidebar";

setupSidebarBrowser();

/**
 * Pins `navigator.platform`, which picks the shortcut's modifier, so a suite reads the same on a
 * macOS workstation and a Linux CI runner. The own property shadows the prototype getter and is
 * deleted after each test.
 */
function stubPlatform(platform: "MacIntel" | "Win32"): void {
  Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
}

beforeEach(() => {
  stubPlatform("MacIntel");
});

afterEach(() => {
  // SAFETY: deleting the own property restores the prototype getter that stubPlatform shadowed.
  Reflect.deleteProperty(navigator, "platform");
});

/** Dispatches a B keydown and waits two frames, so a toggle it causes has committed. */
async function pressB(
  init: KeyboardEventInit,
  target: EventTarget = window,
  before?: (event: KeyboardEvent) => void
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true, ...init });
  before?.(event);
  target.dispatchEvent(event);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return event;
}

/**
 * For suites whose contract is state, not motion: with the shell's width tween off, the
 * Trigger in the Inset stops moving as soon as the rail toggles, so a click needs no wait for
 * it to settle. The fixture's afterEach releases the emulation.
 */
function withoutShellMotion(): void {
  beforeEach(async () => {
    await emulateReducedMotion("reduce");
  });
}

describe("Sidebar toggle paths", () => {
  it("toggles data-state from ⌘B on Apple platforms and prevents the browser default", async () => {
    renderThemed(<Frame />);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");

    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect(sidebarRoot().getAttribute("data-collapsible")).toBe("offcanvas");

    const event = await pressB({ metaKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    expect(sidebarRoot().getAttribute("data-collapsible")).toBe("");
    expect((await pressB({})).defaultPrevented).toBe(false);
  });

  it("toggles from Ctrl+B on Windows and leaves Ctrl+B to the caret on Apple platforms", async () => {
    renderThemed(<Frame />);
    expect((await pressB({ ctrlKey: true })).defaultPrevented).toBe(false);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");

    stubPlatform("Win32");
    expect((await pressB({ ctrlKey: true })).defaultPrevented).toBe(true);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect((await pressB({ metaKey: true })).defaultPrevented).toBe(false);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
  });

  it.each([
    ["an event another handler already took", { metaKey: true }, "window", true],
    ["a press mid-composition", { metaKey: true, isComposing: true }, "window", false],
    ["a press typed into a textarea", { metaKey: true }, "Notes", false],
    ["a press typed into a contenteditable", { metaKey: true }, "Editor", false],
  ] as const)("ignores %s", async (_case, init, target, handled) => {
    renderThemed(
      <>
        <Frame />
        <textarea aria-label="Notes" />
        <div role="textbox" aria-label="Editor" contentEditable suppressContentEditableWarning />
      </>
    );
    const event = await pressB(
      init,
      target === "window" ? window : roleNamed("textbox", target),
      handled ? (pressed) => pressed.preventDefault() : undefined
    );
    // Only the handler that took it marks it handled; the sidebar never does.
    expect(event.defaultPrevented).toBe(handled);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
  });

  it("toggles from the Trigger, named by the dictionary, and runs the caller's onClick first", async () => {
    const order: string[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider onOpenChange={() => order.push("toggle")} open>
          <Sidebar.Root />
          <Sidebar.Inset>
            <Sidebar.Trigger onClick={() => order.push("onClick")} />
            <Sidebar.Trigger aria-label="Forwarded shortcut" aria-keyshortcuts={undefined} />
            <Sidebar.Trigger aria-label="Own shortcut" aria-keyshortcuts="Alt+S" />
          </Sidebar.Inset>
        </Sidebar.Provider>
      )
    );
    const trigger = roleNamed("button", "Toggle sidebar");
    expect(trigger.getAttribute("data-slot")).toBe("sidebar-trigger");
    expect(trigger.getAttribute("aria-label")).toBe("Toggle sidebar");
    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Meta+B Control+B");
    // A wrapper's unset value keeps the shortcut; an explicit one replaces it.
    expect(roleNamed("button", "Forwarded shortcut").getAttribute("aria-keyshortcuts")).toBe(
      "Meta+B Control+B"
    );
    expect(roleNamed("button", "Own shortcut").getAttribute("aria-keyshortcuts")).toBe("Alt+S");
    expect(trigger.querySelector(".sr-only")?.textContent).toBe("Toggle sidebar");
    expect(trigger.querySelector("svg")).not.toBeNull();

    await userEvent.click(trigger);
    expect(order).toEqual(["onClick", "toggle"]);
  });

  it("toggles from the Rail, a mouse-only affordance with a localized name, and runs the caller's onClick", async () => {
    const clicks: string[] = [];
    renderThemed(<Frame rail={<Sidebar.Rail onClick={() => clicks.push("rail")} />} />);
    const rail = railNamed("Toggle sidebar");
    expect(rail.getAttribute("title")).toBe("Toggle sidebar");
    expect(rail.tabIndex).toBe(-1);
    expect(rail.getAttribute("aria-hidden")).toBe("true");
    expect(page.getByRole("button", { name: "Toggle sidebar", exact: true }).elements()).toHaveLength(1);

    await userEvent.click(rail);
    expect(clicks).toEqual(["rail"]);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    await userEvent.click(rail);
    expect(clicks).toEqual(["rail", "rail"]);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
  });
});

describe("Sidebar focus while collapsed", () => {
  it("moves focus out of the panel on collapse and reaches its controls again once it reopens", async () => {
    // Without the width tween the Trigger is still when it is clicked.
    await emulateReducedMotion("reduce");
    let latest: SidebarContextValue | undefined;
    renderThemed(
      <Frame probe={<ContextProbe onValue={(value) => (latest = value)} />}>
        <OrdersLink />
      </Frame>
    );
    roleNamed("link", "Orders").focus();

    latest?.setOpen(false);
    await expect.poll(() => sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect(sidebarRoot().contains(document.activeElement)).toBe(false);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Toggle sidebar"));

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    await expect.poll(() => sidebarRoot().getAttribute("data-state")).toBe("expanded");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(roleNamed("link", "Orders"));
  });

  it("keeps icon-collapsed menu buttons in the Tab order", async () => {
    renderThemed(
      <Frame provider={{ defaultOpen: false }} root={{ collapsible: "icon" }}>
        <OrdersLink />
      </Frame>
    );
    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(roleNamed("link", "Orders"));
  });
});

describe("Sidebar callback stability", () => {
  withoutShellMotion();

  it("keeps setOpen and toggleSidebar referentially stable across toggles", async () => {
    const seen: SidebarContextValue[] = [];
    renderThemed(<Frame probe={<ContextProbe onValue={(value) => seen.push(value)} />} />);

    await userEvent.click(roleNamed("button", TOGGLE_COPY["en-US"]));
    await userEvent.click(roleNamed("button", TOGGLE_COPY["en-US"]));

    expect(seen.length, "three context values: mount plus two toggles").toBe(3);
    expect(seen.map((value) => value.open)).toEqual([true, false, true]);
    expect(new Set(seen.map((value) => value.setOpen)).size, "one setOpen identity").toBe(1);
    expect(new Set(seen.map((value) => value.toggleSidebar)).size, "one toggleSidebar identity").toBe(1);
  });

  it("subscribes the cmd+B keydown listener once, not once per toggle", async () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    try {
      renderThemed(<Frame />);
      const addedOnMount = added.mock.calls.filter(([type]) => type === "keydown").length;
      expect(addedOnMount, "one keydown subscription on mount").toBe(1);

      await userEvent.click(roleNamed("button", TOGGLE_COPY["en-US"]));
      await userEvent.click(roleNamed("button", TOGGLE_COPY["en-US"]));

      expect(added.mock.calls.filter(([type]) => type === "keydown").length).toBe(addedOnMount);
      expect(removed.mock.calls.filter(([type]) => type === "keydown").length).toBe(0);
    } finally {
      added.mockRestore();
      removed.mockRestore();
    }
  });
});

describe("Sidebar locale copy", () => {
  // The unit suite holds every locale's rows against the dictionary; one non-default locale
  // proves the Provider reads it for the Trigger and the mobile Sheet's title and description.
  it("titles and describes the mobile Sheet from the nb-NO dictionary", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    renderThemed(<Frame locale="nb-NO" />);
    await userEvent.click(roleNamed("button", TOGGLE_COPY["nb-NO"]));
    await expect.element(page.getByRole("dialog", { name: TITLE_COPY["nb-NO"] })).toBeVisible();
    const dialog = roleNamed("dialog", TITLE_COPY["nb-NO"]);
    const description = page.getByText(DESCRIPTION_COPY["nb-NO"], { exact: true }).element();
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("lets Provider labels override every dictionary row", async () => {
    renderThemed(
      <Frame provider={{ labels: { toggle: "Menu", title: "Navigation", description: "Site links." } }} />
    );
    expect(roleNamed("button", "Menu").getAttribute("data-slot")).toBe("sidebar-trigger");
    expect(railNamed("Menu").getAttribute("title")).toBe("Menu");

    await page.viewport(MOBILE.width, MOBILE.height);
    await userEvent.click(roleNamed("button", "Menu"));
    await expect.element(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    expect(page.getByText("Site links.", { exact: true }).query()).not.toBeNull();
  });
});

describe("Sidebar cookie persistence", () => {
  withoutShellMotion();

  it("writes sidebar:state with path and seven-day max-age on every toggle", async () => {
    renderThemed(<Frame />);
    const writes = await captureCookieWrites(async () => {
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
    });
    expect(writes).toEqual([
      "sidebar:state=false; path=/; max-age=604800",
      "sidebar:state=true; path=/; max-age=604800",
    ]);
    expect(document.cookie).toContain("sidebar:state=true");
  });

  it("still writes the cookie when controlled, alongside onOpenChange", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<Frame provider={{ open: true, onOpenChange }} />);
    const writes = await captureCookieWrites(async () => {
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(writes).toEqual(["sidebar:state=false; path=/; max-age=604800"]);
    expect(sidebarRoot().getAttribute("data-state"), "controlled open wins over the click").toBe("expanded");
  });
});

describe("Sidebar in a bounded container", () => {
  withoutShellMotion();

  /** The host's box, written out by hand: 400px tall, 120px down and 300px in from the page. */
  const BOX = { top: 120, left: 300, height: 400 } as const;

  /** A page with a control before the box and a contained Sidebar filling the box. */
  function Bounded({ provider }: { provider?: Partial<SidebarProviderProps> }) {
    return (
      <>
        <button type="button">Outside</button>
        <div
          role="region"
          aria-label="Pane"
          style={{ position: "absolute", top: BOX.top, left: BOX.left, width: 600, height: BOX.height }}>
          <Frame provider={{ bounds: "container", ...provider }} />
        </div>
      </>
    );
  }

  function railBox(): DOMRect {
    return bySlot("sidebar-container").getBoundingClientRect();
  }

  it("fills the box, not the viewport, and keeps the collapsed rail inside it", async () => {
    renderThemed(<Bounded />);
    const pane = roleNamed("region", "Pane").getBoundingClientRect();
    expect(bySlot("sidebar-wrapper").getBoundingClientRect().height).toBe(BOX.height);
    const rail = railBox();
    expect({ top: rail.top, left: rail.left, height: rail.height }).toEqual({
      top: pane.top,
      left: pane.left,
      height: BOX.height,
    });

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    await expect.poll(() => railBox().right).toBe(pane.left);
    // The offcanvas rail slid past the box's start edge; the box clips it, so the page beside
    // the box is what a pointer there reaches.
    const hit = document.elementFromPoint(pane.left - 50, pane.top + BOX.height / 2);
    expect(bySlot("sidebar-wrapper").contains(hit)).toBe(false);
  });

  it("keeps an uncontrolled Provider's open state in memory and writes no cookie", async () => {
    renderThemed(<Bounded />);
    const uncontrolled = await captureCookieWrites(async () => {
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
      expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
    expect(uncontrolled).toEqual([]);
  });

  it("writes no cookie when controlled and reports the change through onOpenChange", async () => {
    const onOpenChange = vi.fn();
    renderThemed(<Bounded provider={{ open: true, onOpenChange }} />);
    const writes = await captureCookieWrites(async () => {
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
    });
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(writes).toEqual([]);
  });

  it("toggles on ⌘B only from inside its own tree", async () => {
    renderThemed(<Bounded />);
    roleNamed("button", "Outside").focus();
    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    expect((await pressB({ metaKey: true })).defaultPrevented).toBe(false);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");

    roleNamed("button", "After").focus();
    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    const inside = await pressB({ metaKey: true }, roleNamed("button", "After"));
    expect(inside.defaultPrevented).toBe(true);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
  });

  it("reports a handled ⌘B as handled to a React ancestor's onKeyDown", async () => {
    const seen: { defaultPrevented: boolean; isDefaultPrevented: boolean }[] = [];
    renderThemed(
      <div
        role="group"
        aria-label="Host"
        onKeyDown={(event) => {
          if (event.key === "b") {
            seen.push({
              defaultPrevented: event.defaultPrevented,
              isDefaultPrevented: event.isDefaultPrevented(),
            });
          }
        }}>
        <Bounded />
      </div>
    );
    roleNamed("button", "After").focus();
    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect(seen).toEqual([{ defaultPrevented: true, isDefaultPrevented: true }]);
  });

  it("takes ⌘B inside itself and leaves it to the page Sidebar everywhere else", async () => {
    renderThemed(
      <Frame
        probe={
          <div style={{ height: 300 }}>
            <Frame provider={{ bounds: "container", labels: { toggle: "Pane menu" } }} />
          </div>
        }
      />
    );
    const pageRoot = () => railNamed("Toggle sidebar").closest("[data-state]");
    const paneRoot = () => railNamed("Pane menu").closest("[data-state]");

    roleNamed("button", "Pane menu").focus();
    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(paneRoot()?.getAttribute("data-state")).toBe("collapsed");
    expect(pageRoot()?.getAttribute("data-state")).toBe("expanded");

    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(pageRoot()?.getAttribute("data-state")).toBe("collapsed");
    expect(paneRoot()?.getAttribute("data-state")).toBe("collapsed");
  });
});

describe("Sidebar controlled and uncontrolled state", () => {
  withoutShellMotion();

  it("starts collapsed from defaultOpen={false} and reports state through useSidebar", () => {
    let latest: SidebarContextValue | undefined;
    renderThemed(
      <Frame
        provider={{ defaultOpen: false }}
        probe={
          <ContextProbe
            onValue={(value) => {
              latest = value;
            }}
          />
        }
      />
    );
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect(latest?.state).toBe("collapsed");
    expect(latest?.open).toBe(false);
    expect(latest?.isMobile).toBe(false);
    expect(latest?.openMobile).toBe(false);
  });

  it("keeps a controlled open prop authoritative over internal state", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderThemed(<Frame provider={{ open: false, onOpenChange }} />);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");

    rerender(<Frame provider={{ open: true, onOpenChange }} />);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
  });
});

describe("Sidebar menu skeleton geometry", () => {
  /**
   * A collapsed icon-rail row in px, written out by hand: a 32px square padded 8px on every
   * side, so the 16px icon sits 8px in from the row's top and start edges, at both densities.
   */
  const COLLAPSED = { size: 32, padding: 8, iconOffset: 8 } as const;

  /** The left and top distance from `outer`'s border box to `inner`'s. */
  function offsetWithin(inner: Element, outer: Element) {
    const innerBox = inner.getBoundingClientRect();
    const outerBox = outer.getBoundingClientRect();
    return { left: innerBox.left - outerBox.left, top: innerBox.top - outerBox.top };
  }

  for (const density of ["dense", "comfortable"] as const) {
    it(`keeps the skeleton and the default menu button on one box in the collapsed icon rail (${density})`, () => {
      stampDensity(density);
      renderThemed(
        <Frame provider={{ defaultOpen: false }} root={{ collapsible: "icon" }}>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton>
              <svg aria-hidden="true" viewBox="0 0 16 16" />
              <span>Overview</span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuSkeleton showIcon role="group" aria-label="Loading row" />
          </Sidebar.MenuItem>
        </Frame>
      );
      expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
      const button = roleNamed("button", "Overview");
      const skeleton = roleNamed("group", "Loading row");
      const buttonIcon = button.querySelector("svg");
      // The skeleton's icon placeholder has no role, so it is found by its slot.
      const skeletonIcon = bySlot("sidebar-menu-skeleton-icon", skeleton);
      if (buttonIcon === null) {
        throw new Error("expected the button's icon");
      }

      for (const [name, row, icon] of [
        ["button", button, buttonIcon],
        ["skeleton", skeleton, skeletonIcon],
      ] as const) {
        const box = row.getBoundingClientRect();
        const style = getComputedStyle(row);
        expect(box.height, `${name} height`).toBe(COLLAPSED.size);
        expect(box.width, `${name} width`).toBe(COLLAPSED.size);
        expect(px(style.paddingLeft), `${name} start`).toBe(COLLAPSED.padding);
        expect(px(style.paddingRight), `${name} end`).toBe(COLLAPSED.padding);
        expect(offsetWithin(icon, row), `${name} icon`).toEqual({
          left: COLLAPSED.iconOffset,
          top: COLLAPSED.iconOffset,
        });
      }
      // Both rows sit at the same inline position in the rail.
      expect(skeleton.getBoundingClientRect().left).toBe(button.getBoundingClientRect().left);
      expect(skeletonIcon.getBoundingClientRect().left).toBe(buttonIcon.getBoundingClientRect().left);
    });
  }
});

describe("Sidebar.Root branches", () => {
  it("keeps the mobile dialog's name, description and role when ARIA props are undefined", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    renderThemed(
      <Frame root={{ "aria-labelledby": undefined, "aria-describedby": undefined, role: undefined }} />
    );

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    const dialog = page.getByRole("dialog", { name: TITLE_COPY["en-US"], exact: true });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription(DESCRIPTION_COPY["en-US"]);
  });
});

describe("Sidebar.MenuButton", () => {
  it("paints the shared focus ring on keyboard focus and not on mouse focus", async () => {
    renderThemed(
      <Frame>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>First</Sidebar.MenuButton>
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>Second</Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Frame>
    );
    await assertFocusRingOnKeyboardAbsentOnMouse(roleNamed("button", "First"), roleNamed("button", "Second"));
  });
});
