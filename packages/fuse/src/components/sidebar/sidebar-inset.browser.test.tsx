import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { bySlot, setupSidebarBrowser } from "../../../test/sidebar-browser-fixtures";
import { px, renderThemed } from "../../../test/themed-browser-render";
import { Sidebar } from "./index";

// How the Inset renders beside the panel: its element and its card metrics. The oracles are the
// recipe's spacing classes and the landmark mapping of the element passed in `render`.

setupSidebarBrowser();

describe("Sidebar.Inset", () => {
  // Oracle: the inset card's metrics, 8px (`m-2`) from the page edges and flush (`ml-0`) against
  // the expanded inset panel, and the landmark contract: a `<div>` maps to no `main` role.
  it("renders the Inset as the element in render, keeping its slot and its card look beside an inset panel", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider>
          <Sidebar.Root variant="inset" />
          <Sidebar.Inset render={<div />} aria-label="Workspace">
            <Sidebar.Trigger />
          </Sidebar.Inset>
        </Sidebar.Provider>
      )
    );
    expect(page.getByRole("main").query()).toBeNull();
    const inset = bySlot("sidebar-inset");
    expect(inset.tagName).toBe("DIV");
    expect(inset.getAttribute("aria-label")).toBe("Workspace");
    const style = getComputedStyle(inset);
    expect(px(style.marginTop)).toBe(8);
    expect(px(style.marginRight)).toBe(8);
    expect(px(style.marginLeft)).toBe(0);
    expect(style.boxShadow).not.toBe("none");
  });
});
