import { useState } from "react";

// The root entry, which the browser projects pre-bundle; a new subpath would load a second React.
import { DirectionProvider } from "@base-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { panelControlledBy } from "../../../test/panel-transition";
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

describe("nested NavigationMenu", () => {
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

  it("renders the nested Root as a <div>, so the page keeps one named navigation landmark", async () => {
    renderThemed(<NestedMenu />);
    await userEvent.click(roleNamed("button", "Products"));
    await openedLink("Electricity");

    // DOM audit: a nested Root has no role of its own, so it is found by its slot.
    const nestedRoot = roleNamed("button", "Business").closest("[data-slot='navigation-menu']");
    expect(nestedRoot?.tagName).toBe("DIV");
    expect(page.getByRole("navigation", { name: "Site", exact: true }).all()).toHaveLength(1);
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

  it("shows an inline Root's default content inside the Viewport placed in the outer content, not in a popup of its own", async () => {
    renderThemed(<InlineMenu />);
    const outerTrigger = roleNamed("button", "Audiences");
    await userEvent.click(outerTrigger);
    const spot = await openedLink("Spot price");

    const outerPopup = panelControlledBy(outerTrigger);
    // DOM audit: the content panel and the viewport have no role, so they are found by their slots.
    const viewport = spot.closest("[data-slot='navigation-menu-viewport']");
    const outerContent = viewport?.parentElement?.closest("[data-slot='navigation-menu-content']");
    if (outerPopup === null || !(viewport instanceof HTMLElement) || !(outerContent instanceof HTMLElement)) {
      throw new Error("expected the default content inside a viewport inside the outer content's popup");
    }
    expect(outerPopup.contains(outerContent)).toBe(true);
    expect(roleNamed("button", "Homes").getAttribute("aria-expanded")).toBe("true");
    // The only landmarks are the Site root and the outer popup Base UI renders as a <nav>.
    for (const landmark of page.getByRole("navigation").elements()) {
      expect([roleNamed("navigation", "Site"), outerPopup]).toContain(landmark);
    }
  });

  it("swaps the inline Viewport's content when another inline trigger is activated", async () => {
    renderThemed(<InlineMenu />);
    await userEvent.click(roleNamed("button", "Audiences"));
    // DOM audit: the viewport has no role, so it is found by its slot.
    const viewport = (await openedLink("Spot price")).closest("[data-slot='navigation-menu-viewport']");

    await userEvent.click(roleNamed("button", "Businesses"));
    const fixed = await openedLink("Fixed price");
    expect(viewport?.contains(fixed)).toBe(true);
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

  it("renders no caret on an inline Root's trigger, whose content is already beside its list", async () => {
    renderThemed(<InlineMenu />);
    await userEvent.click(roleNamed("button", "Audiences"));
    await openedLink("Spot price");

    expect(roleNamed("button", "Homes").querySelector("svg")).toBeNull();
    expect(roleNamed("button", "Audiences").querySelector("svg")).not.toBeNull();
  });

  it("styles a horizontal Root inside a vertical inline Root's content as a bar, not as its vertical ancestor", async () => {
    stampDensity("dense");
    renderThemed(
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
                      <div style={{ width: 400 }}>
                        <NavigationMenu.Root>
                          <NavigationMenu.List>
                            <NavigationMenu.Item>
                              <NavigationMenu.Trigger>Tariffs</NavigationMenu.Trigger>
                              <NavigationMenu.Content>
                                <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                              </NavigationMenu.Content>
                            </NavigationMenu.Item>
                            <NavigationMenu.Item>
                              <NavigationMenu.Trigger>Plans</NavigationMenu.Trigger>
                              <NavigationMenu.Content>
                                <NavigationMenu.Link href="#fixed">Fixed price</NavigationMenu.Link>
                              </NavigationMenu.Content>
                            </NavigationMenu.Item>
                          </NavigationMenu.List>
                        </NavigationMenu.Root>
                      </div>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
                <NavigationMenu.Viewport />
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    );
    await userEvent.click(roleNamed("button", "Audiences"));
    await expect.element(page.getByRole("button", { name: "Tariffs", exact: true })).toBeVisible();

    const trigger = roleNamed("button", "Tariffs");
    const caret = trigger.querySelector("svg");
    if (!(caret instanceof SVGElement)) {
      throw new Error("expected the bar trigger's caret");
    }
    const box = trigger.getBoundingClientRect();
    const next = roleNamed("button", "Plans").getBoundingClientRect();
    expect(box.height).toBe(CONTROL_MD.dense.height);
    expect(box.width).toBeLessThan(400);
    // A bar lays its triggers out in a row; a leaked vertical list would stack them.
    expect(next.top).toBe(box.top);
    expect(next.left).toBeGreaterThan(box.right);
    expect(getComputedStyle(caret).rotate).toBe("none");

    await userEvent.click(trigger);
    await openedLink("Spot price");
    await vi.waitFor(() => {
      expect(getComputedStyle(caret).rotate).toBe("180deg");
    });
  });

  it("puts the Viewport's data-slot and the consumer className on the rendered element", async () => {
    renderThemed(<InlineMenu />);
    await userEvent.click(roleNamed("button", "Audiences"));
    // DOM audit: the viewport has no role, so it is found by its slot.
    const viewport = (await openedLink("Spot price")).closest("[data-slot='navigation-menu-viewport']");
    expect(viewport?.classList.contains("viewport-extra")).toBe(true);
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

  it("lays a vertical Root's trigger out as a full-width, start-aligned row whose caret points to its side='right' popup", async () => {
    stampDensity("dense");
    renderThemed(
      <div style={{ width: 240 }}>
        <NavigationMenu.Root aria-label="Audiences" orientation="vertical" side="right">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>
                <span style={{ display: "block" }}>
                  <span style={{ display: "block" }}>Homes</span>
                  <span style={{ display: "block" }}>Prices for your household</span>
                </span>
              </NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    );
    const trigger = page.getByRole("button", { name: /^Homes/u }).element();
    if (!(trigger instanceof HTMLElement)) {
      throw new Error("expected the Homes trigger");
    }
    const caret = trigger.querySelector("svg");
    if (!(caret instanceof SVGElement)) {
      throw new Error("expected the trigger's caret");
    }
    const box = trigger.getBoundingClientRect();
    expect(box.width).toBe(240);
    expect(box.height).toBeGreaterThan(CONTROL_MD.dense.height);
    expect(getComputedStyle(trigger).textAlign).toBe("start");
    expect(caret.getBoundingClientRect().right).toBeCloseTo(box.right - CONTROL_MD.dense.px, 0);
    expect(getComputedStyle(caret).rotate).toBe("-90deg");

    // Opening a side panel keeps the caret on its side instead of flipping it.
    await userEvent.click(trigger);
    await openedLink("Spot price");
    await vi.waitFor(() => {
      expect(getComputedStyle(caret).rotate).toBe("-90deg");
    });
  });

  it("points the caret to the side its popup opens on: physical sides are absolute, logical sides follow the direction", async () => {
    // Base UI places logical sides from its DirectionProvider, and the document reads `dir`;
    // an RTL consumer sets both, so each case does too.
    const cases = [
      { side: "right", dir: "ltr", opensTo: "right", rotate: "-90deg" },
      { side: "right", dir: "rtl", opensTo: "right", rotate: "-90deg" },
      { side: "left", dir: "ltr", opensTo: "left", rotate: "90deg" },
      { side: "inline-end", dir: "ltr", opensTo: "right", rotate: "-90deg" },
      { side: "inline-end", dir: "rtl", opensTo: "left", rotate: "90deg" },
      { side: "inline-start", dir: "rtl", opensTo: "right", rotate: "-90deg" },
    ] as const;
    const initial = { width: window.innerWidth, height: window.innerHeight };
    // Room for the popup on both sides of the trigger, so collision flipping cannot mask a wrong side.
    await page.viewport(1024, 768);
    try {
      for (const { side, dir, opensTo, rotate } of cases) {
        const label = `${side} ${dir}`;
        const { unmount } = renderThemed(
          <DirectionProvider direction={dir}>
            <div dir={dir} style={{ width: 160, marginInline: "auto" }}>
              <NavigationMenu.Root aria-label={label} orientation="vertical" side={side}>
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Trigger>{label}</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </div>
          </DirectionProvider>
        );
        const trigger = roleNamed("button", label);
        const caret = trigger.querySelector("svg");
        if (!(caret instanceof SVGElement)) {
          throw new Error(`expected the ${label} trigger's caret`);
        }
        expect(getComputedStyle(caret).rotate, label).toBe(rotate);

        await userEvent.click(trigger);
        await openedLink("Spot price");
        const popup = panelControlledBy(trigger);
        if (popup === null) {
          throw new Error(`expected the ${label} trigger to control a popup`);
        }
        await vi.waitFor(() => {
          const box = trigger.getBoundingClientRect();
          const placed = popup.getBoundingClientRect();
          if (opensTo === "right") {
            expect(placed.left, `${label} popup`).toBeGreaterThanOrEqual(box.right);
          } else {
            expect(placed.right, `${label} popup`).toBeLessThanOrEqual(box.left);
          }
        });
        unmount();
      }
    } finally {
      await page.viewport(initial.width, initial.height);
    }
  });

  it("turns a bar trigger's caret from down to up while its panel is open", async () => {
    renderThemed(<SiteMenu />);
    const trigger = roleNamed("button", "Products");
    const caret = trigger.querySelector("svg");
    if (!(caret instanceof SVGElement)) {
      throw new Error("expected the trigger's caret");
    }
    expect(getComputedStyle(caret).rotate).toBe("none");

    await userEvent.click(trigger);
    await openedLink("Electricity");
    await vi.waitFor(() => {
      expect(getComputedStyle(caret).rotate).toBe("180deg");
    });
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
