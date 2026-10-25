/**
 * Sidebar's desktop panel, as one component set on the Sidebar page, built from instances of its
 * section sets: `Sidebar`, the `sidebar` and `inset` variants, expanded and collapsed to the icon
 * rail, 4 cells.
 *
 * - The root is `sidebar-container`, the rail box, holding `sidebar-inner`, the surface, which holds
 *   the app frame demo's `Sidebar header`, a `Sidebar.Content` holding the icon collapse demo's
 *   `Sidebar group` and a `Sidebar.Separator`, and the landing dashboard's `Sidebar footer`. Each
 *   section is an instance that fills the rail, and the content takes the height the header and
 *   footer leave.
 * - Its widths are the Provider's `--sidebar-width` (16rem, 256px) and `--sidebar-width-icon` (3rem,
 *   48px), which the wrapper's style sets, so they draw as literals. An inset rail adds its 8px
 *   padding on each side and the 2px a floating ring takes, 66px.
 * - The `sidebar` variant draws its 1px edge border on the end side, in the layout, so its sections
 *   draw 255px wide, or 47px in the rail. The `inset` variant pads 8px instead, on the `sidebar` fill
 *   the Provider's wrapper paints behind it, so its sections draw 240px wide, or 50px in the rail.
 * - The separator is as wide as the content past its 8px start margin, so the content's clip cuts
 *   its end.
 * - It stands as tall as the app frame demo's 28rem frame, which the Root's `h-full` takes.
 *
 * The gap beside the panel is a flow spacer and the Rail paints only on hover, so neither draws. No
 * docs demo shows a floating Sidebar, so the set has no `floating` variant.
 */
import {
  cn,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  separatorClass,
  sidebarContentClass,
  sidebarPanelVariants,
  sidebarSeparatorClass,
  sidebarWrapperClass,
} from "@elmeragroup/fuse/recipe-catalog";

import type {
  AncestorDefinition,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  OuterDeclaration,
} from "./component-spec";
import { always, never } from "./popup-facts";
import { SIDEBAR_FOOTER, SIDEBAR_GROUP, SIDEBAR_HEADER } from "./sidebar-section-kit";

/** The height of the app frame demo's frame, `h-[28rem]`, which the Root's `h-full` takes. */
export const SIDEBAR_PANEL_HEIGHT = 448;

/** The class the docs demos pass to `Sidebar.Root`, which the container takes. */
export const SIDEBAR_ROOT_CLASS = "h-full";

/** The class the docs demos pass to `Sidebar.Provider`, which its wrapper takes. */
export const SIDEBAR_PROVIDER_CLASS = "min-h-full";

/** The panel's variants the docs demos show, the recipe's default first. */
const PANEL_VARIANTS = ["sidebar", "inset"] as const;

type PanelVariant = (typeof PANEL_VARIANTS)[number];

function isPanelVariant(value: string | undefined): value is PanelVariant {
  return PANEL_VARIANTS.some((variant) => variant === value);
}

/**
 * The variant a `sidebar` cell renders.
 *
 * @param cell - A `sidebar` cell.
 * @returns Its variant.
 * @throws When the cell names a variant the set does not draw, a defect in the caller's cell.
 */
export function panelVariant(cell: Cell): PanelVariant {
  const { variant } = cell;
  if (!isPanelVariant(variant)) {
    throw new Error(`Sidebar has no variant ${variant ?? ""}`);
  }
  return variant;
}

const collapsed = (cell: Cell): boolean => cell.collapsed === "on";

/** The rail widths the Provider's wrapper sets in its style around the container. */
const WIDTHS: readonly OuterDeclaration[] = [
  {
    className: "Sidebar.Provider's style, --sidebar-width",
    property: "--sidebar-width",
    value: SIDEBAR_WIDTH,
  },
  {
    className: "Sidebar.Provider's style, --sidebar-width-icon",
    property: "--sidebar-width-icon",
    value: SIDEBAR_WIDTH_ICON,
  },
];

/**
 * The Provider's wrapper, which holds the panel and the inset and spans the container's whole box.
 * Beside an inset panel it paints `has-data-[variant=inset]:bg-sidebar`, which shows in the band the
 * container's padding leaves around the surface.
 */
const WRAPPER: AncestorDefinition = {
  slot: "sidebar-wrapper",
  classes: cn(sidebarWrapperClass, SIDEBAR_PROVIDER_CLASS),
  undrawn: "the Provider's wrapper lays out the panel beside the inset, which the set does not draw",
  backdrop: true,
};

/**
 * The desktop `Sidebar.Root` between the wrapper and the container, the `group peer` anchor whose
 * `data-*` markers the container's classes read, and whose text colour the panel inherits.
 */
const ROOT: AncestorDefinition = {
  slot: "sidebar",
  classes: sidebarPanelVariants().root(),
  undrawn: "the desktop Root shows the panel from `md:`, which the set draws as a desktop",
};

/** A section as an instance of its set, expanded or collapsed with the panel. */
function section(key: string, of: ComponentDefinition): InstanceDefinition {
  return {
    kind: "instance",
    key,
    of,
    cell: (outer) => ({ collapsed: outer.collapsed ?? "off" }),
    shownIn: always,
    exposed: true,
  };
}

/** The desktop panel, as `sidebar-container` > `sidebar-inner` > header, content and footer. */
export const SIDEBAR: ComponentDefinition = {
  key: "sidebar",
  name: "Sidebar",
  slot: "sidebar-container",
  axes: [
    { name: "variant", values: PANEL_VARIANTS },
    { name: "collapsed", values: ["off", "on"] },
  ],
  columnAxis: "collapsed",
  previewHeight: SIDEBAR_PANEL_HEIGHT,
  inheritedFor: () => WIDTHS,
  ancestorsFor: () => [WRAPPER, ROOT],
  classesFor: (cell) =>
    sidebarPanelVariants({ variant: panelVariant(cell) }).container({ className: SIDEBAR_ROOT_CLASS }),
  states: {},
  // The desktop Root stamps `data-collapsible` and `data-side` around the container, which stamps
  // its own `data-side`. The docs panels sit on the left and collapse to the icon rail.
  facts: new Map([
    ["group-data-[collapsible=icon]", collapsed],
    ["group-data-[collapsible=offcanvas]", never],
    ["group-data-[side=left]", always],
    ["group-data-[side=right]", never],
    ["data-[side=left]", always],
    ["data-[side=right]", never],
    // The wrapper holds the desktop Root, which stamps `data-variant`.
    ["has-data-[variant=inset]", (cell: Cell) => panelVariant(cell) === "inset"],
  ]),
  omittedStates: new Set(),
  omittedCompositions: new Map([
    ["group-data-[variant=floating]", "a floating Sidebar, which no docs demo shows"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "inner",
      slot: "sidebar-inner",
      shownIn: always,
      classesFor: () => sidebarPanelVariants().inner(),
      label: undefined,
      iconsFor: () => [],
      parts: [
        section("header", SIDEBAR_HEADER),
        {
          key: "content",
          slot: "sidebar-content",
          shownIn: always,
          classesFor: () => sidebarContentClass,
          label: undefined,
          iconsFor: () => [],
          parts: [
            section("group", SIDEBAR_GROUP),
            {
              key: "separator",
              slot: "sidebar-separator",
              shownIn: always,
              classesFor: () => cn(separatorClass, sidebarSeparatorClass),
              // Base UI stamps `data-orientation="horizontal"` on the separator.
              facts: new Map([
                ["data-horizontal", always],
                ["data-vertical", never],
              ]),
              label: undefined,
              iconsFor: () => [],
            },
          ],
        },
        section("footer", SIDEBAR_FOOTER),
      ],
    },
  ],
  swapProperties: [],
};
