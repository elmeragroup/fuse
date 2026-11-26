import { StrictMode, useLayoutEffect } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectActivationCanceled, resetHashAroundEach } from "../../../test/aria-disabled-activation";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import {
  expectFocusInsideFill,
  expectStateFill,
  expectTextOnFill,
  focusByKeyboard,
} from "../../../test/forced-highlight";
import { withLocale } from "../../../test/locale-matrix";
import { withForcedColors } from "../../../test/media-emulation";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { inkContrast, pixelContrast, pixelsAt, screenshotOf } from "../../../test/screenshot-pixels";
import {
  AvatarRows,
  ContextProbe,
  Frame,
  MOBILE,
  MobileQueue,
  OrdersLink,
  QueueControls,
  ROW_STATES,
  StateRowEnds,
  StateRows,
  actionOutlinePixels,
  avatarAndRow,
  bySlot,
  captureCookieWrites,
  menuItem,
  pressB,
  railNamed,
  rowFill,
  setupSidebarBrowser,
  sidebarRoot,
  stateRow,
  stubPlatform,
  withoutShellMotion,
} from "../../../test/sidebar-browser-fixtures";
import { DESCRIPTION_COPY, TITLE_COPY, TOGGLE_COPY } from "../../../test/sidebar-contract";
import { px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { Badge } from "../badge/badge";
import { Tooltip } from "../tooltip";
import { Sidebar } from "./index";
import { useSidebar } from "./sidebar";
import type { SidebarContextValue, SidebarProviderProps } from "./sidebar";

setupSidebarBrowser();

beforeEach(() => {
  stubPlatform("MacIntel");
});

afterEach(() => {
  // SAFETY: deleting the own property restores the prototype getter that stubPlatform shadowed.
  Reflect.deleteProperty(navigator, "platform");
});

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
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the group catches ⌘B bubbling from the After button inside it
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

describe("Sidebar.Inset beside an inset panel", () => {
  withoutShellMotion();

  function insetMargins() {
    const style = getComputedStyle(bySlot("sidebar-inset"));
    return {
      top: px(style.marginTop),
      right: px(style.marginRight),
      bottom: px(style.marginBottom),
      left: px(style.marginLeft),
    };
  }

  // The card has an 8px margin on every side except the open panel's, which has none. Beside a
  // collapsed panel it has 8px on every side.
  it.each([
    { side: "left", provider: {}, expanded: { top: 8, right: 8, bottom: 8, left: 0 } },
    {
      side: "right",
      provider: { style: { flexDirection: "row-reverse" } },
      expanded: { top: 8, right: 0, bottom: 8, left: 8 },
    },
  ] as const)("keeps the card's margins beside a $side panel", async ({ side, provider, expanded }) => {
    renderThemed(<Frame provider={provider} root={{ variant: "inset", side }} />);
    expect(insetMargins(), "expanded").toEqual(expanded);

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect(insetMargins(), "collapsed").toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });
});

describe("Sidebar collapsed to the icon rail", () => {
  withoutShellMotion();

  // The collapsed rail is exactly as wide as its 64px gap, a 48px surface (`3rem`) with 8px each side.
  it.each(["inset", "floating"] as const)("sizes the collapsed %s icon rail to its gap", (variant) => {
    renderThemed(<Frame provider={{ defaultOpen: false }} root={{ variant, collapsible: "icon" }} />);
    const gap = bySlot("sidebar-gap").getBoundingClientRect();
    const container = bySlot("sidebar-container").getBoundingClientRect();
    const inner = bySlot("sidebar-inner").getBoundingClientRect();
    expect({
      gap: gap.width,
      container: container.width,
      surface: inner.width,
      start: inner.left - container.left,
      end: container.right - inner.right,
    }).toEqual({ gap: 64, container: 64, surface: 48, start: 8, end: 8 });
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

  it("keeps a controlled openMobile authoritative: the phone Sheet only reports requests", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    const onOpenMobileChange = vi.fn<(open: boolean) => void>();
    const frame = (openMobile: boolean) => <Frame provider={{ openMobile, onOpenMobileChange }} />;
    const sheet = page.getByRole("dialog", { name: TITLE_COPY["en-US"], exact: true });
    const { rerender } = renderThemed(frame(false));

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    expect(onOpenMobileChange).toHaveBeenLastCalledWith(true);
    expect(sheet.query(), "the parent has not opened it").toBeNull();

    rerender(frame(true));
    await expect.element(sheet).toBeVisible();

    await userEvent.keyboard("{Escape}");
    expect(onOpenMobileChange).toHaveBeenLastCalledWith(false);

    // Closed from outside, as a host does after a navigation.
    rerender(frame(false));
    await expect.element(sheet).not.toBeInTheDocument();
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

describe("Sidebar active rows in forced-colors mode", () => {
  it.each(["button", "sub"] as const)("fills the active %s row, apart from an inactive one", async (kind) => {
    await withForcedColors("active", async () => {
      renderThemed(
        <Frame>
          <StateRows />
        </Frame>
      );
      await expectStateFill(stateRow("active", kind), stateRow("inactive", kind), "active row");
    });
  });

  it.each(["button", "sub"] as const)(
    "keeps the active %s row's fill under keyboard focus and outlines the focused row inside its fill",
    async (kind) => {
      await withForcedColors("active", async () => {
        renderThemed(
          <Frame>
            <StateRows />
          </Frame>
        );
        const active = stateRow("active", kind);
        await focusByKeyboard(active);
        await expectFocusInsideFill(active, "focused active row");
        await expectStateFill(active, stateRow("inactive", kind), "focused active row");
      });
    }
  );

  it("shows the active row's fill through an Avatar inside it", async () => {
    await withForcedColors("active", async () => {
      renderThemed(
        <Frame>
          <AvatarRows />
        </Frame>
      );
      const [avatar, fill] = await avatarAndRow("active");
      const [, rest] = await avatarAndRow("inactive");
      // The avatar's own light background would cover the fill, under initials in HighlightText.
      expect(fill).not.toEqual(rest);
      expect(avatar).toEqual(fill);
    });
  });
});

describe("Sidebar row ends on an active row in forced-colors mode", () => {
  // Oracle: WCAG 1.4.11's 3:1 for a graphic and a focus indicator against the color beside it.
  it.each([
    ["an inherited", false],
    ["its own", true],
  ])(
    "draws the action's icon in %s color at 3:1 against an active row's fill, as against an inactive row's",
    async (_color, styled) => {
      await withForcedColors("active", async () => {
        renderThemed(
          <Frame>
            <StateRowEnds styled={styled} />
          </Frame>
        );
        for (const state of ROW_STATES) {
          const icon = bySlot("sidebar-menu-action", menuItem(`${state}-icon`)).querySelector("svg");
          if (icon === null) throw new Error("expected the icon");
          expect(
            await inkContrast(icon, await rowFill(menuItem(`${state}-icon`))),
            `${state} row`
          ).toBeGreaterThanOrEqual(3);
        }
      });
    }
  );

  it.each([
    ["light", "plain", false],
    ["light", "styled", true],
    ["dark", "plain", false],
    ["dark", "styled", true],
  ] as const)(
    "draws a text-only action and a badge's count on an active row's fill in the %s forced palette, as %s text",
    async (colorScheme, _text, styled) => {
      await withForcedColors(
        "active",
        async () => {
          renderThemed(
            <Frame>
              <StateRowEnds styled={styled} />
            </Frame>
          );
          const fill = await rowFill(menuItem("active-text"));
          await expectTextOnFill(
            bySlot("sidebar-menu-action", menuItem("active-text")),
            fill,
            "text-only action"
          );
          await expectTextOnFill(bySlot("sidebar-menu-badge", menuItem("active-badge")), fill, "badge");
        },
        { colorScheme }
      );
    }
  );

  // Oracle: WCAG 1.4.3's 4.5:1 for the count against the row's fill. The invisible text paints
  // nothing, so only the count is text that must read.
  it("reads a badge's count on an active row's fill beside an invisible mark", async () => {
    await withForcedColors("active", async () => {
      renderThemed(
        <Frame>
          <Sidebar.MenuItem data-testid="labeled-badge">
            <Sidebar.MenuButton isActive>Inbox</Sidebar.MenuButton>
            <Sidebar.MenuBadge>
              24<span className="invisible"> overdue</span>
            </Sidebar.MenuBadge>
          </Sidebar.MenuItem>
        </Frame>
      );
      const entry = menuItem("labeled-badge");
      await expectTextOnFill(bySlot("sidebar-menu-badge", entry), await rowFill(entry), "badge");
    });
  });

  // Oracle: WCAG 1.4.11's 3:1 for a graphic against the color beside it, here an unread dot drawn
  // only by its mark-fill background on the row's fill.
  it.each(["light", "dark"] as const)(
    "draws a mark-fill dot in a row end at 3:1 against an active row's fill in the %s forced palette",
    async (colorScheme) => {
      await withForcedColors(
        "active",
        async () => {
          renderThemed(
            <Frame>
              <Sidebar.MenuItem data-testid="dot-badge">
                <Sidebar.MenuButton isActive>Inbox</Sidebar.MenuButton>
                <Sidebar.MenuBadge>
                  <span data-testid="dot-badge-dot" className="size-2 rounded-full mark-fill-primary" />
                </Sidebar.MenuBadge>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem data-testid="dot-action">
                <Sidebar.MenuButton isActive>Inbox</Sidebar.MenuButton>
                <Sidebar.MenuAction aria-label="Unread">
                  <span data-testid="dot-action-dot" className="size-2 rounded-full mark-fill-primary" />
                </Sidebar.MenuAction>
              </Sidebar.MenuItem>
            </Frame>
          );
          for (const id of ["dot-badge", "dot-action"]) {
            expect(
              await inkContrast(menuItem(`${id}-dot`), await rowFill(menuItem(id))),
              id
            ).toBeGreaterThanOrEqual(3);
          }
        },
        { colorScheme }
      );
    }
  );

  // Oracle: WCAG 1.4.3's 4.5:1 for the count against the row's fill. The secondary Badge paints
  // its own light background, which would sit under a count drawn in HighlightText.
  it.each(["light", "dark"] as const)(
    "shows the active row's fill through a secondary Badge in a row end in the %s forced palette",
    async (colorScheme) => {
      await withForcedColors(
        "active",
        async () => {
          renderThemed(
            <Frame>
              <Sidebar.MenuItem data-testid="filled-badge">
                <Sidebar.MenuButton isActive>Inbox</Sidebar.MenuButton>
                <Sidebar.MenuBadge>
                  <Badge variant="secondary">24</Badge>
                </Sidebar.MenuBadge>
              </Sidebar.MenuItem>
              <Sidebar.MenuItem data-testid="filled-action">
                <Sidebar.MenuButton isActive>Inbox</Sidebar.MenuButton>
                <Sidebar.MenuAction aria-label="More">
                  <Badge variant="secondary">3</Badge>
                </Sidebar.MenuAction>
              </Sidebar.MenuItem>
            </Frame>
          );
          for (const [id, slot] of [
            ["filled-badge", "sidebar-menu-badge"],
            ["filled-action", "sidebar-menu-action"],
          ] as const) {
            await expectTextOnFill(bySlot(slot, menuItem(id)), await rowFill(menuItem(id)), id);
          }
        },
        { colorScheme }
      );
    }
  );

  // Oracle: a disabled inactive row, whose ends draw in the usual forced colors and whose edge
  // has no frame.
  it.each(["light", "dark"] as const)(
    "frames a disabled active row and draws its ends as a disabled inactive row's in the %s forced palette",
    async (colorScheme) => {
      await withForcedColors(
        "active",
        async () => {
          renderThemed(
            <Frame>
              <StateRowEnds styled disabled />
            </Frame>
          );
          for (const [end, slot] of [
            ["icon", "sidebar-menu-action"],
            ["text", "sidebar-menu-action"],
            ["badge", "sidebar-menu-badge"],
          ] as const) {
            const [active, inactive] = await Promise.all(
              ROW_STATES.map(async (state) => screenshotOf(bySlot(slot, menuItem(`${state}-${end}`))))
            );
            expect(active?.data, `${end} end`).toEqual(inactive?.data);
          }
          // 1px in from the row's start, on the frame a disabled active row draws in place of the fill.
          const [frame, edge] = await Promise.all(
            ROW_STATES.map(async (state) => {
              const button = bySlot("sidebar-menu-button", menuItem(`${state}-icon`));
              const [pixel] = await pixelsAt(button, [[1, button.getBoundingClientRect().height / 2]]);
              return pixel ?? [];
            })
          );
          expect(frame, "frame against a disabled inactive row's edge").not.toEqual(edge);
        },
        { colorScheme }
      );
    }
  );

  it("keeps the active row's fill behind a hovered action", async () => {
    await withForcedColors("active", async () => {
      renderThemed(
        <Frame>
          <StateRowEnds />
        </Frame>
      );
      const action = bySlot("sidebar-menu-action", menuItem("active-icon"));
      await userEvent.hover(action);
      // 4px in from the action's start, beside its icon, where a hover fill would paint.
      const [ground] = await pixelsAt(action, [[4, action.getBoundingClientRect().height / 2]]);
      expect(ground).toEqual(await rowFill(menuItem("active-icon")));
    });
  });

  it("draws the action's focus outline at 3:1 against a small active row's fill, inside the action and with no ring", async () => {
    await withForcedColors("active", async () => {
      // A small row leaves 2px above and below the action, the least of any size.
      renderThemed(
        <Frame>
          <StateRowEnds size="sm" />
        </Frame>
      );
      const active = menuItem("active-icon");
      const fill = await rowFill(active);
      const action = bySlot("sidebar-menu-action", active);
      await focusByKeyboard(action);
      const { ring, outline } = await actionOutlinePixels(action);
      for (const [side, pixel] of outline.entries()) {
        expect(pixelContrast(pixel, fill), `outline, side ${String(side)}`).toBeGreaterThanOrEqual(3);
      }
      // The author focus ring, a box-shadow, would paint flush around the action in its theme color.
      expect(ring, "1px out of the action").toEqual(fill);
    });
  });
});

// Rows announced `aria-disabled="true"`: they keep pointer events so a Tooltip opens, and cancel
// their own activation.
describe("aria-disabled rows", () => {
  describe("aria-disabled Sidebar rows", () => {
    // The rows keep pointer events so a Tooltip still opens, so the row itself cancels
    // activation.
    resetHashAroundEach();

    it("neither follows a MenuButton link nor runs its onClick, and still opens its Tooltip", async () => {
      const clicks: string[] = [];
      renderThemed(
        <Tooltip.Provider delay={0}>
          <Frame provider={{ defaultOpen: false }} root={{ collapsible: "icon" }}>
            <OrdersLink
              href="#orders"
              aria-disabled="true"
              tooltip="Orders"
              onClick={() => clicks.push("orders")}
            />
          </Frame>
        </Tooltip.Provider>
      );
      const link = roleNamed("link", "Orders");

      await userEvent.hover(link);
      await vi.waitFor(() => {
        expect(page.getByRole("tooltip", { name: "Orders", exact: true }).query()).not.toBeNull();
      });

      await expectActivationCanceled(link, clicks);
    });

    it("neither follows a MenuSubButton link nor runs its onClick", async () => {
      const clicks: string[] = [];
      renderThemed(
        <Frame>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton>Billing</Sidebar.MenuButton>
            <Sidebar.MenuSub>
              <Sidebar.MenuSubItem>
                <Sidebar.MenuSubButton
                  href="#invoices"
                  aria-disabled="true"
                  onClick={() => clicks.push("invoices")}>
                  Invoices
                </Sidebar.MenuSubButton>
              </Sidebar.MenuSubItem>
            </Sidebar.MenuSub>
          </Sidebar.MenuItem>
        </Frame>
      );

      await expectActivationCanceled(roleNamed("link", "Invoices"), clicks);
    });

    // A middle-click fires `auxclick`, not `click`, and a link opens in a new tab as that event's
    // default action. The window listener runs after the row's own handler, records whether the
    // row canceled it, then cancels it itself so an unguarded row opens no tab.
    for (const { name, ariaDisabled, prevented, auxClicks } of [
      {
        name: "cancels a middle-click on a link row, so it opens no new tab and skips onAuxClick",
        ariaDisabled: "true",
        prevented: [true],
        auxClicks: [],
      },
      {
        name: "lets a middle-click through and runs onAuxClick once aria-disabled is false",
        ariaDisabled: "false",
        prevented: [false],
        auxClicks: ["orders"],
      },
    ] as const) {
      it(name, async () => {
        const consumerAuxClicks: string[] = [];
        renderThemed(
          <Frame>
            <OrdersLink
              href="#orders"
              aria-disabled={ariaDisabled}
              onAuxClick={() => consumerAuxClicks.push("orders")}
            />
          </Frame>
        );
        const defaultPrevented: boolean[] = [];
        const probe = (event: MouseEvent): void => {
          defaultPrevented.push(event.defaultPrevented);
          event.preventDefault();
        };
        window.addEventListener("auxclick", probe);
        try {
          await userEvent.click(roleNamed("link", "Orders"), { button: "middle", force: true });
        } finally {
          window.removeEventListener("auxclick", probe);
        }

        expect(defaultPrevented).toEqual(prevented);
        expect(consumerAuxClicks).toEqual(auxClicks);
      });
    }

    it("does not run a MenuButton button's onClick", async () => {
      const clicks: string[] = [];
      renderThemed(
        <Frame>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton aria-disabled="true" onClick={() => clicks.push("archive")}>
              Archive
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Frame>
      );

      await expectActivationCanceled(roleNamed("button", "Archive"), clicks);
    });

    it("activates the same rows once aria-disabled is false", async () => {
      const clicks: string[] = [];
      renderThemed(
        <Frame>
          <OrdersLink href="#orders" aria-disabled="false" onClick={() => clicks.push("orders")} />
        </Frame>
      );

      await userEvent.click(roleNamed("link", "Orders"));
      expect(location.hash).toBe("#orders");
      expect(clicks).toEqual(["orders"]);
    });
  });
});

describe("state", () => {
  describe("Sidebar committed state and update queue", () => {
    it("composes controlled notifications once and starts the next event from a rejected prop", async () => {
      const onChange = vi.fn<(open: boolean) => void>();
      renderThemed(
        withLocale(
          "en-US",
          <StrictMode>
            <Sidebar.Provider open onOpenChange={onChange}>
              <QueueControls />
              <Sidebar.Trigger />
            </Sidebar.Provider>
          </StrictMode>
        )
      );
      await userEvent.click(roleNamed("button", "Invert twice"));
      expect(onChange.mock.calls.map(([open]) => open)).toEqual([false, true]);
      expect(roleNamed("status", "Open state").textContent).toBe("true");
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
      expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("queues uncontrolled openMobile updaters across transitions as React's setter does", async () => {
      renderThemed(
        withLocale(
          "en-US",
          <Sidebar.Provider>
            <MobileQueue />
          </Sidebar.Provider>
        )
      );
      await userEvent.click(roleNamed("button", "Invert in two transitions"));
      await expect
        .element(page.getByRole("status", { name: "Mobile open state" }))
        .toHaveTextContent("false");
    });

    it("keeps callbacks stable when the committed controlled setter changes", async () => {
      const identities: Array<ReturnType<typeof useSidebar>> = [];
      const first = vi.fn<(open: boolean) => void>();
      const second = vi.fn<(open: boolean) => void>();
      function Probe() {
        const sidebar = useSidebar();
        useLayoutEffect(() => {
          identities.push(sidebar);
        });
        return <Sidebar.Trigger />;
      }
      const field = (onOpenChange: (open: boolean) => void) =>
        withLocale(
          "en-US",
          <Sidebar.Provider open onOpenChange={onOpenChange}>
            <Probe />
          </Sidebar.Provider>
        );
      const { rerender } = renderThemed(field(first));
      rerender(field(second));
      await userEvent.click(roleNamed("button", "Toggle sidebar"));
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledExactlyOnceWith(false);
      expect(new Set(identities.map((value) => value.setOpen)).size).toBe(1);
      expect(new Set(identities.map((value) => value.toggleSidebar)).size).toBe(1);
    });
  });
});
