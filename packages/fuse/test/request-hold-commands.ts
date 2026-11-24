import type { BrowserCommand, BrowserCommandContext } from "vitest/node";

/** One hold of a URL: its route matcher, what lets its requests through, and the requests it routed. */
type Hold = {
  readonly token: number;
  readonly matches: (url: URL) => boolean;
  readonly release: () => void;
  readonly routed: Promise<void>[];
};

/** Each page's held URLs. Playwright routes belong to a page, so a hold does too. */
const holds = new WeakMap<object, Map<string, Hold>>();

let lastToken = 0;

/** Lets `hold`'s requests through and removes its route. */
async function drop(page: BrowserCommandContext["page"], hold: Hold): Promise<void> {
  hold.release();
  // Playwright falls back on the requests a removed route has not answered, so they go first.
  await Promise.allSettled(hold.routed);
  await page.unroute(hold.matches);
}

/**
 * Browser commands that run in the Vitest server and hold the page's requests to a URL in
 * Playwright, which the test frame cannot do itself. A held request keeps whatever made it, such
 * as a `FontFace`, loading until the test releases it. `test/request-hold.ts` calls them.
 */
export const requestHoldCommands = {
  // Returns the hold's token, which releases this hold and no later one of the same URL.
  holdRequest: (async ({ page }, url: string) => {
    const held = holds.get(page) ?? new Map<string, Hold>();
    holds.set(page, held);
    if (held.has(url)) throw new Error(`requests to ${url} are already held`);
    const { promise, resolve } = Promise.withResolvers<void>();
    lastToken += 1;
    const hold: Hold = {
      token: lastToken,
      matches: (requested) => requested.href === url,
      release: resolve,
      routed: [],
    };
    held.set(url, hold);
    try {
      await page.route(hold.matches, async (route) => {
        const routed = promise.then(() => route.continue());
        hold.routed.push(routed);
        await routed;
      });
    } catch (error) {
      // Playwright adds the handler before it awaits the registration, so it may already hold a
      // request. The registration's error is the one to report, whatever the release does.
      held.delete(url);
      await Promise.allSettled([drop(page, hold)]);
      throw error;
    }
    return hold.token;
  }) satisfies BrowserCommand<[string], number>,
  // Releasing a hold that ended does nothing, so a test and its teardown can both release it.
  releaseRequest: (async ({ page }, url: string, token: number) => {
    const held = holds.get(page);
    const hold = held?.get(url);
    if (hold?.token !== token) return;
    held?.delete(url);
    await drop(page, hold);
  }) satisfies BrowserCommand<[string, number]>,
};
