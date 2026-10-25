/**
 * Sidebar's rail widths. Runtime-free, so the `@elmeragroup/fuse/sidebar` facade re-exports them
 * from here and a Node script reads them without loading the client component.
 */

/** Desktop rail width, applied as `--sidebar-width` on the Provider wrapper. */
export const SIDEBAR_WIDTH = "16rem";
/** Mobile Sheet override of `--sidebar-width`. */
export const SIDEBAR_WIDTH_MOBILE = "18rem";
/** Icon-collapsed rail width, applied as `--sidebar-width-icon` on the Provider wrapper. */
export const SIDEBAR_WIDTH_ICON = "3rem";
