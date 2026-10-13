import type { Browser, BrowserContext, Locator, Page } from "playwright";

import { docsBaseUrl } from "../docs-server";
import { collectPageErrors, settleFrames } from "../landing-page";

export const STUDIO_DESKTOP = { width: 1440, height: 900 } as const;

/** The Overview's artboards, by the names the canvas labels them with. */
export const ARTBOARDS = [
  "Components · Light · Comfortable",
  "Components · Dark · Comfortable",
  "Components · Light · Dense",
  "Components · Dark · Dense",
  "Theme at a glance",
] as const;

/** A studio page to open: its path, and the artboard that shows once the first fit has placed it. */
export type StudioRoute = { path: string; artboard: string };

/** The Overview, at `/studio`. */
export const OVERVIEW: StudioRoute = { path: "/studio", artboard: ARTBOARDS[0] };

/** The Density page, ready once its dense twin shows. */
export const DENSITY_PAGE: StudioRoute = { path: "/studio/density", artboard: "Twin · Dense" };

/**
 * The Shape page, framed once its first rungs board shows. Its rung artboards pin a variant in
 * their spec; its Shells board does not.
 */
export const CORNERS_PAGE: StudioRoute = { path: "/studio/shape", artboard: "Radius rungs · Internal" };

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
 * Opens a studio page with `hash` in a new page of `context`, and waits for the app to hydrate and
 * frame the page. A click or key sent before hydration reaches no handler. Errors collect from
 * before navigation, so hydration errors count.
 *
 * @param context - The context to open the page in; the caller keeps owning it.
 * @param hash - The address's hash, such as a share link's `#1.…`.
 * @param prepare - Runs before navigation, for routes and init scripts.
 * @param route - The page to open, the Overview by default.
 */
export async function openStudioIn(
  context: BrowserContext,
  hash = "",
  prepare?: (page: Page) => Promise<void>,
  route: StudioRoute = OVERVIEW
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
  await page.goto(`${docsBaseUrl()}${route.path}${hash}`, { waitUntil: "load" });
  // DOM audit: Next's router mounts its announcer once the page has hydrated.
  await page.locator("next-route-announcer").waitFor({ state: "attached" });
  // The artboards show once the first fit has placed them.
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

/** The floating theme toolbar over the selected artboard. */
export function artboardBar(page: Page): Locator {
  return canvas(page).getByRole("toolbar", { name: "Artboard theme", exact: true });
}

/** Selects the artboard `name` from Layers and waits for its bar. */
export async function selectBoard(page: Page, name: string): Promise<Locator> {
  await layer(page, name).click();
  const bar = artboardBar(page);
  await bar.waitFor({ state: "visible" });
  return bar;
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

/** A token's row in the inspector's token editor. */
export function tokenRow(page: Page, name: string): Locator {
  return inspector(page).getByRole("group", { name: `--${name}`, exact: true });
}

/** Opens the token editor's section titled `title`, if it is closed. */
export async function openTokenSection(page: Page, title: string): Promise<void> {
  const trigger = inspector(page).getByRole("button", { name: title, exact: false }).first();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
}

/**
 * Types `value` into a color token's knob, in the edited scheme, and closes its popover.
 *
 * @param within - Where the token's row is: the inspector by default, or a theme toolbar menu.
 */
export async function setTokenColor(
  page: Page,
  name: string,
  value: string,
  within: Locator = inspector(page)
): Promise<void> {
  await within
    .getByRole("group", { name: `--${name}`, exact: true })
    .getByRole("button", { name: `Edit --${name}`, exact: true })
    .click();
  const field = page.getByRole("textbox", { name: "Color", exact: true });
  await field.fill(value);
  await page.keyboard.press("Escape");
  await field.waitFor({ state: "hidden" });
}

/** Types a metric's px for one density into its NumberField, and commits it by leaving the field. */
export async function setMetric(page: Page, name: string, density: string, px: number): Promise<void> {
  const field = inspector(page).getByRole("textbox", { name: `--${name} ${density} in px`, exact: true });
  await field.fill(String(px));
  await field.press("Tab");
}

/** A studio share hash for `json`, the version-1 share text written out by hand. */
export function hashOf(json: string): string {
  return `#1.${Buffer.from(json, "utf8").toString("base64url")}`;
}

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

export async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

/**
 * Counts `getBoundingClientRect` calls on HTML elements from now on. The wrapper sits on
 * `HTMLElement.prototype` and calls through to `Element.prototype`'s own method.
 */
export async function countLayoutReads(page: Page): Promise<() => Promise<number>> {
  await page.evaluate(() => {
    sessionStorage.setItem("layoutReads", "0");
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
      sessionStorage.setItem("layoutReads", String(Number(sessionStorage.getItem("layoutReads")) + 1));
      return Element.prototype.getBoundingClientRect.call(this);
    };
  });
  return async () => page.evaluate(() => Number(sessionStorage.getItem("layoutReads")));
}

/** Waits `count` animation frames. */
export async function frames(page: Page, count: number): Promise<void> {
  for (let frame = 0; frame < count; frame++) {
    await settleFrames(page);
  }
}
