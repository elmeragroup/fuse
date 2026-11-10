// Rows announced `aria-disabled="true"`: they keep pointer events so a Tooltip opens, and cancel
// their own activation. Toggling, layout, cookies, tooltips and the slot roster stay in
// sidebar.browser.test.tsx.
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { expectActivationCancelled, resetHashAroundEach } from "../../../test/aria-disabled-activation";
import { Frame, OrdersLink, setupSidebarBrowser } from "../../../test/sidebar-browser-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Tooltip } from "../tooltip";
import { Sidebar } from "./index";

setupSidebarBrowser();

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

    await expectActivationCancelled(link, clicks);
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

    await expectActivationCancelled(roleNamed("link", "Invoices"), clicks);
  });

  // A middle-click fires `auxclick`, not `click`, and a link opens in a new tab as that event's
  // default action. The window listener runs after the row's own handler, records whether the
  // row cancelled it, then cancels it itself so an unguarded row opens no tab.
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

    await expectActivationCancelled(roleNamed("button", "Archive"), clicks);
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
