/**
 * The block preview's viewports: the width the block lays itself out at, and the scale that fits
 * that width into the window the docs column has room for.
 *
 * Desktop fills the window, and never lays out narrower than a small laptop: a narrower window
 * shows the desktop layout scaled down rather than squeezed into the tablet one. Tablet and phone
 * are the widths of real devices, so the block's own breakpoints decide the layout, the phone's
 * a sidebar Sheet and stacked cards.
 */

/** The viewports, in the toggle's order. */
export const BLOCK_VIEWPORTS = ["desktop", "tablet", "phone"] as const;

/** One of the preview's viewports. */
export type BlockViewport = (typeof BLOCK_VIEWPORTS)[number];

/** The toggle's labels. */
export const VIEWPORT_LABELS = {
  desktop: "Desktop",
  tablet: "Tablet",
  phone: "Phone",
} as const satisfies Record<BlockViewport, string>;

/** The narrowest desktop layout, a small laptop's width in CSS pixels. */
const DESKTOP_MIN_WIDTH = 1024;

/** An iPad's portrait width, the block's `md` breakpoint, where the sidebar docks. */
const TABLET_WIDTH = 768;

/** A current iPhone's width. */
const PHONE_WIDTH = 390;

/** The layout width and the scale of the preview in a window `available` CSS pixels wide. */
export type ViewportFit = {
  /** The width the block lays out at, in CSS pixels. */
  readonly width: number;
  /** The factor the preview draws at, at most 1. */
  readonly scale: number;
};

/**
 * How the preview fits a window.
 *
 * @param viewport - The viewport the toggle picks.
 * @param available - The window's inner width, in CSS pixels.
 * @returns The block's layout width and the scale that fits it in.
 */
export function fitViewport(viewport: BlockViewport, available: number): ViewportFit {
  const width =
    viewport === "desktop"
      ? Math.max(available, DESKTOP_MIN_WIDTH)
      : viewport === "tablet"
        ? TABLET_WIDTH
        : PHONE_WIDTH;
  return { width, scale: available >= width ? 1 : available / width };
}
