/**
 * The HTML the built Fuse Sidebar renders for the row sets' cells. Unit under test: each renderer's
 * props and host. Oracle: the `class` attribute the real part carries, which the definition must give
 * the cell with its recipe, the kit's 240px and 191px preview widths, and the `group` marker and
 * `text-sidebar-foreground` that the desktop `Sidebar.Root` in `sidebar.tsx` carries around its rows.
 * The sections sit in the docs' 16rem Sidebar, 256px, and the sub menu and the item with badge in a
 * 240px menu row. The panel sits in a host as tall as the app frame demo's 28rem frame that contains
 * its paint, as the frame's `contain-paint` does, around the `data-*` markers the desktop
 * `Sidebar.Root` stamps.
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
import { SIDEBAR } from "../components/sidebar-panel-kit";
import {
  SIDEBAR_FOOTER,
  SIDEBAR_GROUP,
  SIDEBAR_HEADER,
  SIDEBAR_MENU_ITEM_WITH_BADGE,
  SIDEBAR_MENU_SUB,
} from "../components/sidebar-section-kit";
import { renderCellHtml } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";
import {
  sidebarFooter,
  sidebarGroup,
  sidebarGroupLabel,
  sidebarHeader,
  sidebarMenuBadge,
  sidebarMenuButton,
  sidebarMenuItemWithBadge,
  sidebarMenuSub,
  sidebarMenuSubButton,
  sidebarPanel,
} from "./sidebar-cell";

/**
 * The host's style and class, its rail marker, and the class of the element carrying the definition's
 * slot.
 */
function rendered(renderer: CellRendering, definition: ComponentDefinition, cell: Cell) {
  const elements = elementsOf(renderCellHtml(renderer, cell));
  const root = elements.find((element) => element.attributes.get("data-slot") === definition.slot);
  return {
    host: [elements[0]?.attributes.get("style"), elements[0]?.attributes.get("class")],
    collapsible: elements[0]?.attributes.get("data-collapsible"),
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

describe("the Sidebar section renderers", () => {
  it.each([
    { part: "group", definition: SIDEBAR_GROUP, renderer: sidebarGroup },
    { part: "header", definition: SIDEBAR_HEADER, renderer: sidebarHeader },
    { part: "footer", definition: SIDEBAR_FOOTER, renderer: sidebarFooter },
  ])(
    "render the $part in a 256px Sidebar root, collapsed to the icon rail or not",
    ({ definition, renderer }) => {
      for (const [collapsed, marker] of [
        ["off", ""],
        ["on", "icon"],
      ] as const) {
        const cell = { collapsed };
        const { host, collapsible, root } = rendered(renderer, definition, cell);
        expect([host, collapsible]).toEqual([["width:256px", "group text-sidebar-foreground"], marker]);
        expect(root).toBe(definition.classesFor(cell));
      }
    }
  );

  it("renders the sub menu in a 240px expanded Sidebar root", () => {
    const cell = { rows: "3" };
    const { host, collapsible, root } = rendered(sidebarMenuSub, SIDEBAR_MENU_SUB, cell);
    expect([host, collapsible]).toEqual([["width:240px", "group text-sidebar-foreground"], ""]);
    expect(root).toBe(SIDEBAR_MENU_SUB.classesFor(cell));
  });

  it("renders the item with badge in a 240px expanded Sidebar root", () => {
    const cell = { active: "on" };
    const { host, collapsible, root } = rendered(
      sidebarMenuItemWithBadge,
      SIDEBAR_MENU_ITEM_WITH_BADGE,
      cell
    );
    expect([host, collapsible]).toEqual([["width:240px", "group text-sidebar-foreground"], ""]);
    expect(root).toBe(SIDEBAR_MENU_ITEM_WITH_BADGE.classesFor(cell));
  });
});

describe("the Sidebar panel renderer", () => {
  it.each([
    { variant: "sidebar", collapsed: "off", state: "expanded", marker: "" },
    { variant: "sidebar", collapsed: "on", state: "collapsed", marker: "icon" },
    { variant: "inset", collapsed: "off", state: "expanded", marker: "" },
    { variant: "inset", collapsed: "on", state: "collapsed", marker: "icon" },
  ])(
    "renders the $state $variant panel in a 448px host that contains its paint",
    ({ variant, collapsed, state, marker }) => {
      const cell = { variant, collapsed };
      const elements = elementsOf(renderCellHtml(sidebarPanel, cell));
      const bySlot = (slot: string) =>
        elements.find((element) => element.attributes.get("data-slot") === slot);
      const panel = bySlot("sidebar");
      expect(elements[0]?.attributes.get("style")).toBe("position:relative;height:448px;contain:paint");
      expect(
        ["state", "collapsible", "variant", "side"].map((name) => panel?.attributes.get(`data-${name}`))
      ).toEqual([state, marker, variant, "left"]);
      expect(bySlot("sidebar-container")?.attributes.get("class")).toBe(SIDEBAR.classesFor(cell));
    }
  );
});
