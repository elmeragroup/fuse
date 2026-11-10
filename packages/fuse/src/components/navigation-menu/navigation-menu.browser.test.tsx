import { useState } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the dark highlight test reads them.
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { panelControlledBy } from "../../../test/panel-transition";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import {
  computedContrast,
  computedOklch,
  fkasBranded,
  renderThemed,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
  textNamed,
} from "../../../test/themed-browser-render";
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

    const controlled = panelControlledBy(trigger);
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
      const popup = panelControlledBy(trigger);
      // The content panel has no role, so the scroll container is found by its slot.
      const content = link.closest("[data-slot='navigation-menu-content']");
      if (popup === null || !(content instanceof HTMLElement) || !popup.contains(content)) {
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

describe("nested NavigationMenu", () => {
  // The contracts here are placement, swapping, focus and paint. Without the popup's resize and
  // the positioner's glide, a row inside the popup is still when it is clicked or hovered, so
  // no step waits for the motion to finish. The opacity and colour transitions stay on.
  beforeEach(async () => {
    await emulateReducedMotion("reduce");
  });

  afterEach(async () => {
    await emulateReducedMotion("no-preference");
  });

  function NestedMenu() {
    return (
      <NavigationMenu.Root aria-label="Site">
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#electricity">Electricity</NavigationMenu.Link>
              <NavigationMenu.Root orientation="vertical" side="right" align="end">
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Trigger>Business</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#contracts">Power contracts</NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    );
  }

  it("opens a side='right' submenu in its own popup to the right of its trigger while the outer popup stays open", async () => {
    renderThemed(<NestedMenu />);
    const outerTrigger = roleNamed("button", "Products");
    await userEvent.click(outerTrigger);
    await openedLink("Electricity");

    // The nested Root renders a <div>, so the page keeps one named navigation landmark.
    // A nested Root has no role of its own, so it is found by its slot.
    const nestedRoot = roleNamed("button", "Business").closest("[data-slot='navigation-menu']");
    expect(nestedRoot?.tagName).toBe("DIV");
    expect(page.getByRole("navigation", { name: "Site", exact: true }).all()).toHaveLength(1);

    const nestedTrigger = roleNamed("button", "Business");
    await userEvent.click(nestedTrigger);
    const nestedLink = await openedLink("Power contracts");

    const nestedPopup = panelControlledBy(nestedTrigger);
    const outerPopup = panelControlledBy(outerTrigger);
    if (nestedPopup === null || outerPopup === null) {
      throw new Error("expected each open trigger to control a popup");
    }
    expect(nestedPopup).not.toBe(outerPopup);
    expect(nestedPopup.contains(nestedLink)).toBe(true);
    expect(outerPopup.contains(nestedLink)).toBe(false);
    await vi.waitFor(() => {
      expect(nestedPopup.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        nestedTrigger.getBoundingClientRect().right
      );
    });
    expect(outerTrigger.getAttribute("aria-expanded")).toBe("true");
    await expect.element(page.getByRole("link", { name: "Electricity", exact: true })).toBeVisible();
  });

  it("holds muted descriptions in a hovered link row and an open vertical trigger to 4.5:1 on the row's accent", async () => {
    renderThemed(
      <NavigationMenu.Root aria-label="Site">
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#spot">
                Spot price <span className="text-muted-foreground">Follow the hourly market price.</span>
              </NavigationMenu.Link>
              <NavigationMenu.Root orientation="vertical" side="right">
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Trigger>
                      Electric car <span className="text-muted-foreground">Charging at home and away.</span>
                    </NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#charging">Home charger</NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    );
    await userEvent.click(roleNamed("button", "Products"));
    const spot = await openedLink("Spot price Follow the hourly market price.");
    await userEvent.hover(spot);
    await vi.waitFor(() => {
      expect(
        computedContrast(
          getComputedStyle(textNamed("Follow the hourly market price.")).color,
          getComputedStyle(spot).backgroundColor
        )
      ).toBeGreaterThanOrEqual(4.5);
    });

    const car = roleNamed("button", "Electric car Charging at home and away.");
    await userEvent.click(car);
    // Move off the trigger so its hover recolour cannot stand in for the open-state one.
    await userEvent.hover(await openedLink("Home charger"));
    expect(car.hasAttribute("data-popup-open")).toBe(true);
    expect(car.matches(":hover")).toBe(false);
    await vi.waitFor(() => {
      expect(
        computedContrast(
          getComputedStyle(textNamed("Charging at home and away.")).color,
          getComputedStyle(car).backgroundColor
        )
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  function InlineMenu() {
    return (
      <NavigationMenu.Root aria-label="Site">
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Audiences</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Root orientation="vertical" inline defaultValue="homes">
                <NavigationMenu.List>
                  <NavigationMenu.Item value="homes">
                    <NavigationMenu.Trigger>Homes</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                  <NavigationMenu.Item value="businesses">
                    <NavigationMenu.Trigger>Businesses</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#fixed">Fixed price</NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
                <NavigationMenu.Viewport className="viewport-extra" />
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    );
  }

  it("shows an inline Root's default content inside the Viewport placed in the outer content, and swaps it on a click", async () => {
    renderThemed(<InlineMenu />);
    const outerTrigger = roleNamed("button", "Audiences");
    await userEvent.click(outerTrigger);
    const spot = await openedLink("Spot price");

    const outerPopup = panelControlledBy(outerTrigger);
    // The content panel and the viewport have no role, so they are found by their slots.
    const viewport = spot.closest("[data-slot='navigation-menu-viewport']");
    const outerContent = viewport?.parentElement?.closest("[data-slot='navigation-menu-content']");
    if (outerPopup === null || !(viewport instanceof HTMLElement) || !(outerContent instanceof HTMLElement)) {
      throw new Error("expected the default content inside a viewport inside the outer content's popup");
    }
    expect(outerPopup.contains(outerContent)).toBe(true);
    expect(viewport.classList.contains("viewport-extra")).toBe(true);
    expect(roleNamed("button", "Homes").getAttribute("aria-expanded")).toBe("true");
    // The only landmarks are the Site root and the outer popup Base UI renders as a <nav>.
    for (const landmark of page.getByRole("navigation").elements()) {
      expect([roleNamed("navigation", "Site"), outerPopup]).toContain(landmark);
    }
    // An inline trigger's content is already beside its list, so it renders no caret.
    expect(roleNamed("button", "Homes").querySelector("svg")).toBeNull();
    expect(outerTrigger.querySelector("svg")).not.toBeNull();

    await userEvent.click(roleNamed("button", "Businesses"));
    const fixed = await openedLink("Fixed price");
    expect(viewport.contains(fixed)).toBe(true);
    await vi.waitFor(() => {
      expect(page.getByRole("link", { name: "Spot price", exact: true }).query()).toBeNull();
    });
  });

  it("moves focus down an inline list with ArrowDown without swapping, and swaps the content on Enter or Space", async () => {
    renderThemed(<InlineMenu />);
    await userEvent.click(roleNamed("button", "Audiences"));
    await openedLink("Spot price");

    roleNamed("button", "Homes").focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect.element(page.getByRole("button", { name: "Businesses", exact: true })).toHaveFocus();
    expect(roleNamed("button", "Businesses").getAttribute("aria-expanded")).toBe("false");
    await expect.element(page.getByRole("link", { name: "Spot price", exact: true })).toBeVisible();

    await userEvent.keyboard("{Enter}");
    await openedLink("Fixed price");
    await vi.waitFor(() => {
      expect(page.getByRole("link", { name: "Spot price", exact: true }).query()).toBeNull();
    });

    await userEvent.keyboard("{ArrowUp}");
    await expect.element(page.getByRole("button", { name: "Homes", exact: true })).toHaveFocus();
    await userEvent.keyboard(" ");
    await openedLink("Spot price");
  });

  describe("in branded fkas dark, whose primary-soft is its popover", () => {
    let restoreDocumentTheme: () => void;

    beforeEach(() => {
      restoreDocumentTheme = snapshotDocumentTheme();
      stampDocumentTheme(fkasBranded, "dark");
    });

    afterEach(() => {
      restoreDocumentTheme();
    });

    it("paints an open inline row and a hovered link row in a color the popup does not have", async () => {
      // The document carries the theme, so the portalled popup takes it with the bar.
      render(<InlineMenu />);
      const outerTrigger = roleNamed("button", "Audiences");
      await userEvent.click(outerTrigger);
      const spot = await openedLink("Spot price");
      const popup = panelControlledBy(outerTrigger);
      if (popup === null) {
        throw new Error("expected the Audiences popup");
      }
      const popupColor = getComputedStyle(popup).backgroundColor;
      // An opaque surface, so a row color that differs from it is one the user can see.
      expect(computedOklch(popupColor).l).toBeGreaterThan(0);

      // `computedOklch` throws on anything but an opaque oklch() color, so a transparent row,
      // which would show the popup through it, fails before the comparison.
      const openRow = getComputedStyle(roleNamed("button", "Homes")).backgroundColor;
      expect(computedOklch(openRow)).not.toEqual(computedOklch(popupColor));
      await userEvent.hover(spot);
      await vi.waitFor(() => {
        expect(computedOklch(getComputedStyle(spot).backgroundColor)).not.toEqual(computedOklch(popupColor));
      });
    });
  });
});
