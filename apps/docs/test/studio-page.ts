import type { Browser, BrowserContext, Locator, Page } from "playwright";

import { docsBaseUrl } from "./docs-server";
import { collectPageErrors } from "./landing-page";

export const STUDIO_DESKTOP = { width: 1440, height: 900 } as const;

/** The Overview's artboards, by the names the canvas labels them with. */
export const ARTBOARDS = [
  "Components · Light · Comfortable",
  "Components · Dark · Comfortable",
  "Components · Light · Dense",
  "Components · Dark · Dense",
  "Theme at a glance",
] as const;

/** How a studio suite sets up the browser context it opens the studio in. */
export type StudioContextOptions = {
  viewport?: { width: number; height: number };
  colorScheme?: "light" | "dark";
  /** Motion is reduced by default, so camera moves land at once. */
  reducedMotion?: "reduce" | "no-preference";
  /** A touchscreen, for touch driven through CDP. */
  hasTouch?: boolean;
};

/**
 * An open studio. The test that opened it owns `context` and closes it when it is done, which
 * closes the page; a suite that leaves it open hands it to the suite browser's `afterAll`.
 */
export type StudioPage = {
  context: BrowserContext;
  page: Page;
  /** The page's uncaught errors and console errors, collected from before navigation. */
  errors: string[];
};

/** A fresh context for the studio, desktop-sized, light and with reduced motion by default. */
export async function newStudioContext(
  browser: Browser,
  {
    viewport = STUDIO_DESKTOP,
    colorScheme = "light",
    reducedMotion = "reduce",
    hasTouch = false,
  }: StudioContextOptions = {}
): Promise<BrowserContext> {
  return browser.newContext({ viewport, reducedMotion, colorScheme, hasTouch });
}

/**
 * Opens `/studio` with `hash` in a new page of `context`, and waits for the app to hydrate and
 * frame the page. A click or key sent before hydration reaches no handler. Errors collect from
 * before navigation, so hydration errors count.
 *
 * @param context - The context to open the page in; the caller keeps owning it.
 * @param hash - The address's hash, such as a share link's `#1.…`.
 * @param prepare - Runs before navigation, for routes and init scripts.
 */
export async function openStudioIn(
  context: BrowserContext,
  hash = "",
  prepare?: (page: Page) => Promise<void>
): Promise<StudioPage> {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = collectPageErrors(page);
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await prepare?.(page);
  await page.goto(`${docsBaseUrl()}/studio${hash}`, { waitUntil: "load" });
  // DOM audit: Next's router mounts its announcer once the page has hydrated.
  await page.locator("next-route-announcer").waitFor({ state: "attached" });
  // The artboards show once the first fit has placed them.
  await artboard(page, ARTBOARDS[0]).waitFor({ state: "visible" });
  return { context, page, errors };
}

/** Opens `/studio` in a fresh context the caller owns. */
export async function openStudio(
  browser: Browser,
  options: StudioContextOptions & { hash?: string; prepare?: (page: Page) => Promise<void> } = {}
): Promise<StudioPage> {
  return openStudioIn(await newStudioContext(browser, options), options.hash, options.prepare);
}

export function canvas(page: Page): Locator {
  return page.getByRole("region", { name: "Canvas", exact: true });
}

export function artboard(page: Page, name: string): Locator {
  return canvas(page).getByRole("region", { name, exact: true });
}

export function inspector(page: Page): Locator {
  return page.getByRole("complementary", { name: "Inspector", exact: true });
}

export function layers(page: Page): Locator {
  return page.getByRole("complementary", { name: "Pages and layers", exact: true });
}
