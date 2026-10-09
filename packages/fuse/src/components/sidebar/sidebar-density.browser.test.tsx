import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { setupSidebarBrowser } from "../../../test/sidebar-browser-fixtures";
import {
  CONTROL_XS,
  ROW,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textboxNamed,
} from "../../../test/themed-browser-render";
import { Sidebar } from "./index";

// Sidebar geometry at both densities: row heights, section padding, and where the actions and
// badges sit. The oracles are the density metrics, read from DENSITY_METRICS.

setupSidebarBrowser();

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

describe("Sidebar row density", () => {
  /** The box of `element` relative to the box of `outer`, in px. */
  function boxWithin(element: Element, outer: Element) {
    const box = element.getBoundingClientRect();
    const frame = outer.getBoundingClientRect();
    return { top: box.top - frame.top, height: box.height, width: box.width };
  }

  it("sizes the default row and Sidebar.Input from the row metrics and keeps the sm and lg rail heights fixed", () => {
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
      const height = (element: HTMLElement) => px(getComputedStyle(element).height);
      expect(height(roleNamed("button", "Default row")), `${density} default row`).toBe(ROW[density].height);
      expect(height(textboxNamed("Search")), `${density} input`).toBe(ROW[density].height);
      // The sm and lg rows are rail geometry, fixed at both densities.
      expect(height(roleNamed("button", "Small row")), `${density} sm row`).toBe(28);
      expect(height(roleNamed("button", "Large row")), `${density} lg row`).toBe(48);
      unmount();
    }
  });

  it("pads the header, footer and group with the row inset, and centres the group action, badge and menu action", () => {
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const { unmount } = renderThemed(
        withLocale(
          "en-US",
          <Sidebar.Provider>
            <Sidebar.Root>
              <Sidebar.Header>
                <span>Header</span>
              </Sidebar.Header>
              <Sidebar.Content>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
                  <Sidebar.GroupAction aria-label="Add project" />
                  <Sidebar.Menu>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton>Inbox</Sidebar.MenuButton>
                      <Sidebar.MenuBadge>24</Sidebar.MenuBadge>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton>Archive</Sidebar.MenuButton>
                      <Sidebar.MenuAction aria-label="More for Archive" />
                    </Sidebar.MenuItem>
                  </Sidebar.Menu>
                </Sidebar.Group>
              </Sidebar.Content>
              <Sidebar.Footer>
                <span>Footer</span>
              </Sidebar.Footer>
            </Sidebar.Root>
          </Sidebar.Provider>
        )
      );
      const row = ROW[density];
      const group = roleNamed("button", "Add project").parentElement;
      if (!(group instanceof HTMLElement)) {
        throw new Error("expected the group around its action");
      }
      const groupStyle = getComputedStyle(group);
      expect([groupStyle.paddingTop, groupStyle.paddingLeft].map(px), `${density} group`).toEqual([
        row.px,
        row.px,
      ]);
      for (const name of ["Header", "Footer"]) {
        const section = page.getByText(name, { exact: true }).element().parentElement;
        if (!(section instanceof HTMLElement)) {
          throw new Error(`expected the ${name} section`);
        }
        const style = getComputedStyle(section);
        expect([style.paddingTop, style.paddingLeft].map(px), `${density} ${name}`).toEqual([row.px, row.px]);
      }

      // The group action is the xs square, centred on the group label beside it.
      const action = roleNamed("button", "Add project");
      const label = page.getByText("Projects", { exact: true }).element();
      const square = CONTROL_XS[density].height;
      const labelBox = boxWithin(label, group);
      expect(boxWithin(action, group), `${density} group action`).toEqual({
        top: labelBox.top + (labelBox.height - square) / 2,
        height: square,
        width: square,
      });

      // The 20px badge sits on the middle of the default row.
      const badge = page.getByText("24", { exact: true }).element();
      const inbox = roleNamed("button", "Inbox");
      expect(boxWithin(badge, inbox).top + 10, `${density} badge middle`).toBe(row.height / 2);
      const menuAction = roleNamed("button", "More for Archive");
      // The menu action is the xs square, centred on the default row.
      const actionBox = boxWithin(menuAction, roleNamed("button", "Archive"));
      expect(actionBox.height, `${density} menu action size`).toBe(CONTROL_XS[density].height);
      expect(actionBox.top + actionBox.height / 2, `${density} menu action middle`).toBe(row.height / 2);
      // The button reserves the action's square plus 8px, so its label's content box ends 4px
      // before the action's box at either density. The action's hit area (`after:-inset-2`)
      // reaches 4px past the label's end, as upstream's dense geometry does, never further.
      const archive = roleNamed("button", "Archive");
      const labelEnd = archive.getBoundingClientRect().right - px(getComputedStyle(archive).paddingRight);
      const actionStart = menuAction.getBoundingClientRect().left;
      expect(actionStart - labelEnd, `${density} label to action`).toBe(4);
      expect(labelEnd - (actionStart - 8), `${density} hit-area overlap`).toBeLessThanOrEqual(4);
      unmount();
    }
  });
});
