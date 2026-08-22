/**
 * The DatePicker-inside-Modal seam (date-picker.md §6, locked ruling).
 *
 * The private popover stamps `data-overlay-container="popover"` on its RAC Popover
 * element; the private modal's `shouldCloseOnInteractOutside` walks
 * `element.closest(...)` and refuses to dismiss when the interaction landed inside a
 * popover. In the reference both sides hardcoded the DOM string. Here both sides read
 * the same constants, so the coupling cannot silently drift.
 *
 * Package-private: this module is deliberately absent from `package.json#exports`.
 */
export const OVERLAY_CONTAINER_ATTR = "data-overlay-container";

/** The only overlay-container value at v1: a private RAC popover surface. */
export const OVERLAY_CONTAINER_POPOVER = "popover";

/** `closest()` selector the private modal builds from the pair above — never a literal. */
export const OVERLAY_CONTAINER_POPOVER_SELECTOR = `[${OVERLAY_CONTAINER_ATTR}="${OVERLAY_CONTAINER_POPOVER}"]`;
