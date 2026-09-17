import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll } from "vitest";

/**
 * One headless Chromium per suite file, shared by the docs and static-theme browser
 * suites. Docs-agnostic on purpose: this module imports no docs server state, so the
 * static-theme suites can borrow the lifecycle without loading the docs app.
 */
export function launchSuiteBrowser(): () => Browser {
  let launched: Browser | null = null;

  beforeAll(async () => {
    launched = await chromium.launch({ headless: true });
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
