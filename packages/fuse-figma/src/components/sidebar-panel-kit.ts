/**
 * Sidebar's desktop panel, as one component set on the Sidebar page, built from instances of its
 * section sets: `Sidebar`, the `sidebar`, `inset` and `floating` variants, expanded and collapsed to
 * the icon rail, 6 cells. The manifest names the panel's parts and section instances, and the build reads
 * the rest from `captures/sidebar.json`.
 *
 * - The root is `sidebar-container`, the rail box, holding `sidebar-inner`, the surface, which holds
 *   the app frame demo's `Sidebar header`, a `Sidebar.Content` holding the icon collapse demo's
 *   `Sidebar group` and a `Sidebar.Separator`, and the landing dashboard's `Sidebar footer`. Each
 *   section is an instance that fills the rail, and the content takes the height the header and
 *   footer leave.
 * - Its widths are the Provider's `--sidebar-width` (16rem, 256px) and `--sidebar-width-icon` (3rem,
 *   48px). An inset or floating rail adds its 8px padding on each side, 64px, as wide as its gap.
 * - The `sidebar` variant draws its 1px edge border on the end side, so its sections draw 255px
 *   wide, or 47px in the rail. The `inset` variant pads 8px instead, on the `sidebar` fill the
 *   Provider's wrapper paints behind it, so its sections draw 240px wide, or 48px in the rail.
 * - The `floating` variant pads 8px as `inset` does, and its surface rounds `radius-lg` inside a
 *   1px `sidebar-border` ring and `shadow-sm`. Its sections are the section
 *   sets' `floating=true` variants, which pad `surface-pad-sm` and round their rows inside the
 *   surface's corner.
 * - The separator is inset 8px from each side of the content.
 * - It is as tall as the app frame demo's 28rem frame, which the Root's `h-full` takes.
 *
 * The gap beside the panel is a flow spacer and the Rail paints only on hover, so neither draws.
 */
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import type { Cell } from "./component-spec";
import { always } from "./popup-facts";
import {
  SIDEBAR_FOOTER_MANIFEST,
  SIDEBAR_GROUP_MANIFEST,
  SIDEBAR_HEADER_MANIFEST,
} from "./sidebar-section-kit";

/** The height of the app frame demo's frame, `h-[28rem]`, which the Root's `h-full` takes. */
export const SIDEBAR_PANEL_HEIGHT = 448;

/** The class the docs demos pass to `Sidebar.Root`, which the container takes. */
export const SIDEBAR_ROOT_CLASS = "h-full";

/** The class the docs demos pass to `Sidebar.Provider`, which its wrapper takes. */
export const SIDEBAR_PROVIDER_CLASS = "min-h-full";

/** The panel's variants the docs demos show, the recipe's default first. */
const PANEL_VARIANTS = ["sidebar", "inset", "floating"] as const;

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

/**
 * A section as an instance of its set, expanded or collapsed with the panel, and in a floating
 * surface where the panel floats.
 */
function sectionManifest(key: string, of: SetManifest): InstanceManifest {
  return {
    kind: "instance",
    key,
    of,
    cell: (outer) => ({
      collapsed: outer.collapsed ?? "false",
      floating: outer.variant === "floating" ? "true" : "false",
    }),
    shownIn: always,
    exposed: true,
  };
}

/**
 * The panel's manifest, which the capture-backed build reads with `captures/sidebar.json`, at the
 * docs app frame demo's `h-[28rem]` height, which its root's `h-full` takes.
 */
export const SIDEBAR_MANIFEST: SetManifest = {
  key: "sidebar",
  name: "Sidebar",
  api: { page: "sidebar", parts: ["Sidebar.Root"] },
  slot: "sidebar-container",
  previewHeight: { pixels: SIDEBAR_PANEL_HEIGHT },
  axes: [
    { name: "variant", values: PANEL_VARIANTS },
    { name: "collapsed", values: ["false", "true"] },
  ],
  columnAxis: "collapsed",
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      key: "inner",
      slot: "sidebar-inner",
      shownIn: always,
      label: undefined,
      iconsFor: () => [],
      parts: [
        sectionManifest("header", SIDEBAR_HEADER_MANIFEST),
        {
          key: "content",
          slot: "sidebar-content",
          shownIn: always,
          label: undefined,
          iconsFor: () => [],
          parts: [
            sectionManifest("group", SIDEBAR_GROUP_MANIFEST),
            {
              key: "separator",
              slot: "sidebar-separator",
              shownIn: always,
              label: undefined,
              iconsFor: () => [],
            },
          ],
        },
        sectionManifest("footer", SIDEBAR_FOOTER_MANIFEST),
      ],
    },
  ],
  swapProperties: [],
};
