/**
 * The docs Beacon and default demos' Tour text, which `tour-kit.ts` draws and `tour-cell.ts`
 * renders. It imports nothing, so the compare page's browser bundle can take it without the kit's
 * builder.
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

/** The default demo tour's id. */
export const TOUR_STEP_ID = "usage-overview";

/** The default demo tour's steps, in order. */
export const TOUR_STEP_STEPS = ["usage", "price"] as const;

/** The first step's title, the default of the step card's `Title` property. */
export const TOUR_STEP_TITLE = "Usage this month";

/** The first step's description, the default of the step card's `Description` property. */
export const TOUR_STEP_DESCRIPTION = "Your consumption so far, updated every hour.";

/** The count `Tour.Progress` shows at the first of two steps in en-US, the default of `Count`. */
export const TOUR_STEP_COUNT = "1 of 2";

/** The en-US labels of `Tour.Skip`, `Tour.Prev` and `Tour.Next` at the first of two steps. */
export const TOUR_STEP_ACTIONS = { skip: "Skip", back: "Back", next: "Next" } as const;
