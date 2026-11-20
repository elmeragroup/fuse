/**
 * The docs Beacon demo's Tour text, which `tour-kit.ts` draws and `tour-cell.ts` renders. It imports
 * nothing, so the compare page's browser bundle can take it without the kit's builder.
 */

/** The Beacon demo tour's id. */
export const TOUR_TIP_ID = "export-tip";

/** The Beacon demo tour's one step. */
export const TOUR_TIP_STEP = "export";

/** The step's title, the default of the set's `Title` property. */
export const TOUR_TIP_TITLE = "Export your readings";

/** The step's description, the default of the set's `Description` property. */
export const TOUR_TIP_DESCRIPTION = "Download every hourly reading as a CSV file.";

/** `Tour.Next`'s en-US label in a run of one step, where it ends the run. */
export const TOUR_TIP_DONE = "Done";
