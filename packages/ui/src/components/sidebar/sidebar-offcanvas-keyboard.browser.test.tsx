import type { ReactNode, Ref } from "react";
import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  ContextProbe,
  Frame,
  MOBILE,
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

function offcanvasMenuControls() {
  // DOM audit: a `visibility: hidden` panel is out of the accessibility tree, so role
  // queries cannot find its controls; keep the menu controls by slot and label.
  const link = document.querySelector('[data-slot="sidebar-menu-button"]');
  if (!(link instanceof HTMLAnchorElement)) {
    throw new Error("expected the sidebar menu link");
  }
  const extra = [...document.querySelectorAll("button")].find(
    (node): node is HTMLButtonElement =>
      node instanceof HTMLButtonElement &&
      node.textContent === "Extra" &&
      node.getAttribute("data-slot") !== "sidebar-rail"
  );
  if (!extra) {
    throw new Error("expected the extra menu button");
  }
  return { link, extra };
}

function ordersMenuItem() {
  return (
    <Sidebar.MenuItem>
      <Sidebar.MenuButton render={<a href="#x" />}>Orders</Sidebar.MenuButton>
    </Sidebar.MenuItem>
  );
}

function ordersLink(): HTMLElement {
  return roleNamed("link", "Orders");
}

/** A caller wrapper around Rail; the visibility opt-in must not depend on Rail's position. */
function RailShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function OffcanvasFrame({ side, rootRef }: { side?: "left" | "right"; rootRef?: Ref<HTMLDivElement> }) {
  return (
    <Frame
      provider={{ defaultOpen: false }}
      root={side ? { side } : undefined}
      rootRef={rootRef}
      rail={
        <RailShell>
          <Sidebar.Rail />
        </RailShell>
      }>
      {ordersMenuItem()}
      <button type="button">Extra</button>
    </Frame>
  );
}

describe("Sidebar collapsed offcanvas keyboard", () => {
  for (const side of ["left", "right"] as const) {
    it(`skips collapsed offcanvas menu controls on the ${side}`, async () => {
      renderThemed(<OffcanvasFrame side={side} />);
      expect(sidebarRoot().getAttribute("data-collapsible")).toBe("offcanvas");
      expect(sidebarRoot().getAttribute("data-side")).toBe(side);
      expect(panelVisibility(), "the collapsed panel is hidden, not unmounted").toBe("hidden");
      expect(getComputedStyle(railNamed("Toggle sidebar")).visibility, "the Rail opts back in").toBe(
        "visible"
      );

      const { link, extra } = offcanvasMenuControls();
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
        {ordersMenuItem()}
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
    const rootRef = createRef<HTMLDivElement>();
    renderThemed(<OffcanvasFrame rootRef={rootRef} />);
    expect(rootRef.current?.getAttribute("data-slot"), "the caller's ref reaches the container").toBe(
      "sidebar-container"
    );
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
        {ordersMenuItem()}
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

  it("does not expose menu controls while the mobile sheet is closed", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    renderThemed(<Frame>{ordersMenuItem()}</Frame>);

    expect(page.getByRole("link", { name: "Orders", exact: true }).query()).toBeNull();
    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });
});
