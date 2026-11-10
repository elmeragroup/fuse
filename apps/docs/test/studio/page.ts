import type { Browser, BrowserContext, Locator, Page } from "playwright";

import { readThemeAttributes } from "../demo-page";
import { docsBaseUrl } from "../docs-server";
import { collectPageErrors, settleFrames } from "../landing-page";

const STUDIO_DESKTOP = { width: 1440, height: 900 } as const;

/** How long a studio page waits for an element to become ready, and for the seed to load. */
const READY_TIMEOUT = 5000;

/** The Overview's artboards, by the names the canvas labels them with. */
export const ARTBOARDS = [
  "Components · Light · Comfortable",
  "Components · Dark · Comfortable",
  "Components · Light · Dense",
  "Components · Dark · Dense",
  "Theme at a glance",
] as const;

/** A studio page to open: its path, and the artboard that shows once the first fit has placed it. */
type StudioRoute = { path: string; artboard: string };

/** The Overview, at `/studio`. */
const OVERVIEW: StudioRoute = { path: "/studio", artboard: ARTBOARDS[0] };

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
async function newStudioContext(
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
 * Opens a studio page with `hash` in a new page of `context`, and waits for the app to hydrate and
 * frame the page. A click or key sent before hydration reaches no handler. Errors collect from
 * before navigation, so hydration errors count.
 *
 * @param context - The context to open the page in; the caller keeps owning it.
 * @param hash - The address's hash, such as a share link's `#1.…`.
 * @param prepare - Runs before navigation, for routes and init scripts.
 * @param route - The page to open, the Overview by default.
 */
async function openStudioIn(
  context: BrowserContext,
  hash = "",
  prepare?: (page: Page) => Promise<void>,
  route: StudioRoute = OVERVIEW
): Promise<StudioPage> {
  const page = await context.newPage();
  page.setDefaultTimeout(READY_TIMEOUT);
  const errors = collectPageErrors(page);
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await prepare?.(page);
  await page.goto(`${docsBaseUrl()}${route.path}${hash}`, { waitUntil: "load" });
  // The artboards show once the first fit has placed them, a client effect, so the page has hydrated.
  await artboard(page, route.artboard).waitFor({ state: "visible" });
  return { context, page, errors };
}

/** Opens a studio page, the Overview by default, in a fresh context the caller owns. */
export async function openStudio(
  browser: Browser,
  options: StudioContextOptions & {
    hash?: string;
    prepare?: (page: Page) => Promise<void>;
    route?: StudioRoute;
  } = {}
): Promise<StudioPage> {
  return openStudioIn(await newStudioContext(browser, options), options.hash, options.prepare, options.route);
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

/** An artboard's row in the Layers list. */
export function layer(page: Page, name: string): Locator {
  return layers(page).getByRole("button", { name, exact: true });
}

/**
 * Picks `brand` in the Brand Select inside `within`, the bar or the inspector, and waits for its
 * trigger to show it.
 */
export async function pickBrand(page: Page, within: Locator, brand: string): Promise<void> {
  const trigger = within.getByRole("combobox", { name: "Brand", exact: true });
  await trigger.click();
  await page.getByRole("option", { name: brand, exact: true }).click();
  await trigger.getByText(brand, { exact: true }).waitFor();
}

/** The `option` button of the toggle group named `group` inside `within`. */
export function toggle(within: Locator, group: string, option: string): Locator {
  return within
    .getByRole("group", { name: group, exact: true })
    .getByRole("button", { name: option, exact: true });
}

/** A box on the page, in CSS px from the viewport's top-left corner. */
export type Box = { x: number; y: number; width: number; height: number };

/** The box `locator` draws, which must have one. */
export async function box(locator: Locator): Promise<Box> {
  const measured = await locator.boundingBox();
  if (measured === null) {
    throw new Error("the element has no box");
  }
  return measured;
}

/** Whether `inner` lies inside `outer`, give or take a pixel. */
export function inside(inner: Box, outer: Box): boolean {
  return (
    inner.x >= outer.x - 1 &&
    inner.y >= outer.y - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  );
}

/** Whether `locator` is the focused element itself. */
export async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element === document.activeElement);
}

/** Whether the focused element sits inside `locator`. */
export async function holdsFocus(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element.contains(document.activeElement));
}

/** The sidebar brand's source mark on `board`: an alias such as `→ brand`, or `Literal`. */
export function sidebarBrandSource(board: Locator): Locator {
  return board.locator('[data-brand-source="sidebar-brand"] [data-source]');
}

export async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

/** The theme an artboard's scope renders, as its theme attributes name it. */
export async function themeOf(page: Page, name: string): Promise<string> {
  const { identity, brand, segment } = await readThemeAttributes(artboard(page, name));
  return [identity, brand, segment].join("-");
}

/** Waits `count` animation frames. */
export async function frames(page: Page, count: number): Promise<void> {
  for (let frame = 0; frame < count; frame++) {
    await settleFrames(page);
  }
}
