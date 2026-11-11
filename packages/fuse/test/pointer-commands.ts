import type { BrowserCommand } from "vitest/node";

/**
 * Browser commands that run in the Vitest server and drive the real mouse through Playwright.
 * `userEvent` has no press-and-hold, so a test cannot read `:active` styles without these.
 * `test/pointer-press.ts` calls them, and `test/page-frame-setup.ts` parks the pointer.
 */
export const pointerCommands = {
  pointerDown: (async (context) => {
    await context.page.mouse.down();
  }) satisfies BrowserCommand<[]>,
  pointerUp: (async (context) => {
    await context.page.mouse.up();
  }) satisfies BrowserCommand<[]>,
  /** Moves the pointer off the page, above and left of its corner, so it hovers nothing. */
  parkPointer: (async (context) => {
    await context.page.mouse.move(-1, -1);
  }) satisfies BrowserCommand<[]>,
};
