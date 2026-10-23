/**
 * The HTML the built Fuse Sidebar renders for the row sets' cells. Unit under test: each renderer's
 * props and host. Oracle: the `class` attribute the real part carries, which the definition must give
 * the cell with its recipe, the kit's 240px and 191px preview widths, and the `group` marker and
 * `text-sidebar-foreground` that the desktop `Sidebar.Root` in `sidebar.tsx` carries around its rows.
 * The markup check in `kit-markup.test.ts` reads each cell's conditions, labels and icons, not the
 * row's classes or the host, so it cannot tell a renderer that drops the variant or the size, or one
 * that sets the rows at another width or in another color.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import type { Cell, ComponentDefinition } from "../components/component-spec";
import {
  SIDEBAR_GROUP_LABEL,
  SIDEBAR_MENU_BADGE,
  SIDEBAR_MENU_BUTTON,
  SIDEBAR_MENU_SUB_BUTTON,
} from "../components/sidebar-kit";
import { renderCellHtml } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";
import { sidebarGroupLabel, sidebarMenuBadge, sidebarMenuButton, sidebarMenuSubButton } from "./sidebar-cell";

/** The host's style and class, and the class of the element carrying the definition's slot. */
function rendered(renderer: CellRendering, definition: ComponentDefinition, cell: Cell) {
  const elements = elementsOf(renderCellHtml(renderer, cell));
  const root = elements.find((element) => element.attributes.get("data-slot") === definition.slot);
  return {
    host: [elements[0]?.attributes.get("style"), elements[0]?.attributes.get("class")],
    root: root?.attributes.get("class"),
  };
}

describe("the Sidebar row renderers", () => {
  it.each([
    { variant: "outline", size: "lg", collapsed: "on", active: "on", state: "rest" },
    { variant: "default", size: "sm", collapsed: "off", active: "off", state: "disabled" },
  ])("render the $variant $size menu button in a 240px host in the Sidebar's text color", (cell) => {
    const { host, root } = rendered(sidebarMenuButton, SIDEBAR_MENU_BUTTON, cell);
    expect(host).toEqual(["width:240px", "group text-sidebar-foreground"]);
    expect(root).toBe(SIDEBAR_MENU_BUTTON.classesFor(cell));
  });

  it("renders the sm sub button in a 191px host", () => {
    const cell = { size: "sm", active: "on", state: "rest" };
    const { host, root } = rendered(sidebarMenuSubButton, SIDEBAR_MENU_SUB_BUTTON, cell);
    expect(host).toEqual(["width:191px", undefined]);
    expect(root).toBe(SIDEBAR_MENU_SUB_BUTTON.classesFor(cell));
  });

  it.each([
    {
      part: "group label",
      definition: SIDEBAR_GROUP_LABEL,
      renderer: sidebarGroupLabel,
      cell: { state: "rest" },
    },
    { part: "badge", definition: SIDEBAR_MENU_BADGE, renderer: sidebarMenuBadge, cell: { state: "active" } },
  ])("renders the $part in a 240px host", ({ definition, renderer, cell }) => {
    const { host, root } = rendered(renderer, definition, cell);
    expect(host[0]).toBe("width:240px");
    expect(root).toBe(definition.classesFor(cell));
  });
});
