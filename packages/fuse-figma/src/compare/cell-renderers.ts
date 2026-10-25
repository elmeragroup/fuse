/// <reference lib="dom" />
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
 * and list it below with the definition's key and its `dist/` entry. A client renderer's entry
 * names its module and export once, as a {@link ClientSource}, which both {@link loadRenderers} and
 * the page's bundle read.
 *
 * An overlay draws nothing in static markup: its popup portals into a container it resolves in an
 * effect. A {@link ClientCellRenderer} declares that its cells hydrate on the page instead, which
 * loads a browser bundle of those renderers, as `client-bundle.ts` builds it, and mounts each cell
 * open in its slot.
 */

import { createElement } from "react";
import type { ComponentType, ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";

import type { ElmeraIconProps } from "../../../fuse/dist/icons.js";
import type { Cell } from "../components/component-spec.ts";
import { forcedPseudoClasses, highlightAttributes } from "./cells.ts";
import type { Highlight } from "./cells.ts";

/** Renders the cells of one kit definition with the real Fuse component. */
export type CellRenderer = {
  /** The key of the kit definition whose cells it renders, such as `button`. */
  readonly set: string;
  /** The Fuse build output `element` imports, which the run checks for before loading it. */
  readonly entry: `dist/${string}.js`;
  /**
   * The real Fuse element for a parsed cell, with the states the markup draws set by props, and with
   * the parts behind each BOOLEAN property of `turnedOn`, which starts false, rendered. A preview shows
   * every property at its default, so the compare page turns none on; the markup check turns them on
   * too, to check the parts they hide.
   */
  readonly element: (cell: Cell, turnedOn: ReadonlySet<string>) => ReactElement;
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
  /**
   * How the set's markup shows a highlighted row, for a set with a `state=highlighted` cell: the page
   * forces `:focus` on the row, or writes `data-highlighted` on it. Undefined for a set with none.
   */
  readonly highlight?: Highlight;
};

/** The part of a renderer its own module defines, beside its import of the Fuse build. */
export type CellRendering = Pick<CellRenderer, "element" | "hostClasses" | "forcedAttributes" | "highlight">;

/**
 * The part of a client renderer its own module defines, which the page's bundle imports. The page
 * mounts the element in the cell's slot with React's `createRoot` and waits for the popup to settle.
 */
export type ClientCellRendering = Pick<CellRenderer, "hostClasses" | "forcedAttributes" | "highlight"> & {
  /**
   * The real Fuse element for a parsed cell, open through `defaultOpen`, with its popup portalled
   * into `container`, the cell's slot, through the overlay's `container` prop, so the popup lays out
   * beside the trigger inside the slot. `turnedOn` is as for {@link CellRenderer.element}.
   */
  readonly element: (cell: Cell, turnedOn: ReadonlySet<string>, container: HTMLElement) => ReactElement;
  /**
   * The `data-slot` of each element an open composite's box spans, such as its trigger and its
   * popup, whose union the page measures. Undefined for a popup part or a row, which the page
   * measures as any other root.
   */
  readonly union?: readonly string[];
};

/**
 * Where a client rendering lives: a module beside this one and the export that holds the rendering.
 * The page's bundle imports it from there, and {@link loadRenderers} loads it from the same place.
 */
export type ClientModule = { readonly url: URL; readonly name: string };

/** A client renderer as `SOURCES` lists it: its set, its build entry and its rendering's module. */
export type ClientSource = Pick<CellRenderer, "set" | "entry"> & { readonly module: ClientModule };

/** Renders the cells of one kit definition by mounting the real Fuse component on the page. */
export type ClientCellRenderer = Pick<CellRenderer, "set" | "entry"> &
  ClientCellRendering & { readonly module: ClientModule };

/** A renderer of either kind. */
export type AnyCellRenderer = CellRenderer | ClientCellRenderer;

/**
 * Whether a renderer's cells hydrate on the page.
 *
 * @param renderer - A renderer of either kind.
 * @returns True for a client renderer.
 */
export function isClientRenderer(renderer: AnyCellRenderer): renderer is ClientCellRenderer {
  return "module" in renderer;
}

/** A static renderer as `SOURCES` lists it, with the import of its module's rendering. */
type StaticSource = Pick<CellRenderer, "set" | "entry"> & {
  readonly load: () => Promise<CellRendering>;
};

type RendererSource = StaticSource | ClientSource;

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
    set: "input-group",
    entry: "dist/input-group.js",
    load: async () => (await import("./input-group-cell.ts")).inputGroup,
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
    set: "menu-group-label",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("menu-cell.ts", import.meta.url), name: "menuGroupLabel" },
  },
  {
    set: "menu-separator",
    entry: "dist/select.js",
    load: async () => (await import("./menu-cell.ts")).menuSeparator,
  },
  {
    set: "select-item",
    entry: "dist/select.js",
    module: { url: new URL("select-cell.ts", import.meta.url), name: "selectItem" },
  },
  {
    set: "select-popup",
    entry: "dist/select.js",
    module: { url: new URL("select-cell.ts", import.meta.url), name: "selectPopup" },
  },
  {
    set: "select-open",
    entry: "dist/select.js",
    module: { url: new URL("select-cell.ts", import.meta.url), name: "selectOpen" },
  },
  {
    set: "popover-content",
    entry: "dist/popover.js",
    module: { url: new URL("popover-cell.ts", import.meta.url), name: "popoverContent" },
  },
  {
    set: "popover-open",
    entry: "dist/popover.js",
    module: { url: new URL("popover-cell.ts", import.meta.url), name: "popoverOpen" },
  },
  {
    set: "dropdown-menu-item",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuItem" },
  },
  {
    set: "dropdown-menu-checkbox-item",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuCheckboxItem" },
  },
  {
    set: "dropdown-menu-radio-item",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuRadioItem" },
  },
  {
    set: "dropdown-menu-sub-trigger",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuSubTrigger" },
  },
  {
    set: "dropdown-menu-popup",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuPopup" },
  },
  {
    set: "dropdown-menu-sub-content",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuSubContent" },
  },
  {
    set: "dropdown-menu-open",
    entry: "dist/dropdown-menu.js",
    module: { url: new URL("dropdown-menu-cell.ts", import.meta.url), name: "dropdownMenuOpen" },
  },
  {
    set: "combobox-item",
    entry: "dist/combobox.js",
    module: { url: new URL("combobox-cell.ts", import.meta.url), name: "comboboxItem" },
  },
  {
    set: "combobox-empty",
    entry: "dist/combobox.js",
    module: { url: new URL("combobox-cell.ts", import.meta.url), name: "comboboxEmpty" },
  },
  {
    set: "combobox-popup",
    entry: "dist/combobox.js",
    module: { url: new URL("combobox-cell.ts", import.meta.url), name: "comboboxPopup" },
  },
  {
    set: "combobox-open",
    entry: "dist/combobox.js",
    module: { url: new URL("combobox-cell.ts", import.meta.url), name: "comboboxOpen" },
  },
  {
    set: "command-item",
    entry: "dist/command.js",
    module: { url: new URL("command-cell.ts", import.meta.url), name: "commandItem" },
  },
  {
    set: "command-list",
    entry: "dist/command.js",
    module: { url: new URL("command-cell.ts", import.meta.url), name: "commandList" },
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
    set: "sidebar-group",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarGroup,
  },
  {
    set: "sidebar-header",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarHeader,
  },
  {
    set: "sidebar-footer",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarFooter,
  },
  {
    set: "sidebar-menu-sub",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarMenuSub,
  },
  {
    set: "sidebar-menu-item-with-badge",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarMenuItemWithBadge,
  },
  {
    set: "sidebar",
    entry: "dist/sidebar.js",
    load: async () => (await import("./sidebar-cell.ts")).sidebarPanel,
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
  {
    set: "navigation-menu-popup",
    entry: "dist/navigation-menu.js",
    module: { url: new URL("navigation-menu-popup-cell.ts", import.meta.url), name: "navigationMenuPopup" },
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
export async function loadRenderers(): Promise<ReadonlyMap<string, AnyCellRenderer>> {
  const renderers = await Promise.all(
    SOURCES.map(async (source): Promise<AnyCellRenderer> => {
      if ("module" in source) {
        return loadClientRenderer(source);
      }
      const { load, ...named } = source;
      return { ...named, ...(await load()) };
    })
  );
  return new Map(renderers.map((renderer) => [renderer.set, renderer]));
}

/**
 * Load a client renderer from the module its source names. It imports the Fuse build, so call this
 * only after `locateFuseBuild` found it.
 *
 * @param source - The renderer's set, build entry and module.
 * @returns The renderer.
 * @throws When the module has no export by the source's name, which the source must fix.
 */
export async function loadClientRenderer(source: ClientSource): Promise<ClientCellRenderer> {
  // SAFETY: a client renderer's module exports a ClientCellRendering under each name a source
  // lists, as `overlay-fixture-cell.ts` does. The page's bundle imports the same name, and rolldown
  // refuses a name the module does not export, so a wrong name fails both loads.
  const renderings = (await import(source.module.url.href)) as Readonly<
    Record<string, ClientCellRendering | undefined>
  >;
  const rendering = renderings[source.module.name];
  if (rendering === undefined) {
    throw new Error(`${source.module.url.pathname} exports no rendering ${source.module.name}`);
  }
  return { ...source, ...rendering };
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
 * @returns `data-highlighted` for a highlighted row its set marks, with the renderer's forced
 *   attributes for a cell whose state the page forces, and none for a cell it forces nothing on.
 */
export function forcedAttributesFor(
  renderer: Pick<CellRendering, "forcedAttributes" | "highlight">,
  cell: Cell
): Readonly<Record<string, string>> {
  const highlighted = highlightAttributes(cell, renderer.highlight);
  return forcedPseudoClasses(cell, renderer.highlight).length === 0 && Object.keys(highlighted).length === 0
    ? {}
    : { ...highlighted, ...renderer.forcedAttributes?.(cell) };
}

/** No BOOLEAN property turned on, as a preview shows every property at its default. */
const AT_DEFAULTS: ReadonlySet<string> = new Set();

/**
 * Render a cell to static HTML. The page needs no hydration: CSS draws every state, the page
 * forces hover and focus as pseudo classes, and it writes the attributes a renderer names for the
 * faces React Aria sets after hydration.
 *
 * @param renderer - The cell's renderer, or the rendering its module defines.
 * @param cell - The parsed cell.
 * @param turnedOn - The BOOLEAN properties that start false whose parts the cell renders, none for the
 *   cell as its preview shows it.
 * @returns The element as an HTML string.
 */
export function renderCellHtml(
  renderer: CellRendering,
  cell: Cell,
  turnedOn: ReadonlySet<string> = AT_DEFAULTS
): string {
  return renderToStaticMarkup(renderer.element(cell, turnedOn));
}
