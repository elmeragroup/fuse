import type { BrowserCommand } from "vitest/node";

/**
 * Browser commands that run in the Vitest server and press or release the real mouse
 * button through Playwright. `userEvent` has no press-and-hold, so a test cannot read
 * `:active` styles without these. `test/pointer-press.ts` is the only caller.
 */
export const pointerCommands = {
  pointerDown: (async (context) => {
    await context.page.mouse.down();
  }) satisfies BrowserCommand<[]>,
  pointerUp: (async (context) => {
    await context.page.mouse.up();
  }) satisfies BrowserCommand<[]>,
};
