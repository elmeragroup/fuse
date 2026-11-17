/**
 * Sidebar's desktop panel, as one component set on the Sidebar page, built from instances of its
 * section sets: `Sidebar`, the `sidebar` and `inset` variants, expanded and collapsed to the icon
 * rail, 4 cells. The manifest names the panel's parts and section instances, and the build reads
 * the rest from `captures/sidebar.json`.
 *
 * - The root is `sidebar-container`, the rail box, holding `sidebar-inner`, the surface, which holds
 *   the app frame demo's `Sidebar header`, a `Sidebar.Content` holding the icon collapse demo's
 *   `Sidebar group` and a `Sidebar.Separator`, and the landing dashboard's `Sidebar footer`. Each
 *   section is an instance that fills the rail, and the content takes the height the header and
 *   footer leave.
 * - Its widths are the Provider's `--sidebar-width` (16rem, 256px) and `--sidebar-width-icon` (3rem,
 *   48px). An inset rail adds its 8px padding on each side and 2px that nothing fills, 66px, 2px
 *   wider than its gap (#759).
 * - The `sidebar` variant draws its 1px edge border on the end side, so its sections draw 255px
 *   wide, or 47px in the rail. The `inset` variant pads 8px instead, on the `sidebar` fill the
 *   Provider's wrapper paints behind it, so its sections draw 240px wide, or 50px in the rail.
 * - The separator is inset 8px from each side of the content.
 * - It is as tall as the app frame demo's 28rem frame, which the Root's `h-full` takes.
 *
 * The gap beside the panel is a flow spacer and the Rail paints only on hover, so neither draws. No
 * docs demo shows a floating Sidebar, so the set has no `floating` variant.
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

/** A section as an instance of its set, expanded or collapsed with the panel. */
function sectionManifest(key: string, of: SetManifest): InstanceManifest {
  return {
    kind: "instance",
    key,
    of,
    cell: (outer) => ({ collapsed: outer.collapsed ?? "off" }),
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
  slot: "sidebar-container",
  previewHeight: { pixels: SIDEBAR_PANEL_HEIGHT },
  axes: [
    { name: "variant", values: PANEL_VARIANTS },
    { name: "collapsed", values: ["off", "on"] },
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
