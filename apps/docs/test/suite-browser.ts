import { chromium } from "playwright";
import type { Browser, BrowserContext, BrowserType } from "playwright";
import { afterAll, beforeAll } from "vitest";

/**
 * One headless browser per suite file, Chromium unless `engine` names another, shared by the docs
 * and static-theme browser suites. Docs-agnostic on purpose: this module imports no docs server
 * state, so the static-theme suites can borrow the lifecycle without loading the docs app. Call it
 * inside a `describe` block to launch one engine per block.
 */
export function launchSuiteBrowser(engine: BrowserType = chromium): () => Browser {
  let launched: Browser | null = null;

  beforeAll(async () => {
    launched = await engine.launch({ headless: true });
  });

  afterAll(async () => {
    if (launched !== null) {
      await launched.close();
      launched = null;
    }
  });

  return () => {
    if (launched === null) {
      throw new Error("The suite browser is only available between beforeAll and afterAll.");
    }
    return launched;
  };
}

/**
 * Closes `context` without failing the run. Closing disposes the context's request context first,
 * so a route handler still in `route.fetch`, or reading the response it fetched, rejects after the
 * test has passed, and Vitest fails the run on the unhandled rejection. Every route is dropped with
 * `ignoreErrors` first, which silences the handlers still in flight. A test whose route handler
 * fetches closes its context through this.
 */
export async function closeContext(context: BrowserContext): Promise<void> {
  await Promise.all([
    context.unrouteAll({ behavior: "ignoreErrors" }),
    ...context.pages().map(async (page) => page.unrouteAll({ behavior: "ignoreErrors" })),
  ]);
  await context.close();
}
