import type { ComponentProps, ReactElement } from "react";
import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertFocusRingOnKeyboardAbsentOnMouse,
  assertKeyboardFocusRingAtBothDensities,
} from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import {
  ContextProbe,
  DESKTOP,
  Frame,
  MOBILE,
  OrdersLink,
  bySlot,
  captureCookieWrites,
  emulateReducedMotion,
  layoutChildren,
  menuList,
  railNamed,
  setupSidebarBrowser,
  sidebarRoot,
} from "../../../test/sidebar-browser-fixtures";
import { DESCRIPTION_COPY, SLOT_ROSTER, TITLE_COPY, TOGGLE_COPY } from "../../../test/sidebar-contract";
import {
  CONTROL_MD,
  CONTROL_SM,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { Tooltip } from "../tooltip";
import { Sidebar } from "./index";
import type { SidebarContextValue } from "./sidebar";

setupSidebarBrowser();

describe("Sidebar toggle paths", () => {
  it("toggles data-state from cmd+B and ctrl+B and prevents the browser default", async () => {
    renderThemed(<Frame />);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");

    await userEvent.keyboard("{Meta>}b{/Meta}");
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    expect(sidebarRoot().getAttribute("data-collapsible")).toBe("offcanvas");

    await userEvent.keyboard("{Control>}b{/Control}");
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    expect(sidebarRoot().getAttribute("data-collapsible")).toBe("");

    const event = new KeyboardEvent("keydown", { key: "b", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const plain = new KeyboardEvent("keydown", { key: "b", cancelable: true });
    window.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
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
          </Sidebar.Inset>
        </Sidebar.Provider>
      )
    );
    const trigger = roleNamed("button", "Toggle sidebar");
    expect(trigger.getAttribute("data-slot")).toBe("sidebar-trigger");
    expect(trigger.getAttribute("aria-label")).toBe("Toggle sidebar");
    expect(trigger.querySelector(".sr-only")?.textContent).toBe("Toggle sidebar");
    expect(trigger.querySelector("svg")).not.toBeNull();

    await userEvent.click(trigger);
    expect(order).toEqual(["onClick", "toggle"]);
  });

  it("toggles from the Rail, which is a mouse-only affordance with a localized name", async () => {
    renderThemed(<Frame />);
    const rail = railNamed("Toggle sidebar");
    expect(rail.getAttribute("title")).toBe("Toggle sidebar");
    expect(rail.tabIndex).toBe(-1);
    expect(rail.getAttribute("aria-hidden")).toBe("true");
    expect(page.getByRole("button", { name: "Toggle sidebar", exact: true }).elements()).toHaveLength(1);

    await userEvent.click(rail);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    await userEvent.click(rail);
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
  });
});

describe("Sidebar callback stability", () => {
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

  it("does not re-render a MenuButton when the rail toggles", async () => {
    let renders = 0;
    function CountedHost(props: ComponentProps<"button">): ReactElement {
      // oxlint-disable-next-line react/globals -- render counter read synchronously after render()
      renders += 1;
      return <button type="button" {...props} />;
    }

    renderThemed(
      <Frame>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton render={<CountedHost />}>Plain</Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Frame>
    );
    const afterMount = renders;
    expect(afterMount).toBeGreaterThan(0);

    await userEvent.click(roleNamed("button", TOGGLE_COPY["en-US"]));
    expect(sidebarRoot().getAttribute("data-state"), "the rail really toggled").toBe("collapsed");
    expect(renders, "menu button render count is unchanged by the toggle").toBe(afterMount);

    await userEvent.click(roleNamed("button", TOGGLE_COPY["en-US"]));
    expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    expect(renders).toBe(afterMount);
  });
});

describe("Sidebar locale copy", () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`labels the Trigger and Rail from the ${locale} dictionary`, () => {
      renderThemed(<Frame locale={locale} />);
      expect(roleNamed("button", TOGGLE_COPY[locale]).getAttribute("data-slot")).toBe("sidebar-trigger");
      expect(railNamed(TOGGLE_COPY[locale]).getAttribute("title")).toBe(TOGGLE_COPY[locale]);
    });

    it(`titles and describes the mobile Sheet from the ${locale} dictionary`, async () => {
      await page.viewport(MOBILE.width, MOBILE.height);
      renderThemed(<Frame locale={locale} />);
      await userEvent.click(roleNamed("button", TOGGLE_COPY[locale]));
      await expect.element(page.getByRole("dialog", { name: TITLE_COPY[locale] })).toBeVisible();
      const dialog = roleNamed("dialog", TITLE_COPY[locale]);
      const description = page.getByText(DESCRIPTION_COPY[locale], { exact: true }).element();
      expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
    });
  }

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

describe("Sidebar controlled and uncontrolled state", () => {
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

  it("accepts a boolean and an updater in setOpen", async () => {
    let latest: SidebarContextValue | undefined;
    renderThemed(
      <Frame
        probe={
          <ContextProbe
            onValue={(value) => {
              latest = value;
            }}
          />
        }
      />
    );
    expect(latest?.open).toBe(true);

    latest?.setOpen(false);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    });

    latest?.setOpen((open) => !open);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
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

describe("Sidebar density exemption", () => {
  it("keeps the menu-button ladder and Sidebar.Input height identical at both density stamps", () => {
    const heights: Record<string, number[]> = {};
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const { unmount } = renderThemed(
        withLocale(
          "en-US",
          <Sidebar.Provider>
            <Sidebar.Root>
              <Sidebar.Header>
                <Sidebar.Input aria-label="Search" />
              </Sidebar.Header>
              <Sidebar.Content>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>Default row</Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton size="sm">Small row</Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton size="lg">Large row</Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.Content>
            </Sidebar.Root>
          </Sidebar.Provider>
        )
      );
      heights[density] = [
        px(getComputedStyle(roleNamed("button", "Default row")).height),
        px(getComputedStyle(roleNamed("button", "Small row")).height),
        px(getComputedStyle(roleNamed("button", "Large row")).height),
        px(getComputedStyle(textboxNamed("Search")).height),
      ];
      unmount();
    }
    expect(heights.dense).toEqual([32, 28, 48, 32]);
    expect(heights.comfortable).toEqual(heights.dense);
  });
});

describe("Sidebar.Input focus ring", () => {
  it("paints the shared ring on keyboard focus-visible at both densities", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider>
          <Sidebar.Root>
            <Sidebar.Header>
              <button type="button">Before</button>
              <Sidebar.Input aria-label="Search" />
            </Sidebar.Header>
          </Sidebar.Root>
        </Sidebar.Provider>
      )
    );
    await assertKeyboardFocusRingAtBothDensities(roleNamed("button", "Before"), textboxNamed("Search"));
  });
});

describe("Sidebar group and menu action targets", () => {
  it("keeps a bounding box of at least 24px at a desktop viewport", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider>
          <Sidebar.Root>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Funnel</Sidebar.GroupLabel>
              <Sidebar.GroupAction aria-label="Add">+</Sidebar.GroupAction>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
                    <Sidebar.MenuAction aria-label="More">+</Sidebar.MenuAction>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Root>
        </Sidebar.Provider>
      )
    );
    for (const name of ["Add", "More"] as const) {
      const box = roleNamed("button", name).getBoundingClientRect();
      expect(box.width, name).toBeGreaterThanOrEqual(24);
      expect(box.height, name).toBeGreaterThanOrEqual(24);
    }
  });
});

describe("Sidebar sanctioned motion", () => {
  it("animates only shell width, and strips that property under prefers-reduced-motion", async () => {
    renderThemed(<Frame />);
    const [gap, container] = layoutChildren(sidebarRoot());
    if (!(gap instanceof HTMLElement) || !(container instanceof HTMLElement)) {
      throw new Error("expected gap and container");
    }
    expect(
      getComputedStyle(gap)
        .transitionProperty.split(",")
        .map((part) => part.trim())
    ).toEqual(["width"]);
    expect(
      getComputedStyle(container)
        .transitionProperty.split(",")
        .map((part) => part.trim())
    ).toEqual(["width"]);
    expect(getComputedStyle(gap).transitionDuration).toBe("0.2s");
    expect(getComputedStyle(container).transitionDuration).toBe("0.2s");

    await emulateReducedMotion("reduce");
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    for (const element of [gap, container]) {
      const properties = getComputedStyle(element).transitionProperty;
      expect(properties, element.getAttribute("data-slot") ?? "shell").not.toMatch(
        /\b(?:width|left|right)\b/
      );
    }
  });
});

describe("Sidebar.MenuButton tooltip", () => {
  function TooltipFrame({ defaultOpen, tooltip }: { defaultOpen: boolean; tooltip: "string" | "object" }) {
    return (
      <Tooltip.Provider delay={0}>
        <Frame provider={{ defaultOpen }} root={{ collapsible: "icon" }}>
          <OrdersLink tooltip={tooltip === "string" ? "Orders" : { children: "Orders", sideOffset: 12 }} />
        </Frame>
      </Tooltip.Provider>
    );
  }

  it("renders no tooltip while expanded", async () => {
    renderThemed(<TooltipFrame defaultOpen tooltip="string" />);
    const link = roleNamed("link", "Orders");
    await userEvent.hover(link);
    await vi.waitFor(() => {
      expect(link.matches(":hover")).toBe(true);
    });
    await vi.waitFor(() => {
      expect(
        link.hasAttribute("data-popup-open"),
        "the hover opens the root; only the content is withheld"
      ).toBe(true);
    });
    expect(page.getByRole("tooltip", { name: "Orders", exact: true }).query()).toBeNull();
  });

  for (const form of ["string", "object"] as const) {
    it(`reveals the ${form} tooltip to the right when collapsed, on the very same element as the button`, async () => {
      renderThemed(<TooltipFrame defaultOpen={false} tooltip={form} />);
      expect(sidebarRoot().getAttribute("data-collapsible")).toBe("icon");
      const link = roleNamed("link", "Orders");
      expect(link.getAttribute("data-slot")).toBe("sidebar-menu-button");
      expect(link.getAttribute("href")).toBe("/orders");

      await userEvent.hover(link);
      await vi.waitFor(() => {
        expect(page.getByRole("tooltip", { name: "Orders", exact: true }).query()).not.toBeNull();
      });
      const tooltip = roleNamed("tooltip", "Orders");
      expect(tooltip.getAttribute("data-side")).toBe("right");
      expect(link.getAttribute("aria-describedby")).toBe(tooltip.id);
      expect(page.getByRole("link", { name: "Orders", exact: true }).elements()).toHaveLength(1);
    });
  }
});

describe("Sidebar.Root branches", () => {
  it("collapsible=none renders a static peer with state attributes, a forwarded ref, and no dialog", async () => {
    const rootRef = createRef<HTMLDivElement>();
    renderThemed(<Frame root={{ collapsible: "none", variant: "inset", side: "right", ref: rootRef }} />);
    const root = sidebarRoot();
    // DOM audit: the caller's ref reaches the static branch's `sidebar` slot.
    expect(rootRef.current?.dataset.slot, "the caller's ref reaches the static branch's div").toBe("sidebar");
    expect(root.getAttribute("data-state")).toBe("expanded");
    expect(root.getAttribute("data-variant")).toBe("inset");
    expect(root.getAttribute("data-side")).toBe("right");
    expect(root.hasAttribute("data-collapsible")).toBe(false);
    expect(root.classList.contains("peer")).toBe(true);
    expect(root.classList.contains("group")).toBe(true);
    expect(
      layoutChildren(root).some(
        (child) =>
          child.childElementCount === 0 && getComputedStyle(child).transitionProperty.includes("width")
      )
    ).toBe(false);
    expect(page.getByRole("dialog").query()).toBeNull();

    await page.viewport(MOBILE.width, MOBILE.height);
    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("emits the desktop gap, container and inner layout with variant and side attributes", () => {
    renderThemed(<Frame root={{ variant: "floating", side: "right", className: "shell" }} />);
    const root = sidebarRoot();
    expect(root.getAttribute("data-variant")).toBe("floating");
    expect(root.getAttribute("data-side")).toBe("right");
    expect(root.getAttribute("data-collapsible")).toBe("");
    const [gap, container] = layoutChildren(root);
    expect(gap).toBeInstanceOf(HTMLElement);
    if (!(container instanceof HTMLElement)) {
      throw new Error("expected sidebar container");
    }
    expect(container.getAttribute("data-side")).toBe("right");
    expect(container.classList.contains("shell")).toBe(true);
    expect(getComputedStyle(container).position).toBe("fixed");
    expect(px(getComputedStyle(container).width)).toBe(256);
    expect(container.firstElementChild).toBeInstanceOf(HTMLElement);
  });

  it("renders the mobile Sheet branch below 768px with the caller className on the dialog", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    let latest: SidebarContextValue | undefined;
    renderThemed(
      <Frame
        root={{ className: "mobile-shell" }}
        probe={
          <ContextProbe
            onValue={(value) => {
              latest = value;
            }}
          />
        }>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Frame>
    );
    await vi.waitFor(() => {
      expect(latest?.isMobile).toBe(true);
    });
    expect(page.getByRole("dialog").query()).toBeNull();

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    await expect.element(page.getByRole("dialog", { name: "Sidebar" })).toBeVisible();
    const dialog = roleNamed("dialog", "Sidebar");
    expect(dialog.getAttribute("data-slot")).toBe("sidebar");
    expect(dialog.getAttribute("data-mobile")).toBe("true");
    expect(dialog.getAttribute("data-side")).toBe("left");
    expect(dialog.classList.contains("mobile-shell")).toBe(true);
    expect(dialog.style.getPropertyValue("--sidebar-width")).toBe("18rem");
    const close = page.getByRole("button", { name: "Close", exact: true }).element();
    if (!(close instanceof HTMLElement)) {
      throw new Error("expected the mobile close button");
    }
    await expect.element(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    // The close sits in a normal-flow header row, not absolute over the panel content.
    expect(getComputedStyle(close).position).not.toBe("absolute");
    expect(page.getByRole("button", { name: "Orders", exact: true }).query()).not.toBeNull();
    expect(latest?.openMobile).toBe(true);

    await userEvent.click(roleNamed("button", "Close"));
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(roleNamed("button", "Toggle sidebar"));
    expect(document.cookie).not.toContain("sidebar:state");
  });
});

describe("Sidebar.MenuButton", () => {
  it("emits data-active, data-size and the recipe classes, and positions actions and badges by size", () => {
    renderThemed(
      <Frame>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton isActive variant="outline">
            Active
          </Sidebar.MenuButton>
          <Sidebar.MenuAction aria-label="Default action">+</Sidebar.MenuAction>
          <Sidebar.MenuBadge>3</Sidebar.MenuBadge>
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="lg">Large</Sidebar.MenuButton>
          <Sidebar.MenuAction aria-label="Large action">+</Sidebar.MenuAction>
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm">Small</Sidebar.MenuButton>
          <Sidebar.MenuAction aria-label="Small action">+</Sidebar.MenuAction>
        </Sidebar.MenuItem>
      </Frame>
    );
    const active = roleNamed("button", "Active");
    expect(active.getAttribute("data-active")).toBe("");
    expect(active.getAttribute("data-size")).toBe("default");
    expect(active.getAttribute("data-slot")).toBe("sidebar-menu-button");
    expect(active.classList.contains("bg-background")).toBe(true);
    expect(getComputedStyle(active).fontWeight).toBe("500");
    expect(roleNamed("button", "Large").getAttribute("data-size")).toBe("lg");
    expect(roleNamed("button", "Small").getAttribute("data-size")).toBe("sm");
    expect(roleNamed("button", "Large").hasAttribute("data-active")).toBe(false);

    expect(px(getComputedStyle(roleNamed("button", "Default action")).top)).toBe(6);
    expect(px(getComputedStyle(roleNamed("button", "Large action")).top)).toBe(10);
    expect(px(getComputedStyle(roleNamed("button", "Small action")).top)).toBe(4);
    const badge = page.getByText("3", { exact: true }).element();
    if (!(badge instanceof HTMLElement)) {
      throw new Error("expected a menu badge");
    }
    expect(px(getComputedStyle(badge).top)).toBe(6);
    expect(getComputedStyle(badge).pointerEvents).toBe("none");
    expect(px(getComputedStyle(active).paddingRight), "pr-8 while a MenuAction is present").toBe(32);
  });

  it("threads render polymorphism: an anchor keeps its href and the button's state attributes", () => {
    renderThemed(
      <Frame>
        <OrdersLink isActive />
      </Frame>
    );
    const link = roleNamed("link", "Orders");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/orders");
    expect(link.getAttribute("data-slot")).toBe("sidebar-menu-button");
    expect(link.getAttribute("data-active")).toBe("");
    expect(link.getAttribute("data-size")).toBe("default");
  });

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

describe("Sidebar.MenuAction showOnHover", () => {
  it("is transparent at md until the item is hovered, focused within, or the action is expanded", async () => {
    renderThemed(
      <Frame>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
          <Sidebar.MenuAction showOnHover aria-label="Orders actions">
            +
          </Sidebar.MenuAction>
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>Reports</Sidebar.MenuButton>
          <Sidebar.MenuAction showOnHover aria-expanded aria-label="Reports actions">
            +
          </Sidebar.MenuAction>
        </Sidebar.MenuItem>
      </Frame>
    );
    const action = roleNamed("button", "Orders actions");
    expect(getComputedStyle(action).opacity).toBe("0");
    expect(
      getComputedStyle(roleNamed("button", "Reports actions")).opacity,
      "aria-expanded keeps it visible"
    ).toBe("1");

    await userEvent.hover(roleNamed("button", "Orders"));
    await vi.waitFor(() => {
      expect(getComputedStyle(action).opacity, "hovered item").toBe("1");
    });

    await userEvent.hover(roleNamed("button", "After"));
    await vi.waitFor(() => {
      expect(getComputedStyle(action).opacity, "pointer left the item").toBe("0");
    });

    roleNamed("button", "Orders").focus();
    await vi.waitFor(() => {
      expect(getComputedStyle(action).opacity, "focus within the item").toBe("1");
    });
  });
});

describe("Sidebar.MenuSkeleton", () => {
  function SkeletonRows() {
    return (
      <Frame>
        <Sidebar.MenuItem>
          <Sidebar.MenuSkeleton />
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuSkeleton showIcon />
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuSkeleton />
        </Sidebar.MenuItem>
      </Frame>
    );
  }

  it("renders identical DOM across mounts and varies the bar width by row position", () => {
    const first = renderThemed(<SkeletonRows />);
    const firstHtml = menuList().innerHTML;
    const bars = page
      .getByRole("listitem")
      .elements()
      .flatMap((item) =>
        [...item.querySelectorAll("[aria-hidden='true']")].filter(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && getComputedStyle(node).maxWidth !== "none"
        )
      );
    const widths = bars.map((bar) => getComputedStyle(bar).maxWidth);
    first.unmount();
    renderThemed(<SkeletonRows />);
    expect(menuList().innerHTML).toBe(firstHtml);

    expect(widths).toHaveLength(3);
    expect(new Set(widths).size).toBe(3);
    for (const width of widths) {
      expect(width.endsWith("%") || width.endsWith("px")).toBe(true);
    }
    const icons = page
      .getByRole("listitem")
      .elements()
      .flatMap((item) =>
        [...item.querySelectorAll("[aria-hidden='true']")].filter(
          (node): node is HTMLElement =>
            node instanceof HTMLElement && getComputedStyle(node).maxWidth === "none"
        )
      );
    expect(icons).toHaveLength(1);
    expect(firstHtml).not.toContain('style="');
  });
});

describe("Sidebar.MenuSubButton", () => {
  it("defaults to an anchor and emits size and active attributes", () => {
    renderThemed(
      <Frame>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
          <Sidebar.MenuSub>
            <Sidebar.MenuSubItem>
              <Sidebar.MenuSubButton href="/orders/open" isActive>
                <span>Open</span>
              </Sidebar.MenuSubButton>
            </Sidebar.MenuSubItem>
            <Sidebar.MenuSubItem>
              <Sidebar.MenuSubButton href="/orders/closed" size="sm">
                <span>Closed</span>
              </Sidebar.MenuSubButton>
            </Sidebar.MenuSubItem>
          </Sidebar.MenuSub>
        </Sidebar.MenuItem>
      </Frame>
    );
    const open = roleNamed("link", "Open");
    expect(open.tagName).toBe("A");
    expect(open.getAttribute("data-slot")).toBe("sidebar-menu-sub-button");
    expect(open.getAttribute("data-size")).toBe("md");
    expect(open.getAttribute("data-active")).toBe("");
    const closed = roleNamed("link", "Closed");
    expect(closed.getAttribute("data-size")).toBe("sm");
    expect(closed.hasAttribute("data-active")).toBe(false);
    expect(open.closest("ul")?.tagName).toBe("UL");
    expect(open.closest("li")?.tagName).toBe("LI");
  });

  it("reads the signed sm/md control rungs at both density stamps", () => {
    const heights: Record<string, number[]> = {};
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const { unmount } = renderThemed(
        <Frame>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
            <Sidebar.MenuSub>
              <Sidebar.MenuSubItem>
                <Sidebar.MenuSubButton href="/orders/open">
                  <span>Open</span>
                </Sidebar.MenuSubButton>
              </Sidebar.MenuSubItem>
              <Sidebar.MenuSubItem>
                <Sidebar.MenuSubButton href="/orders/closed" size="sm">
                  <span>Closed</span>
                </Sidebar.MenuSubButton>
              </Sidebar.MenuSubItem>
            </Sidebar.MenuSub>
          </Sidebar.MenuItem>
        </Frame>
      );
      heights[density] = [
        px(getComputedStyle(roleNamed("link", "Open")).height),
        px(getComputedStyle(roleNamed("link", "Closed")).height),
      ];
      unmount();
    }
    expect(heights.dense).toEqual([CONTROL_MD.dense.height, CONTROL_SM.dense.height]);
    expect(heights.comfortable).toEqual([CONTROL_MD.comfortable.height, CONTROL_SM.comfortable.height]);
  });
});

/** DOM audit: the roster audit counts slot stamps directly; every part stamps its slot and no legacy `data-sidebar` survives. */
function countMatching(selector: string): number {
  return document.querySelectorAll(selector).length;
}

describe("Sidebar data-slot audit", () => {
  it("stamps every roster slot once composed, with no legacy data-sidebar attribute anywhere", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider>
          <Sidebar.Root>
            <Sidebar.Header>
              <Sidebar.Input aria-label="Search" />
            </Sidebar.Header>
            <Sidebar.Separator />
            <Sidebar.Content>
              <Sidebar.Group>
                <Sidebar.GroupLabel>Funnel</Sidebar.GroupLabel>
                <Sidebar.GroupAction aria-label="Add">+</Sidebar.GroupAction>
                <Sidebar.GroupContent>
                  <Sidebar.Menu>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton>Orders</Sidebar.MenuButton>
                      <Sidebar.MenuAction aria-label="More">+</Sidebar.MenuAction>
                      <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                      <Sidebar.MenuSub>
                        <Sidebar.MenuSubItem>
                          <Sidebar.MenuSubButton href="/open">Open</Sidebar.MenuSubButton>
                        </Sidebar.MenuSubItem>
                      </Sidebar.MenuSub>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuSkeleton showIcon />
                    </Sidebar.MenuItem>
                  </Sidebar.Menu>
                </Sidebar.GroupContent>
              </Sidebar.Group>
            </Sidebar.Content>
            <Sidebar.Footer>
              <Sidebar.Icon>
                <svg aria-hidden="true" />
              </Sidebar.Icon>
            </Sidebar.Footer>
            <Sidebar.Rail />
          </Sidebar.Root>
          <Sidebar.Inset>
            <Sidebar.Trigger />
          </Sidebar.Inset>
        </Sidebar.Provider>
      )
    );
    for (const slot of SLOT_ROSTER) {
      expect(countMatching(`[data-slot="${slot}"]`), slot).toBeGreaterThanOrEqual(1);
    }
    expect(countMatching("[data-sidebar]")).toBe(0);
    expect(bySlot("sidebar-separator").getAttribute("role")).toBe("separator");
    expect(countMatching('[data-slot="separator"]'), "sidebar parts never reuse the bare slot names").toBe(0);
    expect(countMatching('[data-slot="input"]')).toBe(0);
    expect(bySlot("sidebar-inset").tagName).toBe("MAIN");
    expect(bySlot("sidebar-menu").tagName).toBe("UL");
    expect(bySlot("sidebar-menu-item").tagName).toBe("LI");
    expect(bySlot("sidebar-wrapper").style.getPropertyValue("--sidebar-width")).toBe("16rem");
    expect(bySlot("sidebar-wrapper").style.getPropertyValue("--sidebar-width-icon")).toBe("3rem");
  });
});

describe("useSidebar().isMobile", () => {
  it("is false at and above 768px, true below, follows viewport changes, and starts false", async () => {
    const seen: boolean[] = [];
    await page.viewport(768, 800);
    renderThemed(
      <Frame
        probe={
          <ContextProbe
            onValue={(value) => {
              seen.push(value.isMobile);
            }}
          />
        }
      />
    );
    expect(seen[0]).toBe(false);
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe(false);
    });

    await page.viewport(767, 800);
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe(true);
    });

    await page.viewport(DESKTOP.width, DESKTOP.height);
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe(false);
    });
  });
});
