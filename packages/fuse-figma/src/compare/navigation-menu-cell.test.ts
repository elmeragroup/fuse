/**
 * The HTML the built Fuse Navigation menu renders for the bar and row sets' cells. Unit under test:
 * each renderer's props and host. Oracle: the `class` attribute the real trigger or link carries,
 * which the definition must give the cell with its recipe, the kit's 288px and 256px row widths, and
 * Base UI's open trigger, which carries `data-popup-open` and `aria-expanded="true"` while the Root
 * renders its popup only through a portal. The markup check in `kit-markup.test.ts` reads each cell's
 * conditions, labels and icons, not the part's classes or the host, so it cannot tell a renderer that
 * sets a row at another width, one that renders the wrong orientation's classes, or an open cell that
 * renders the popup.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { Cell, ComponentDefinition } from "../components/component-spec";
import {
  NAVIGATION_MENU_BAR_LINK,
  NAVIGATION_MENU_BAR_TRIGGER,
  NAVIGATION_MENU_ROW_LINK,
  NAVIGATION_MENU_VERTICAL_TRIGGER,
} from "../components/navigation-menu-kit";
import { renderCellHtml } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";
import {
  navigationMenuBarLink,
  navigationMenuBarTrigger,
  navigationMenuRowLink,
  navigationMenuVerticalTrigger,
} from "./navigation-menu-cell";

/** The host's style, the class of the element carrying the definition's slot, and the slots it renders. */
function rendered(renderer: CellRendering, definition: ComponentDefinition, cell: Cell) {
  const elements = elementsOf(renderCellHtml(renderer, cell));
  const root = elements.find((element) => element.attributes.get("data-slot") === definition.slot);
  return {
    host: elements[0]?.attributes.get("style"),
    root: root?.attributes.get("class"),
    open: [root?.attributes.get("data-popup-open"), root?.attributes.get("aria-expanded")],
    slots: elements.flatMap((element) => element.attributes.get("data-slot") ?? []),
  };
}

const MENU = ["navigation-menu", "navigation-menu-list", "navigation-menu-item"];

describe("the Navigation menu renderers", () => {
  it.each([
    {
      set: "bar",
      renderer: navigationMenuBarTrigger,
      definition: NAVIGATION_MENU_BAR_TRIGGER,
      host: undefined,
    },
    {
      set: "vertical",
      renderer: navigationMenuVerticalTrigger,
      definition: NAVIGATION_MENU_VERTICAL_TRIGGER,
      host: "width:288px",
    },
  ])("render the $set trigger open as Base UI marks it, with no popup", ({ renderer, definition, host }) => {
    const cell = { state: "rest", open: "on" };
    const markup = rendered(renderer, definition, cell);
    expect(markup.host).toBe(host);
    expect(markup.root).toBe(definition.classesFor(cell));
    expect(markup.open).toEqual(["", "true"]);
    expect(markup.slots).toEqual([...MENU, "navigation-menu-trigger"]);
  });

  it("renders a closed trigger as closed", () => {
    expect(
      rendered(navigationMenuBarTrigger, NAVIGATION_MENU_BAR_TRIGGER, { state: "rest", open: "off" }).open
    ).toEqual([undefined, "false"]);
  });

  it.each([
    { set: "bar", renderer: navigationMenuBarLink, definition: NAVIGATION_MENU_BAR_LINK, host: undefined },
    {
      set: "row",
      renderer: navigationMenuRowLink,
      definition: NAVIGATION_MENU_ROW_LINK,
      host: "width:256px",
    },
  ])("render the $set link with its box's classes", ({ renderer, definition, host }) => {
    const cell = { state: "rest", active: "on" };
    const markup = rendered(renderer, definition, cell);
    expect(markup.host).toBe(host);
    expect(markup.root).toBe(definition.classesFor(cell));
  });
});
