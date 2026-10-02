import { useState } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { NavigationMenu } from "./index";

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

function SiteMenu({ className, container }: { className?: string; container?: HTMLElement }) {
  return (
    <NavigationMenu.Root aria-label="Site" className={className} {...(container && { container })}>
      <NavigationMenu.List className="list-extra">
        <NavigationMenu.Item className="item-extra">
          <NavigationMenu.Trigger className="trigger-extra">
            Products
            <NavigationMenu.Indicator className="indicator-extra" />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className="content-extra">
            <NavigationMenu.Link href="#electricity" className="link-extra">
              Electricity
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#about" active>
            About
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

/** Base UI mounts the content a frame or more after the opening event, so wait for it. */
async function openedLink(name: string): Promise<HTMLElement> {
  await expect.element(page.getByRole("link", { name, exact: true })).toBeVisible();
  return roleNamed("link", name);
}

describe("NavigationMenu", () => {
  it("renders a named navigation landmark whose trigger starts collapsed", () => {
    renderThemed(<SiteMenu />);
    expect(roleNamed("navigation", "Site").tagName).toBe("NAV");
    expect(roleNamed("button", "Products").getAttribute("aria-expanded")).toBe("false");
    expect(page.getByRole("link", { name: "Electricity", exact: true }).query()).toBeNull();
  });

  it("opens the content in the popup, portalled into the container outside Root, when the trigger is clicked", async () => {
    function InContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Portal host" />
          {node ? <SiteMenu container={node} /> : null}
        </>
      );
    }
    renderThemed(<InContainer />);
    const trigger = roleNamed("button", "Products");
    await userEvent.click(trigger);
    const link = await openedLink("Electricity");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const controlled = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    expect(controlled?.contains(link)).toBe(true);
    expect(roleNamed("region", "Portal host").contains(controlled)).toBe(true);
    expect(roleNamed("navigation", "Site").contains(controlled)).toBe(false);
  });

  it("keeps an open popup within a viewport that narrows, and scrolls the wider content panel", async () => {
    const initial = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(1024, 768);
    try {
      renderThemed(
        <NavigationMenu.Root aria-label="Wide">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Catalogue</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <div style={{ width: 600 }}>
                  <NavigationMenu.Link href="#wide">Wide</NavigationMenu.Link>
                </div>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      );
      const trigger = roleNamed("button", "Catalogue");
      await userEvent.click(trigger);
      const link = await openedLink("Wide");
      const popup = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
      // DOM audit: the content panel has no role, so the scroll container is found by its slot.
      const content = link.closest("[data-slot='navigation-menu-content']");
      if (!(popup instanceof HTMLElement) || !(content instanceof HTMLElement) || !popup.contains(content)) {
        throw new Error("expected the trigger to control the popup that holds the content panel");
      }

      await page.viewport(360, 768);
      await vi.waitFor(() => {
        const box = popup.getBoundingClientRect();
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
      });
      // A user's wheel gesture scrolls only a scroll container; a panel the viewport merely clips stays at 0.
      await userEvent.wheel(content, { delta: { x: 100 } });
      await vi.waitFor(() => {
        expect(content.scrollLeft).toBeGreaterThan(0);
      });
    } finally {
      await page.viewport(initial.width, initial.height);
    }
  });

  it("opens the content when the pointer hovers the trigger", async () => {
    renderThemed(<SiteMenu />);
    await userEvent.hover(roleNamed("button", "Products"));

    await openedLink("Electricity");
    expect(roleNamed("button", "Products").getAttribute("aria-expanded")).toBe("true");
  });

  it("opens from Enter and from ArrowDown, and Escape from the content closes it and returns focus to the trigger", async () => {
    renderThemed(<SiteMenu />);
    const trigger = roleNamed("button", "Products");

    for (const key of ["{Enter}", "{ArrowDown}"]) {
      trigger.focus();
      await userEvent.keyboard(key);
      const link = await openedLink("Electricity");
      expect(trigger.getAttribute("aria-expanded"), key).toBe("true");

      link.focus();
      await expect.element(page.getByRole("link", { name: "Electricity", exact: true })).toHaveFocus();

      await userEvent.keyboard("{Escape}");
      await vi.waitFor(() => {
        expect(page.getByRole("link", { name: "Electricity", exact: true }).query()).toBeNull();
      });
      expect(trigger.getAttribute("aria-expanded"), key).toBe("false");
      await expect.element(page.getByRole("button", { name: "Products", exact: true })).toHaveFocus();
    }
  });

  it("marks an active link as the current page and leaves other links unmarked", async () => {
    renderThemed(<SiteMenu />);
    expect(roleNamed("link", "About").getAttribute("aria-current")).toBe("page");

    await userEvent.click(roleNamed("button", "Products"));
    expect((await openedLink("Electricity")).hasAttribute("aria-current")).toBe(false);
  });

  it("puts each part's data-slot and the consumer className on the rendered element", async () => {
    renderThemed(<SiteMenu className="root-extra" />);
    const trigger = roleNamed("button", "Products");
    await userEvent.click(trigger);
    const link = await openedLink("Electricity");

    const nav = roleNamed("navigation", "Site");
    const list = page.getByRole("list").element();
    const item = page.getByRole("listitem").first().element();
    // DOM audit: the content panel and the aria-hidden indicator have no role, so their slots are found by data-slot.
    const content = link.closest("[data-slot='navigation-menu-content']");
    const indicator = trigger.querySelector("[data-slot='navigation-menu-indicator']");
    if (
      !(list instanceof HTMLElement) ||
      !(item instanceof HTMLElement) ||
      !(content instanceof HTMLElement) ||
      !(indicator instanceof HTMLElement)
    ) {
      throw new Error("expected the list, its item, the content panel and the indicator");
    }

    const parts: ReadonlyArray<readonly [HTMLElement, string, string]> = [
      [nav, "navigation-menu", "root-extra"],
      [list, "navigation-menu-list", "list-extra"],
      [item, "navigation-menu-item", "item-extra"],
      [trigger, "navigation-menu-trigger", "trigger-extra"],
      [content, "navigation-menu-content", "content-extra"],
      [link, "navigation-menu-link", "link-extra"],
      [indicator, "navigation-menu-indicator", "indicator-extra"],
    ];
    for (const [element, slot, extra] of parts) {
      expect(element.getAttribute("data-slot"), slot).toBe(slot);
      expect(element.classList.contains(extra), `${slot} keeps ${extra}`).toBe(true);
    }
  });

  it("evaluates a className callback against the part's state", () => {
    renderThemed(
      <NavigationMenu.Root aria-label="Site">
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="#about" active className={({ active }) => (active ? "is-active" : "")}>
              About
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    );
    const link = roleNamed("link", "About");
    expect(link.classList.contains("is-active")).toBe(true);
    expect(link.getAttribute("data-slot")).toBe("navigation-menu-link");
  });
});

describe("NavigationMenu trigger density metrics", () => {
  function measure(name: string) {
    const style = getComputedStyle(roleNamed("button", name));
    return { height: px(style.height), px: px(style.paddingInlineStart) };
  }

  function Single({ label }: { label: string }) {
    return (
      <NavigationMenu.Root aria-label={`${label} menu`}>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>{label}</NavigationMenu.Trigger>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    );
  }

  it("resolves the md control rung at both density stamps", () => {
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      renderThemed(<Single label={`md ${density}`} />);

      const box = measure(`md ${density}`);
      expect(box.height, `${density} md height`).toBe(CONTROL_MD[density].height);
      expect(box.px, `${density} md padding`).toBe(CONTROL_MD[density].px);
    }
  });

  it("renders a link in the bar at the trigger's md box at both density stamps", () => {
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      renderThemed(
        <NavigationMenu.Root aria-label={`${density} links`}>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>{`trigger ${density}`}</NavigationMenu.Trigger>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#bar">{`bar ${density}`}</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      );

      // The rendered box: without preflight a content-box `height` excludes the padding.
      const link = roleNamed("link", `bar ${density}`);
      const trigger = roleNamed("button", `trigger ${density}`);
      expect(link.getBoundingClientRect().height, `${density} link box`).toBe(CONTROL_MD[density].height);
      expect(trigger.getBoundingClientRect().height, `${density} trigger box`).toBe(
        CONTROL_MD[density].height
      );
      expect(px(getComputedStyle(link).paddingInlineStart), `${density} link padding`).toBe(
        CONTROL_MD[density].px
      );
    }
  });

  it("does not rescope metrics from a nested data-density or ThemeScope variant change", () => {
    stampDensity("dense");
    renderThemed(
      <div data-density="comfortable">
        <Single label="nested" />
      </div>
    );
    expect(measure("nested").height).toBe(CONTROL_MD.dense.height);

    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <Single label="scoped" />
      </ThemeScope>
    );
    expect(measure("scoped").height).toBe(CONTROL_MD.dense.height);
  });
});
