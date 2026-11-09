import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { bySlot, setupSidebarBrowser } from "../../../test/sidebar-browser-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { Sidebar } from "./index";

// How the Separator sits in the content column. The oracle is the recipe's `mx-2` inset.

setupSidebarBrowser();

describe("Sidebar.Separator", () => {
  // Oracle: `mx-2`, an 8px inset on each side of the hairline inside the content column.
  it("insets the Separator 8px from each side of the content", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Sidebar.Provider>
          <Sidebar.Root>
            <Sidebar.Content>
              <Sidebar.Separator />
            </Sidebar.Content>
          </Sidebar.Root>
          <Sidebar.Inset />
        </Sidebar.Provider>
      )
    );
    const content = bySlot("sidebar-content").getBoundingClientRect();
    const separator = bySlot("sidebar-separator").getBoundingClientRect();
    expect(separator.width).toBe(content.width - 16);
    expect(separator.left - content.left).toBe(8);
    expect(content.right - separator.right).toBe(8);
  });
});
