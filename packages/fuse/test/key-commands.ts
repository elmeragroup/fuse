import type { BrowserCommand } from "vitest/node";

/**
 * Browser commands that run in the Vitest server and drive the real keyboard through Playwright.
 * `userEvent.keyboard` cannot hold a key across calls: pressing a key it holds releases it first,
 * so a repeat it sends is a `keyup` and a fresh `keydown`. Playwright's own `keyboard.down` on a
 * held key sends the auto-repeat `keydown` a held key does, with no `keyup`. `test/key-hold.ts`
 * calls them.
 */
export const keyCommands = {
  keyDown: (async (context, key: string) => {
    await context.page.keyboard.down(key);
  }) satisfies BrowserCommand<[string]>,
  keyUp: (async (context, key: string) => {
    await context.page.keyboard.up(key);
  }) satisfies BrowserCommand<[string]>,
};
