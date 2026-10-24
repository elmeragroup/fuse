/**
 * How `figma:compare` renders each kit definition's cells: one renderer per definition, which turns
 * a cell into the real Fuse element. The page measures and crops the element's root part, the one
 * element in the slot whose `data-slot` is the definition's `slot`, or the one the definition's
 * `element` selects where the root carries no `data-slot`, at any depth, since a radio renders
 * inside its group. A renderer sets the states the markup draws, such as disabled or pending,
 * through the element's props. The page forces hover and focus itself, on the root part, on the
 * part the definition's `statePart` names or on the sibling its `statePeer` names, and writes the
 * attributes a renderer names for a hover or focus face React Aria sets only after hydration.
 *
 * A renderer's element comes from a module that imports the Fuse build, which exists only after
 * `pnpm --filter @elmeragroup/fuse build`. This module lists each renderer's set and the build
 * entry its module imports, so `page-assets.ts` can check the build first, and imports the
 * modules only in {@link loadRenderers}.
 *
 * To compare a new definition, add a module beside this one whose renderings build its element,
 * and list it below with the definition's key and its `dist/` entry.
 */

import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";

import type { ElmeraIconProps } from "../../../fuse/dist/icons.js";
import type { Cell } from "../components/component-spec.ts";
import { forcedPseudoClasses } from "./cells.ts";

/** Renders the cells of one kit definition with the real Fuse component. */
export type CellRenderer = {
  /** The key of the kit definition whose cells it renders, such as `button`. */
  readonly set: string;
  /** The Fuse build output `element` imports, which the run checks for before loading it. */
  readonly entry: `dist/${string}.js`;
  /** The real Fuse element for a parsed cell, with the states the markup draws set by props. */
  readonly element: (cell: Cell) => ReactElement;
  /**
   * The classes the cells pass that a host app compiles in its own Tailwind build, because Fuse's
   * standalone `styles.css` holds only the classes Fuse's own source uses. Separator, Skeleton and
   * Avatar name the docs demos' sizes. Most renderers name none.
   */
  readonly hostClasses?: readonly string[];
  /**
   * The attributes React Aria writes on the forced element while a cell's hover or focus state
   * holds, which static markup cannot hold: React Aria sets them from pointer and focus events once
   * a page hydrates, and the compare page never does. The page writes them on the element when it
   * forces the state, as `data-hovered`, which `hover:` reads on an element marked `data-rac`, or
   * the class a `className` function gives at `isFocusVisible`. Undefined for a component whose
   * hover and focus faces CSS draws from the pseudo classes the page forces.
   */
  readonly forcedAttributes?: (cell: Cell) => Readonly<Record<string, string>>;
};

/** The part of a renderer its own module defines, beside its import of the Fuse build. */
export type CellRendering = Pick<CellRenderer, "element" | "hostClasses" | "forcedAttributes">;

type RendererSource = Pick<CellRenderer, "set" | "entry"> & {
  readonly load: () => Promise<CellRendering>;
};

const SOURCES: readonly RendererSource[] = [
  {
    set: "button",
    entry: "dist/button.js",
    load: async () => (await import("./button-cell.ts")).labelButton,
  },
  {
    set: "icon-button",
    entry: "dist/button.js",
    load: async () => (await import("./button-cell.ts")).iconButton,
  },
  {
    set: "confirm-button",
    entry: "dist/confirm-button.js",
    load: async () => (await import("./confirm-button-cell.ts")).confirmButton,
  },
  {
    set: "toggle",
    entry: "dist/toggle.js",
    load: async () => (await import("./toggle-cell.ts")).labelToggle,
  },
  {
    set: "icon-toggle",
    entry: "dist/toggle.js",
    load: async () => (await import("./toggle-cell.ts")).iconToggle,
  },
  {
    set: "badge",
    entry: "dist/badge.js",
    load: async () => (await import("./badge-cell.ts")).badge,
  },
  {
    set: "kbd",
    entry: "dist/kbd.js",
    load: async () => (await import("./kbd-cell.ts")).kbd,
  },
  {
    set: "kbd-group",
    entry: "dist/kbd.js",
    load: async () => (await import("./kbd-cell.ts")).kbdGroup,
  },
  {
    set: "radio-icon-button",
    entry: "dist/radio-group.js",
    load: async () => (await import("./radio-icon-button-cell.ts")).radioIconButton,
  },
  {
    set: "radio",
    entry: "dist/radio-group.js",
    load: async () => (await import("./radio-cell.ts")).radio,
  },
  {
    set: "checkbox",
    entry: "dist/checkbox.js",
    load: async () => (await import("./checkbox-cell.ts")).checkbox,
  },
  {
    set: "switch",
    entry: "dist/switch.js",
    load: async () => (await import("./switch-cell.ts")).switchCell,
  },
  {
    set: "separator",
    entry: "dist/separator.js",
    load: async () => (await import("./separator-cell.ts")).separator,
  },
  {
    set: "skeleton",
    entry: "dist/skeleton.js",
    load: async () => (await import("./skeleton-cell.ts")).skeleton,
  },
  {
    set: "loader",
    entry: "dist/loader.js",
    load: async () => (await import("./loader-cell.ts")).loader,
  },
  {
    set: "label",
    entry: "dist/field.js",
    load: async () => (await import("./label-cell.ts")).label,
  },
  {
    set: "field-description",
    entry: "dist/field.js",
    load: async () => (await import("./field-text-cell.ts")).fieldDescription,
  },
  {
    set: "field-error",
    entry: "dist/field.js",
    load: async () => (await import("./field-text-cell.ts")).fieldError,
  },
  {
    set: "field-legend",
    entry: "dist/field.js",
    load: async () => (await import("./field-text-cell.ts")).fieldLegend,
  },
  {
    set: "field-title",
    entry: "dist/field.js",
    load: async () => (await import("./field-text-cell.ts")).fieldTitle,
  },
  {
    set: "input",
    entry: "dist/input.js",
    load: async () => (await import("./input-cell.ts")).input,
  },
  {
    set: "textarea",
    entry: "dist/textarea.js",
    load: async () => (await import("./textarea-cell.ts")).textarea,
  },
  {
    set: "avatar",
    entry: "dist/avatar.js",
    load: async () => (await import("./avatar-cell.ts")).avatar,
  },
  {
    set: "meter",
    entry: "dist/meter.js",
    load: async () => (await import("./meter-cell.ts")).meter,
  },
  {
    set: "pagination-link",
    entry: "dist/pagination.js",
    load: async () => (await import("./pagination-cell.ts")).paginationLink,
  },
  {
    set: "pagination-edge",
    entry: "dist/pagination.js",
    load: async () => (await import("./pagination-cell.ts")).paginationEdge,
  },
  {
    set: "pagination-ellipsis",
    entry: "dist/pagination.js",
    load: async () => (await import("./pagination-cell.ts")).paginationEllipsis,
  },
  {
    set: "pagination-row",
    entry: "dist/pagination.js",
    load: async () => (await import("./pagination-cell.ts")).paginationRow,
  },
  {
    set: "breadcrumb-link",
    entry: "dist/breadcrumb.js",
    load: async () => (await import("./breadcrumb-cell.ts")).breadcrumbLink,
  },
  {
    set: "breadcrumb-page",
    entry: "dist/breadcrumb.js",
    load: async () => (await import("./breadcrumb-cell.ts")).breadcrumbPage,
  },
  {
    set: "breadcrumb-ellipsis",
    entry: "dist/breadcrumb.js",
    load: async () => (await import("./breadcrumb-cell.ts")).breadcrumbEllipsis,
  },
  {
    set: "breadcrumb-separator",
    entry: "dist/breadcrumb.js",
    load: async () => (await import("./breadcrumb-cell.ts")).breadcrumbSeparator,
  },
  {
    set: "breadcrumb-trail",
    entry: "dist/breadcrumb.js",
    load: async () => (await import("./breadcrumb-cell.ts")).breadcrumbTrail,
  },
  {
    set: "select-trigger",
    entry: "dist/select.js",
    load: async () => (await import("./select-trigger-cell.ts")).selectTrigger,
  },
  {
    set: "empty",
    entry: "dist/empty.js",
    load: async () => (await import("./empty-cell.ts")).empty,
  },
  {
    set: "calendar-day",
    entry: "dist/react-aria/calendar.js",
    load: async () => (await import("./calendar-day-cell.ts")).calendarDay,
  },
  {
    set: "link",
    entry: "dist/react-aria/link.js",
    load: async () => (await import("./link-cell.ts")).link,
  },
  {
    set: "item",
    entry: "dist/item.js",
    load: async () => (await import("./item-cell.ts")).item,
  },
  {
    set: "item-link",
    entry: "dist/item.js",
    load: async () => (await import("./item-cell.ts")).itemLink,
  },
  {
    set: "alert",
    entry: "dist/alert.js",
    load: async () => (await import("./alert-cell.ts")).alert,
  },
  {
    set: "accordion-item",
    entry: "dist/accordion.js",
    load: async () => (await import("./accordion-cell.ts")).accordionItem,
  },
  {
    set: "sidebar-menu-button",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarMenuButton,
  },
  {
    set: "sidebar-menu-sub-button",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarMenuSubButton,
  },
  {
    set: "sidebar-group-label",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarGroupLabel,
  },
  {
    set: "sidebar-menu-badge",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarMenuBadge,
  },
  {
    set: "navigation-menu-bar-trigger",
    entry: "dist/navigation-menu.js",
    load: async () => (await import("./navigation-menu-cell.ts")).navigationMenuBarTrigger,
  },
  {
    set: "navigation-menu-vertical-trigger",
    entry: "dist/navigation-menu.js",
    load: async () => (await import("./navigation-menu-cell.ts")).navigationMenuVerticalTrigger,
  },
  {
    set: "navigation-menu-bar-link",
    entry: "dist/navigation-menu.js",
    load: async () => (await import("./navigation-menu-cell.ts")).navigationMenuBarLink,
  },
  {
    set: "navigation-menu-row-link",
    entry: "dist/navigation-menu.js",
    load: async () => (await import("./navigation-menu-cell.ts")).navigationMenuRowLink,
  },
];

/** The Fuse build output each renderer imports, with repeats where renderers share one. */
export const RENDERER_ENTRIES: readonly string[] = SOURCES.map((source) => source.entry);

/**
 * Load every renderer. Each one imports the Fuse build, so call this only after
 * `locateFuseBuild` found it.
 *
 * @returns Each renderer, by the key of the definition it renders.
 */
export async function loadRenderers(): Promise<ReadonlyMap<string, CellRenderer>> {
  const renderers = await Promise.all(
    SOURCES.map(async ({ load, ...source }): Promise<CellRenderer> => ({ ...source, ...(await load()) }))
  );
  return new Map(renderers.map((renderer) => [renderer.set, renderer]));
}

/**
 * An icon with the `data-icon` marker a recipe reads to move the padding on its side.
 *
 * @param icon - A Fuse icon from the build.
 * @param marker - The side the icon sits on.
 * @returns The icon element, keyed by its marker.
 */
export function markedIcon(
  icon: ComponentType<ElmeraIconProps>,
  marker: "inline-start" | "inline-end"
): ReactElement {
  // JSX passes `data-icon` through, and an object literal can only name it through a type that
  // lists it.
  const props: ElmeraIconProps & Readonly<Record<"data-icon", string>> = { "data-icon": marker };
  return createElement(icon, { ...props, key: marker });
}

/**
 * The attributes the page writes on a cell's forced element when it forces the cell's state.
 *
 * @param renderer - The cell's renderer, or the rendering its module defines.
 * @param cell - The parsed cell.
 * @returns The renderer's forced attributes for a cell whose state the page forces, and none for a
 *   cell it forces nothing on.
 */
export function forcedAttributesFor(renderer: CellRendering, cell: Cell): Readonly<Record<string, string>> {
  return forcedPseudoClasses(cell).length === 0 ? {} : (renderer.forcedAttributes?.(cell) ?? {});
}

/**
 * Render a cell to static HTML. The page needs no hydration: CSS draws every state, the page
 * forces hover and focus as pseudo classes, and it writes the attributes a renderer names for the
 * faces React Aria sets after hydration.
 *
 * @param renderer - The cell's renderer, or the rendering its module defines.
 * @param cell - The parsed cell.
 * @returns The element as an HTML string.
 */
export function renderCellHtml(renderer: CellRendering, cell: Cell): string {
  return renderToStaticMarkup(renderer.element(cell));
}
