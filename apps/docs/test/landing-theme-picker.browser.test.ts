import type { Locator, Page, Request, Route } from "playwright";
import { describe, expect, it, onTestFinished } from "vitest";

import { DESKTOP_VIEWPORT, readThemeAttributes } from "./demo-page";
import type { ThemeAttributes } from "./demo-page";
import { brandSite, dashboard, PHONE_VIEWPORT, row, shownSide } from "./landing-dashboard";
import { expectTargets, launchLandingSuite, settleFrames } from "./landing-page";
import { box } from "./studio/page";
import type { Box } from "./studio/page";

const { openLanding } = launchLandingSuite();

/** One theme as the picker names it, and as the document must wear it. */
type Step = {
  readonly brand: string;
  readonly segment: "Private" | "Company";
  readonly identity: "Neutral" | "Branded";
  readonly attributes: ThemeAttributes;
  /** The query the page must carry once the step is applied. */
  readonly slug: string;
};

/** What the landing opens on: Elmera, private, branded, with the window on the site. */
const OPENING: Step = {
  brand: "Elmera",
  segment: "Private",
  identity: "Branded",
  attributes: { identity: "branded", brand: "elma", segment: "private" },
  slug: "branded-elma-private",
};

/** Three picks, each moving one axis: brand, then segment, then variant. */
const STEPS: readonly Step[] = [
  {
    brand: "Fjordkraft",
    segment: "Private",
    identity: "Branded",
    attributes: { identity: "branded", brand: "fkas", segment: "private" },
    slug: "branded-fkas-private",
  },
  {
    brand: "Fjordkraft",
    segment: "Company",
    identity: "Branded",
    attributes: { identity: "branded", brand: "fkas", segment: "company" },
    slug: "branded-fkas-company",
  },
  {
    brand: "Fjordkraft",
    segment: "Company",
    identity: "Neutral",
    attributes: { identity: "neutral", brand: "fkas", segment: "company" },
    slug: "neutral-fkas-company",
  },
];

/** The sticky nav, where every picker variant lives. */
function nav(page: Page): Locator {
  return page.getByRole("banner");
}

/** The nav's home link, the Fuse wordmark. */
function home(page: Page): Locator {
  return nav(page).getByRole("link", { name: "Fuse" });
}

/** The nav's theme chip. */
function trigger(page: Page): Locator {
  return nav(page).getByRole("button", { name: /^Theme/u });
}

/** The open picker: a popover or Sheet named Theme. */
function pickerDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Theme" });
}

/** Opens the picker, unless it is open already, and returns it. */
async function openPicker(page: Page): Promise<Locator> {
  // An open Sheet hides the rest of the page, the chip with it, so the open dialog comes first.
  const dialog = pickerDialog(page);
  if (!(await dialog.isVisible())) {
    await trigger(page).click();
    await dialog.waitFor();
  }
  return dialog;
}

/** Applies `step` through the picker: a brand tile, then the segment and variant toggles. */
async function choose(page: Page, step: Step): Promise<void> {
  const root = await openPicker(page);
  await root
    .getByRole("group", { name: "Brand" })
    .getByRole("button", { name: step.brand, exact: true })
    .click();
  for (const [axis, value] of [
    ["Segment", step.segment],
    ["Identity", step.identity],
  ] as const) {
    await root.getByRole("group", { name: axis }).getByRole("button", { name: value, exact: true }).click();
  }
}

/** True when `element` holds the page's focus. */
async function isFocused(element: Locator): Promise<boolean> {
  return element.evaluate((node) => node === document.activeElement);
}

async function documentTheme(page: Page): Promise<ThemeAttributes> {
  return readThemeAttributes(page.locator("html"));
}

/** The query value the page's URL carries for `theme`, or null without one. */
function urlTheme(page: Page): string | null {
  return new URL(page.url()).searchParams.get("theme");
}

/** A shared address's theme: its slug, and the attributes it must stamp. */
const SHARED = STEPS.at(-1) ?? OPENING;

/** The shared address with Elmera picked: a theme other than the opening one. */
const ELMERA_FROM_SHARED: Step = {
  brand: "Elmera",
  segment: "Company",
  identity: "Neutral",
  attributes: { identity: "neutral", brand: "elma", segment: "company" },
  slug: "neutral-elma-company",
};

/** The first step's theme: its slug, and the attributes it must stamp. */
const FIRST_PICK = STEPS[0] ?? OPENING;

/**
 * Records `<html>`'s theme attributes the moment the parser opens `<body>`, before any of its
 * content exists to paint. The parser runs pending observers before each inline script, so a
 * script inside the body cannot get in first.
 */
function recordThemeAtBody(): void {
  const observer = new MutationObserver(() => {
    if (document.querySelector("body") === null) {
      return;
    }
    observer.disconnect();
    const root = document.documentElement;
    Object.assign(window, {
      themeAtBody: {
        identity: root.getAttribute("data-theme-identity"),
        brand: root.getAttribute("data-theme-brand"),
        segment: root.getAttribute("data-theme-segment"),
      },
    });
  });
  observer.observe(document, { childList: true, subtree: true });
}

async function abortNextScripts(route: Route): Promise<void> {
  if (route.request().url().includes("/_next/") && route.request().resourceType() === "script") {
    await route.abort();
    return;
  }
  await route.continue();
}

describe("landing theme picker", () => {
  it.each([
    { address: `?theme=${SHARED.slug}`, wears: SHARED },
    { address: `?theme=${SHARED.slug}&theme=${OPENING.slug}`, wears: OPENING },
    { address: `?theme=${OPENING.slug}&theme=${SHARED.slug}`, wears: OPENING },
    { address: "?theme=not-a-theme", wears: OPENING },
  ])(
    "stamps $address's theme before the body can paint, and keeps it once hydrated",
    async ({ address, wears }) => {
      const painted = await openLanding(DESKTOP_VIEWPORT, {
        search: address,
        hydrated: false,
        prepare: async (opening) => {
          await opening.route("**/*", abortNextScripts);
          await opening.addInitScript(recordThemeAtBody);
        },
      });
      expect(
        await painted.evaluate(() => ("themeAtBody" in window ? window.themeAtBody : undefined))
      ).toEqual(wears.attributes);
      expect(await shownSide(painted)).toBe(wears.identity);
      await painted.context().close();

      const hydrated = await openLanding(DESKTOP_VIEWPORT, { search: address });
      await settleFrames(hydrated);
      expect(await documentTheme(hydrated)).toEqual(wears.attributes);
      expect(await shownSide(hydrated)).toBe(wears.identity);
      await hydrated.context().close();
    }
  );

  it("lands the home link on the opening theme after a pick on the plain address, and Back and Forward on each", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    // The route names the opening theme both before and after the pick; only the address changed.
    await choose(page, FIRST_PICK);
    await expect.poll(() => urlTheme(page)).toBe(FIRST_PICK.slug);
    await home(page).click();
    await expect.poll(() => urlTheme(page)).toBeNull();
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);

    // Back returns to the entry the pick rewrote, so it wears the picked theme again.
    await page.goBack();
    await expect.poll(() => urlTheme(page)).toBe(FIRST_PICK.slug);
    await expect.poll(async () => documentTheme(page)).toEqual(FIRST_PICK.attributes);
    expect(await trigger(page).getAttribute("aria-label")).toBe("Theme: Fjordkraft · Private · Branded");

    await page.goForward();
    await expect.poll(() => urlTheme(page)).toBeNull();
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);
    expect(await trigger(page).getAttribute("aria-label")).toBe("Theme: Elmera · Private · Branded");
    await page.context().close();
  });

  it("keeps announcing while the phone's Sheet hides the rest of the page", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    await choose(page, FIRST_PICK);
    // The Sheet stays open: the region must stay out of its modal hiding.
    expect(await pickerDialog(page).isVisible()).toBe(true);
    // A region under `aria-hidden` has no role a query could reach, so the check reads the attribute.
    const region = page.locator("[role='status']").filter({ hasText: /^Theme:/u });
    await expect.poll(async () => region.textContent()).toBe("Theme: Fjordkraft, private, branded, system");
    expect(
      await region.evaluate((element) => element.closest("[aria-hidden='true'], [inert]") === null)
    ).toBe(true);
    await page.context().close();
  });

  it("opens on a phone with every axis in reach", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    expect(await trigger(page).isVisible()).toBe(true);
    const root = await openPicker(page);
    for (const axis of ["Brand", "Segment", "Identity", "Colour scheme"]) {
      await root.getByRole("group", { name: axis }).waitFor();
    }

    await choose(page, SHARED);
    await expect.poll(async () => documentTheme(page)).toEqual(SHARED.attributes);
    await page.context().close();
  });

  it("gives every picker control a target at least 24px in both directions", async () => {
    for (const viewport of [DESKTOP_VIEWPORT, PHONE_VIEWPORT]) {
      const page = await openLanding(viewport);
      await expectTargets(nav(page), `nav at ${String(viewport.width)}px`);
      const root = await openPicker(page);
      await expectTargets(root, `picker open at ${String(viewport.width)}px`);
      await page.context().close();
    }
  });
});

/** Whether `request` is a Next router prefetch, not the request a click or a load made. */
function isPrefetch(request: Request): boolean {
  return request.headers()["next-router-prefetch"] !== undefined;
}

/** A page's requests held at the network until the test lets them through. */
type HeldPage = {
  /** Resolves once the click's own request, any request but a prefetch, is held. */
  readonly holding: Promise<void>;
  /** Lets every held request through. */
  readonly release: () => void;
};

/**
 * Holds every request for `pathname`, prefetches included, so the page a click opens stays
 * loading until the test releases it. The first `passing` requests go through, as the landing's
 * own document does when the test holds `/`. The test's end releases whatever is still held, so a
 * failing step leaves no request suspended.
 *
 * While Chromium loads a document it answers no DevTools call into the page, so `evaluate` and
 * locators wait for the load to finish. Only `page.mouse`, `page.keyboard` and `page.url()` work
 * while a document request is held, and a test aims a click at a box it measured before.
 */
async function holdPage(page: Page, pathname: string, passing = 0): Promise<HeldPage> {
  const { promise: released, resolve: release } = Promise.withResolvers<void>();
  const { promise: holding, resolve: hold } = Promise.withResolvers<void>();
  onTestFinished(() => release());
  let passed = 0;
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      if (passed < passing) {
        passed += 1;
        await route.continue();
        return;
      }
      if (!isPrefetch(route.request())) {
        hold();
      }
      await released;
      // The page may have closed while the request waited.
      await route.continue().catch(() => undefined);
    }
  );
  return { holding, release };
}

/**
 * Opens the landing at `search` with the requests for `pathname` held from the start, before any
 * prefetch. The first `passing` requests go through, as `holdPage` describes.
 */
async function openHolding(
  pathname: string,
  { search = "", passing = 0 }: { search?: string; passing?: number } = {}
): Promise<{ page: Page; held: HeldPage }> {
  let held: HeldPage | undefined;
  const page = await openLanding(DESKTOP_VIEWPORT, {
    search,
    prepare: async (opening) => {
      held = await holdPage(opening, pathname, passing);
    },
  });
  if (held === undefined) throw new Error("prepare did not run");
  return { page, held };
}

/**
 * Resolves once the next request for `pathname`, other than a prefetch, finishes or fails. A
 * document request finishes after its page has committed, so the address shows where it went.
 */
function requestSettles(page: Page, pathname: string): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  const settle = (request: Request): void => {
    if (new URL(request.url()).pathname !== pathname || isPrefetch(request)) {
      return;
    }
    page.off("requestfinished", settle);
    page.off("requestfailed", settle);
    resolve();
  };
  page.on("requestfinished", settle);
  page.on("requestfailed", settle);
  return promise;
}

/** Clicks the middle of `target` with the mouse alone, which works while a document loads. */
async function clickAt(page: Page, target: Box): Promise<void> {
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
}

describe("landing theme picker during a page navigation", () => {
  const quickStart = (page: Page): Locator => page.getByRole("heading", { level: 1, name: /^Quick start/u });
  const getStarted = (page: Page): Locator => nav(page).getByRole("button", { name: "Get started" });
  /** The page's brand rail tile for `step`'s brand. Its name ends in its brand code. */
  const brandTile = (page: Page, step: Step): Locator =>
    page
      .getByRole("region", { name: /^Try it yourself/u })
      .getByRole("button", { name: `data-theme-brand="${String(step.attributes.brand)}"` });

  it.each([
    {
      via: "the nav's Get started",
      // Playwright would otherwise wait for the navigation the click starts, which stays held.
      leave: async (page: Page) => getStarted(page).click({ noWaitAfter: true }),
    },
    {
      via: "the site palette",
      leave: async (page: Page) => {
        await page.keyboard.press("Control+k");
        const palette = page.getByRole("dialog", { name: "Site search", exact: true });
        await palette.getByRole("combobox").fill("quick start");
        await palette
          .getByRole("option", { name: /^Quick start/u })
          .first()
          .waitFor();
        await page.keyboard.press("Enter");
      },
    },
  ])("finishes the page $via opened when a pick lands while it loads", async ({ leave }) => {
    const { page, held } = await openHolding("/quick-start");
    // From the opening theme, the Fjordkraft tile makes the first pick.
    const tile = brandTile(page, FIRST_PICK);
    await tile.scrollIntoViewIfNeeded();
    const tileBox = await box(tile);
    await leave(page);
    await held.holding;

    await clickAt(page, tileBox);
    await expect.poll(() => urlTheme(page)).toBe(FIRST_PICK.slug);
    held.release();

    await quickStart(page).waitFor();
    expect(new URL(page.url()).pathname).toBe("/quick-start");

    // The pick rewrote the landing's entry before the page left, so Back wears it again.
    await page.goBack();
    await expect.poll(() => urlTheme(page)).toBe(FIRST_PICK.slug);
    await expect.poll(async () => documentTheme(page)).toEqual(FIRST_PICK.attributes);
    await page.context().close();
  });

  it("stays on the landing the home link opened over a page still loading, and follows the address", async () => {
    const { page, held } = await openHolding("/quick-start", { search: `?theme=${SHARED.slug}` });
    const homeBox = await box(home(page));
    await getStarted(page).click({ noWaitAfter: true });
    await held.holding;
    const quickStartSettles = requestSettles(page, "/quick-start");
    const reachedPlainLanding = page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame() && new URL(frame.url()).search === "",
    });

    // The home link's document load replaces the quick start's, so the quick start's response,
    // let through after it, opens nothing.
    await clickAt(page, homeBox);
    held.release();
    await Promise.all([quickStartSettles, reachedPlainLanding]);
    await page.waitForLoadState("load");
    expect(new URL(page.url()).pathname).toBe("/");
    expect(urlTheme(page)).toBeNull();
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);
    await page.context().close();
  });

  it("opens the plain landing the home link asked for when a pick lands while it loads", async () => {
    // The landing's own document goes through; every later request for `/` is held.
    const { page, held } = await openHolding("/", { search: `?theme=${SHARED.slug}`, passing: 1 });
    const tile = brandTile(page, ELMERA_FROM_SHARED);
    await tile.scrollIntoViewIfNeeded();
    const tileBox = await box(tile);
    const homeBox = await box(home(page));
    const homeSettles = requestSettles(page, "/");

    await clickAt(page, homeBox);
    await held.holding;
    await clickAt(page, tileBox);
    await expect.poll(() => urlTheme(page)).toBe(ELMERA_FROM_SHARED.slug);
    held.release();
    await homeSettles;

    await expect.poll(() => urlTheme(page)).toBeNull();
    expect(new URL(page.url()).pathname).toBe("/");
    await expect.poll(async () => documentTheme(page)).toEqual(OPENING.attributes);

    // The pick rewrote the entry the home link left, so Back wears it.
    await page.goBack();
    await expect.poll(() => urlTheme(page)).toBe(ELMERA_FROM_SHARED.slug);
    await expect.poll(async () => documentTheme(page)).toEqual(ELMERA_FROM_SHARED.attributes);
    await page.context().close();
  });
});

describe("landing theme picker shortcut", () => {
  /** Opens on Fjordkraft, so the focused tile is the current brand's, not the grid's first. */
  const search = "?theme=branded-fkas-private";

  it("names ⌘J or Ctrl+J on the chip and in its tooltip", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    expect(await trigger(page).getAttribute("aria-keyshortcuts")).toBe("Meta+J Control+J");
    await trigger(page).hover();
    await expect.poll(async () => page.getByRole("tooltip").textContent()).toMatch(/^Theme(?:⌘J|CtrlJ)$/u);
    await page.context().close();
  });

  it("opens on the current brand, closes on a second press and gives focus back", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    const before = home(page);
    await before.focus();

    await page.keyboard.press("ControlOrMeta+j");
    const brand = pickerDialog(page).getByRole("group", { name: "Brand" });
    await expect
      .poll(async () => isFocused(brand.getByRole("button", { name: "Fjordkraft", exact: true })))
      .toBe(true);

    await page.keyboard.press("ControlOrMeta+j");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(before)).toBe(true);

    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page).waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(before)).toBe(true);
    await page.context().close();
  });

  it("gives focus to the chip when the side it came from went inert", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search: "?theme=neutral-fkas-private" });
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await row(app, "Jonas Eide").focus();

    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page)
      .getByRole("group", { name: "Identity" })
      .getByRole("button", { name: "Branded", exact: true })
      .click();
    await expect.poll(async () => shownSide(page)).toBe("Branded");
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(trigger(page))).toBe(true);
    await page.context().close();
  });

  it("gives focus to the chip when the site it came from was replaced", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    const site = brandSite(page, "Fjordkraft");
    await site.scrollIntoViewIfNeeded();
    await site.getByRole("link").first().focus();

    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page)
      .getByRole("group", { name: "Brand" })
      .getByRole("button", { name: "Elmera", exact: true })
      .click();
    await brandSite(page, "Elmera Group").waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => pickerDialog(page).count()).toBe(0);
    await expect.poll(async () => isFocused(trigger(page))).toBe(true);
    await page.context().close();
  });

  it("opens the Sheet on a phone", async () => {
    const page = await openLanding(PHONE_VIEWPORT, { search });
    await page.keyboard.press("ControlOrMeta+j");
    await pickerDialog(page).getByRole("group", { name: "Colour scheme" }).waitFor();
    await page.context().close();
  });

  it("leaves the shortcut to a field being typed in", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { search });
    const field = page.getByRole("textbox", { name: "Meter number" });
    await field.focus();
    await page.keyboard.press("ControlOrMeta+j");
    // Wait past a render, so a popover the shortcut opened would be in the tree.
    await settleFrames(page);
    expect(await pickerDialog(page).count()).toBe(0);
    expect(await isFocused(field)).toBe(true);
    await page.context().close();
  });
});
