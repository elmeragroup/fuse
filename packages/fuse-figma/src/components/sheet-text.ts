/**
 * The docs Sheet "No close button" demo's copy and viewport, and the property that shows the corner
 * close, free of imports for the client bundle, which `sheet-kit.ts` draws and
 * `compare/sheet-cell.ts` renders.
 */

/** The demo's title. */
export const SHEET_TITLE = "Terms for the fixed price";

/** The demo's description. */
export const SHEET_DESCRIPTION = "The price is fixed for 12 months from the start date.";

/** The demo's footer action, `Sheet.Close` rendering an outline Button. */
export const SHEET_CLOSE_LABEL = "I have read the terms";

/**
 * The viewport the right-side panel is fixed in: Dialog's, wider than the panel's md
 * `--overlay-width`, so the panel takes that width.
 */
export const SHEET_VIEWPORT = { width: 640, height: 448 } as const;

/**
 * The BOOLEAN property that shows the corner close, `showCloseButton`'s ghost icon `Sheet.Close`. It
 * starts false, as the "No close button" demo renders the panel.
 */
export const SHEET_CORNER_CLOSE_PROPERTY = "Close button";
