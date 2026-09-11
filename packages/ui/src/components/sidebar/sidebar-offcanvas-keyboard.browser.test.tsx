import type { ReactNode } from "react";
import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
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

function offcanvasMenuControls() {
  // DOM audit: collapsed offcanvas contents leave the accessibility tree; retain the menu controls by slot and label.
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

/** A caller wrapper around Rail; the escape must not depend on Rail's position or identity. */
function RailShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function OffcanvasFrame({ side }: { side?: "left" | "right" }) {
  return (
    <Frame provider={{ defaultOpen: false }} root={side ? { side } : undefined}>
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

      // DOM audit: the inert panel is the structural hide; Rail must sit outside it.
      const inner = bySlot("sidebar-inner");
      const rail = railNamed("Toggle sidebar");
      expect(inner.inert).toBe(true);
      expect(rail.closest('[data-slot="sidebar-inner"]'), "Rail escapes the inert panel").toBeNull();
      expect(rail.parentElement).toBe(inner.parentElement);

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
    expect(bySlot("sidebar-inner").inert).toBe(true);
    expect(sidebarRoot().contains(document.activeElement)).toBe(false);

    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Toggle sidebar"));

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
    expect(bySlot("sidebar-inner").inert).toBe(false);

    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(ordersLink());
  });

  it("reopens from the pointer rail while collapsed offcanvas", async () => {
    renderThemed(<Frame provider={{ defaultOpen: false }}>{ordersMenuItem()}</Frame>);
    expect(sidebarRoot().getAttribute("data-state")).toBe("collapsed");
    // DOM audit: the inert panel is the structural hide; Rail must sit outside it.
    const inner = bySlot("sidebar-inner");
    expect(inner.inert).toBe(true);
    expect(railNamed("Toggle sidebar").closest('[data-slot="sidebar-inner"]')).toBeNull();

    await userEvent.click(railNamed("Toggle sidebar"));
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
    expect(inner.inert).toBe(false);

    roleNamed("button", "Toggle sidebar").focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(ordersLink());
  });

  it("keeps a fragment-wrapped Rail outside the inert panel", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider defaultOpen={false}>
          <Sidebar.Root>
            <Sidebar.Content>
              <Sidebar.Menu>{ordersMenuItem()}</Sidebar.Menu>
            </Sidebar.Content>
            <>
              <Sidebar.Rail />
            </>
          </Sidebar.Root>
        </Sidebar.Provider>
      )
    );

    // DOM audit: the inert panel is the structural hide; Rail must sit outside it.
    expect(bySlot("sidebar-inner").inert).toBe(true);
    const rail = railNamed("Toggle sidebar");
    expect(rail.closest('[data-slot="sidebar-inner"]')).toBeNull();

    await userEvent.click(rail);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
  });

  it("keeps a wrapper-rendered Rail outside the inert panel", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider defaultOpen={false}>
          <Sidebar.Root>
            <Sidebar.Content>
              <Sidebar.Menu>{ordersMenuItem()}</Sidebar.Menu>
            </Sidebar.Content>
            <RailShell>
              <Sidebar.Rail />
            </RailShell>
          </Sidebar.Root>
        </Sidebar.Provider>
      )
    );

    // DOM audit: the inert panel is the structural hide; Rail must sit outside it.
    const inner = bySlot("sidebar-inner");
    expect(inner.inert).toBe(true);
    const rail = railNamed("Toggle sidebar");
    expect(rail.closest('[data-slot="sidebar-inner"]')).toBeNull();
    expect(rail.parentElement).toBe(inner.parentElement);

    await userEvent.click(rail);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
  });

  it("keeps the Rail escape when the caller refs Root", async () => {
    const rootRef = createRef<HTMLDivElement>();
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider defaultOpen={false}>
          <Sidebar.Root ref={rootRef}>
            <Sidebar.Content>
              <Sidebar.Menu>{ordersMenuItem()}</Sidebar.Menu>
            </Sidebar.Content>
            <Sidebar.Rail />
          </Sidebar.Root>
        </Sidebar.Provider>
      )
    );

    // The caller's ref reaches the container; the host callback survives the merge.
    expect(rootRef.current?.getAttribute("data-slot")).toBe("sidebar-container");
    // DOM audit: the inert panel is the structural hide; Rail must sit outside it.
    const inner = bySlot("sidebar-inner");
    expect(inner.inert).toBe(true);
    const rail = railNamed("Toggle sidebar");
    expect(rail.closest('[data-slot="sidebar-inner"]')).toBeNull();
    expect(rail.parentElement).toBe(inner.parentElement);

    await userEvent.click(rail);
    await vi.waitFor(() => {
      expect(sidebarRoot().getAttribute("data-state")).toBe("expanded");
    });
  });

  it("keeps icon-collapsed menu buttons tabbable", async () => {
    renderThemed(
      <Frame provider={{ defaultOpen: false }} root={{ collapsible: "icon" }}>
        {ordersMenuItem()}
      </Frame>
    );
    expect(sidebarRoot().getAttribute("data-collapsible")).toBe("icon");
    expect(bySlot("sidebar-inner").inert, "icon collapse keeps the panel interactive").toBe(false);

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
