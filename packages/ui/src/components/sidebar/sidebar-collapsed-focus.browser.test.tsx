// Focus containment while the Sidebar panel is collapsed, across the collapsible modes.
// Toggling, layout, cookies, the mobile Sheet and the slot roster stay in sidebar.browser.test.tsx.
import type { ReactNode, Ref } from "react";
import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  ContextProbe,
  Frame,
  OrdersLink,
  bySlot,
  railNamed,
  setupSidebarBrowser,
  sidebarRoot,
} from "../../../test/sidebar-browser-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SidebarContextValue } from "./sidebar";
import { Sidebar } from "./sidebar";

setupSidebarBrowser();

function panelVisibility(): string {
  return getComputedStyle(bySlot("sidebar-inner")).visibility;
}

/**
 * The menu link inside a collapsed offcanvas panel. A `visibility: hidden` panel is out of the
 * accessibility tree, so no role query reaches it; the slot is the handle that remains.
 */
function collapsedMenuLink(): HTMLAnchorElement {
  const link = bySlot("sidebar-menu-button");
  if (!(link instanceof HTMLAnchorElement)) {
    throw new Error("expected the sidebar menu link");
  }
  return link;
}

function ordersLink(): HTMLElement {
  return roleNamed("link", "Orders");
}

/** A caller wrapper around Rail; the visibility opt-in must not depend on Rail's position. */
function RailShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

/** `extraRef` hands out the second control: like the link, the collapsed panel hides it from role queries. */
function OffcanvasFrame({ side, extraRef }: { side?: "left" | "right"; extraRef?: Ref<HTMLButtonElement> }) {
  return (
    <Frame
      provider={{ defaultOpen: false }}
      root={{ side }}
      rail={
        <RailShell>
          <Sidebar.Rail />
        </RailShell>
      }>
      <OrdersLink />
      <button ref={extraRef} type="button">
        Extra
      </button>
    </Frame>
  );
}

describe("Sidebar collapsed focus containment", () => {
  for (const side of ["left", "right"] as const) {
    it(`skips collapsed offcanvas menu controls on the ${side}`, async () => {
      const extraRef = createRef<HTMLButtonElement>();
      renderThemed(<OffcanvasFrame side={side} extraRef={extraRef} />);
      expect(sidebarRoot().getAttribute("data-collapsible")).toBe("offcanvas");
      expect(sidebarRoot().getAttribute("data-side")).toBe(side);
      expect(panelVisibility(), "the collapsed panel is hidden, not unmounted").toBe("hidden");
      expect(getComputedStyle(railNamed("Toggle sidebar")).visibility, "the Rail opts back in").toBe(
        "visible"
      );

      const link = collapsedMenuLink();
      const extra = extraRef.current;
      if (extra === null) {
        throw new Error("expected the extra menu button");
      }
      const after = roleNamed("button", "After");

      roleNamed("button", "Toggle sidebar").focus();
      await userEvent.keyboard("{Tab}");
      expect(document.activeElement).toBe(after);
      expect(document.activeElement).not.toBe(link);
      expect(document.activeElement).not.toBe(extra);

      link.focus();
      expect(document.activeElement, "programmatic focus must not enter the collapsed panel").not.toBe(link);
      extra.focus();
      expect(document.activeElement).not.toBe(extra);
    });
  }

  it("blurs a focused menu control on collapse and returns it after reopen from the Trigger", async () => {
    let latest: SidebarContextValue | undefined;
    renderThemed(
      <Frame
        probe={
          <ContextProbe
            onValue={(value) => {
              latest = value;
            }}
          />
        }>
        <OrdersLink />
      </Frame>
    );

    const link = ordersLink();
    link.focus();
    expect(document.activeElement).toBe(link);

    latest?.setOpen(false);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    });
    expect(panelVisibility()).toBe("hidden");
    expect(sidebarRoot().contains(document.activeElement)).toBe(false);

    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Toggle sidebar"));

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
    expect(panelVisibility()).toBe("visible");

    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(ordersLink());
  });

  it("keeps the Rail clickable while the collapsed panel is hidden, whatever wraps it", async () => {
    renderThemed(<OffcanvasFrame />);
    expect(panelVisibility()).toBe("hidden");

    const rail = railNamed("Toggle sidebar");
    expect(getComputedStyle(rail).visibility).toBe("visible");
    await userEvent.click(rail);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
    expect(panelVisibility()).toBe("visible");
  });

  it("keeps icon-collapsed menu buttons tabbable", async () => {
    renderThemed(
      <Frame provider={{ defaultOpen: false }} root={{ collapsible: "icon" }}>
        <OrdersLink />
      </Frame>
    );
    expect(sidebarRoot().getAttribute("data-collapsible")).toBe("icon");
    expect(panelVisibility(), "icon collapse keeps the panel interactive").toBe("visible");

    const link = ordersLink();
    link.focus();
    expect(document.activeElement).toBe(link);

    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(link);
  });
});
