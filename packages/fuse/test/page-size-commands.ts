import type { BrowserCommand } from "vitest/node";

/**
 * A browser command that runs in the Vitest server and sizes the Playwright page, which the test
 * frame cannot do itself. `test/page-frame-setup.ts` calls it when a file starts in a page smaller
 * than its frame.
 */
export const pageSizeCommands = {
  // Straight through Playwright: Vitest's own `page.viewport` skips a size its runner believes it
  // already set.
  sizePage: (async (context, width: number, height: number) => {
    await context.page.setViewportSize({ width, height });
  }) satisfies BrowserCommand<[number, number]>,
};
