import { instant } from "@next/playwright";
import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import {
  DESKTOP_VIEWPORT,
  launchSuiteBrowser,
  readThemeAttributes,
  waitForDocsShellHydration,
} from "./demo-page";
import type { ThemeAttributes } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { waitForLandingHydration } from "./landing-page";
import { OVERVIEW, artboard, canvas, layers, openStudio } from "./studio/page";

/**
 * Every route group prerenders whole (`ensureStatic = "navigation"`), so whatever a navigation
 * into it shows must already be in the build's output. `instant()` from `@next/playwright` holds
 * request-time content back until its callback ends: an initial load shows the static HTML, and a
 * client navigation shows the prefetched App Shell. Each assertion inside a scope therefore names
 * UI the user gets at once.
 */

const browser = launchSuiteBrowser();

/** The cookie `instant()` sets and Next's testing API rewrites once it captures a navigation. */
const INSTANT_COOKIE = "next-instant-navigation-testing";

/** How Next captured the scope's navigation: a document load, or a client navigation. */
type Capture = "load" | "client";

/**
 * A change to the instant cookie: a capture, a lock set to pending (by `instant()` as the scope
 * starts, or by Next as it resets a held lock), or the cookie's deletion, which releases the lock.
 */
type InstantCookieChange = Capture | "pending" | "released";

/** Where `logInstantCookie` reports: the cookie's name, and the scope's Node-side history. */
type InstantCookieWatch = { name: string; report: (change: InstantCookieChange) => void };

/**
 * Reports each change to the instant cookie in this document through `report`
 * (next/dist/client/components/segment-cache/navigation-testing-lock.js). Next writes
 * `[1, id, null]` when a locked document load starts and `[1, id, { from, to }]` each time a
 * locked client navigation commits. A traversal resets the lock to a fresh `[0, id]`, which
 * releases the data it withheld, and deleting the cookie releases the lock. Without the API, the
 * cookie keeps the `[0, id]` that `instant()` set. It runs in the page, so it names no outer
 * binding.
 */
function logInstantCookie({ name, report }: InstantCookieWatch): void {
  cookieStore.addEventListener("change", (event) => {
    for (const cookie of event.changed) {
      const value: unknown =
        cookie.name === name && cookie.value !== undefined ? JSON.parse(cookie.value) : undefined;
      if (Array.isArray(value)) {
        report(value.length < 3 ? "pending" : value[2] === null ? "load" : "client");
      }
    }
    if (event.deleted.some((cookie) => cookie.name === name)) {
      report("released");
    }
  });
}

/** The scope's cookie changes from its first one past the pending lock `instant()` set. */
function scopeChanges(history: readonly InstantCookieChange[]): InstantCookieChange[] {
  const start = history.findIndex((change) => change !== "pending");
  return start === -1 ? [] : history.slice(start);
}

/**
 * Runs `assertions` inside an `instant()` scope and requires Next to have captured the navigation
 * they drive as `capture`, and nothing after it. Without the testing API in the build, nothing
 * holds request-time content back and every assertion would pass on the finished page, so the
 * capture check is what fails such a run; it also tells a client navigation from a document load.
 * A reset, a release or a second capture before the assertions end would have let withheld data
 * in while they ran, so any change past the one capture fails the scope too. The history lives in
 * Node, so a scope that loads a second document keeps the first one's changes and fails. A
 * `"load"` scope watches from the next document the page loads.
 */
async function expectInstant(page: Page, capture: Capture, assertions: () => Promise<void>): Promise<void> {
  const history: InstantCookieChange[] = [];
  const watch: InstantCookieWatch = {
    name: INSTANT_COOKIE,
    report: (change) => {
      history.push(change);
    },
  };
  const documents = await page.addInitScript(logInstantCookie, watch, { exposeFunctions: true });
  if (capture === "client") {
    await page.evaluate(logInstantCookie, watch, { exposeFunctions: true });
  }
  try {
    await instant(
      page,
      async () => {
        await assertions();
        await expect
          .poll(() => scopeChanges(history), {
            message:
              "Next captured no navigation: was the build made with `pnpm turbo run build:e2e --filter docs`?",
          })
          .not.toEqual([]);
        expect(
          scopeChanges(history),
          "Next reset, released or captured again before the assertions ended"
        ).toEqual([capture]);
      },
      // A scope can start on a blank page, which has no origin for Next's cookie.
      { baseURL: docsBaseUrl() }
    );
  } finally {
    await documents.dispose();
  }
}

/** Opens `pathname` in a fresh context and waits until `hydrated` resolves. */
async function openPage(pathname: string, hydrated: (page: Page) => Promise<void>): Promise<Page> {
  const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}${pathname}`, { waitUntil: "domcontentloaded" });
  await hydrated(page);
  return page;
}

/** Opens a docs page in a fresh context and waits for its shell's links to hydrate. */
async function openDocsPage(pathname: string): Promise<Page> {
  return openPage(pathname, waitForDocsShellHydration);
}

/** Waits for the studio to hydrate: its Overview's artboards show once the first fit has placed them. */
async function waitForStudioOverview(page: Page): Promise<void> {
  await artboard(page, OVERVIEW.artboard).waitFor({ state: "visible" });
}

/**
 * Copies the document as the parser leaves it once `selector` first matches, before any script
 * can change what it parsed: the page as the document response serves it. The copy is
 * `window.servedDocument`. Call it before navigation. The parser can yield inside the element it
 * just opened, so the copy holds that element's attributes but maybe not all of its content:
 * to read content, name an element that follows it in document order.
 */
async function snapshotWhenParsed(page: Page, selector: string): Promise<void> {
  await page.addInitScript((target) => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(target) !== null) {
        observer.disconnect();
        Object.assign(window, { servedDocument: document.documentElement.cloneNode(true) });
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }, selector);
}

function sideNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Main navigation", exact: true });
}

function onThisPage(page: Page): Locator {
  return page.getByRole("navigation", { name: "On this page", exact: true });
}

/** The text of every link in `scope`, in document order. */
async function linkTexts(scope: Locator): Promise<string[]> {
  return scope.getByRole("link").allTextContents();
}

describe("instant client navigation in the docs App Shell", () => {
  it("shows a component page's title, lede, demos and contents from the side nav", async () => {
    const page = await openDocsPage("/components/button");
    await expectInstant(page, "client", async () => {
      await sideNav(page).getByRole("link", { name: "Badge", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/components/badge");
      const main = page.getByRole("main");
      await main.getByRole("heading", { level: 1, name: "Badge", exact: true }).waitFor();
      expect(
        await main.getByText("A small label for statuses, counts, and tags.", { exact: true }).count()
      ).toBe(1);
      for (const demo of ["Variants", "Sizes", "Status tones", "Basic"]) {
        expect(await main.getByRole("region", { name: demo, exact: true }).count(), demo).toBe(1);
      }
      expect(await linkTexts(onThisPage(page))).toEqual([
        "Variants",
        "Sizes",
        "Status tones",
        "Basic",
        "API reference",
        "Badge",
        "Tokens consumed",
      ]);
      expect(
        await sideNav(page).getByRole("link", { name: "Badge", exact: true }).getAttribute("aria-current")
      ).toBe("page");
    });
    await page.context().close();
  });

  it("shows a handbook page's title and sections from a component page", async () => {
    const page = await openDocsPage("/components/badge");
    await expectInstant(page, "client", async () => {
      await sideNav(page).getByRole("link", { name: "Theming", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/handbook/theming");
      const main = page.getByRole("main");
      await main.getByRole("heading", { level: 1, name: "Theming", exact: true }).waitFor();
      for (const section of [
        "Three axes",
        "How it resolves",
        "The document theme",
        "First paint in your framework",
      ]) {
        expect(
          await main.getByRole("heading", { level: 2, name: section, exact: true }).count(),
          section
        ).toBe(1);
      }
    });
    await page.context().close();
  });

  it("shows the date picker page's frames and sources at once, and its clock-reading demos too", async () => {
    const page = await openDocsPage("/components/badge");
    await expectInstant(page, "client", async () => {
      await sideNav(page).getByRole("link", { name: "Date Picker", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/components/date-picker");
      const main = page.getByRole("main");
      await main.getByRole("heading", { level: 1, name: "Date Picker", exact: true }).waitFor();
      const basic = main.getByRole("region", { name: "Basic", exact: true });
      expect(await basic.count()).toBe(1);
      expect(await basic.getByText("import { CalendarDate }", { exact: false }).count()).toBeGreaterThan(0);
      // The demo reads the clock, so the prerender leaves it out of the HTML. A client navigation
      // renders it in the browser from the App Shell's client reference, with no server request.
      await basic.getByRole("group", { name: "Invoice date", exact: true }).waitFor();
    });
    await page.context().close();
  });
});

describe("instant initial load of a docs page", () => {
  it("serves the date picker page without its clock-reading demos, which render on hydration", async () => {
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    // The frame's next sibling opens only once the parser has closed the frame, source and all.
    await snapshotWhenParsed(page, '[aria-labelledby="basic"] + *');
    await expectInstant(page, "load", async () => {
      await page.goto(`${docsBaseUrl()}/components/date-picker`, { waitUntil: "domcontentloaded" });
      const basic = page.getByRole("main").getByRole("region", { name: "Basic", exact: true });
      await basic.getByRole("heading", { level: 2, name: "Basic", exact: true }).waitFor();
      // React Aria's date components read the clock as they render, so the prerender leaves the
      // demo out: the served frame has its stage and its source, and the stage is empty.
      const served = await page.evaluate(() => {
        const root =
          "servedDocument" in window && window.servedDocument instanceof Element
            ? window.servedDocument
            : null;
        const frame = root?.querySelector('[aria-labelledby="basic"]');
        return {
          stage: frame?.querySelector("[data-demo-stage]")?.textContent,
          source: frame?.querySelector("[data-demo-source]")?.textContent.includes('label="Invoice date"'),
        };
      });
      expect(served).toEqual({ stage: "", source: true });
      // Hydration renders it in the browser, with request-time content still held back.
      await basic.getByRole("group", { name: "Invoice date", exact: true }).waitFor();
    });
    await context.close();
  });
});

describe("instant client navigation in the studio App Shell", () => {
  // One scope per page: a scope's release reaches the page as a cookie deletion, and if it lands
  // after the next scope set its cookie, Next's own cleanup deletes that one too, so the next
  // navigation captures nothing.
  it.each([
    {
      from: OVERVIEW,
      link: "Color",
      pathname: "/studio/color",
      artboards: ["Role pairs · Light", "Role pairs · Dark", "Primitives"],
    },
    {
      from: { path: "/studio/color", artboard: "Role pairs · Light" },
      link: "Type",
      pathname: "/studio/type",
      artboards: ["Specimen", "Type pairs · Dense", "Type pairs · Comfortable", "Font stacks"],
    },
    {
      from: { path: "/studio/type", artboard: "Specimen" },
      link: "Screens",
      pathname: "/studio/screens",
      artboards: ["Customer self-service", "Internal admin table", "Checkout form", "Settings dialog"],
    },
  ])("frames $pathname's artboards from the page list, keeping $from.path hidden", async (step) => {
    const { context, page } = await openStudio(browser(), { route: step.from });
    await expectInstant(page, "client", async () => {
      await layers(page)
        .getByRole("region", { name: "Pages", exact: true })
        .getByRole("link", { name: step.link, exact: true })
        .click();
      await page.waitForURL((url) => url.pathname === step.pathname);
      for (const name of step.artboards) {
        await artboard(page, name).waitFor({ state: "visible" });
      }
      // Next keeps the page it left mounted in a hidden Activity boundary.
      const left = step.from.artboard;
      expect(await artboard(page, left).count(), left).toBe(0);
      expect(
        await canvas(page).getByRole("region", { name: left, exact: true, includeHidden: true }).count()
      ).toBe(1);
    });
    await context.close();
  });
});

/** The landing's theme chip, whose name spells the theme the page wears. */
function themeChip(page: Page): Locator {
  return page.getByRole("banner").getByRole("button", { name: /^Theme/u });
}

/** What a landing document's theme chip and `<html>` said. */
type ServedTheme = { label: string | null; attributes: ThemeAttributes };

/** The landing's theme as the snapshot `snapshotWhenParsed` took holds it. */
async function servedTheme(page: Page): Promise<ServedTheme | undefined> {
  return page.evaluate(() => {
    const root =
      "servedDocument" in window && window.servedDocument instanceof Element ? window.servedDocument : null;
    const chip = root?.querySelector('header button[aria-label^="Theme"]');
    return root === null || chip == null
      ? undefined
      : {
          label: chip.getAttribute("aria-label"),
          attributes: {
            variant: root.getAttribute("data-theme-variant"),
            brand: root.getAttribute("data-theme-brand"),
            segment: root.getAttribute("data-theme-segment"),
          },
        };
  });
}

/**
 * Adds `search` to the first request for `/`'s data, the one Next's locked hydration makes. That
 * bootstrap fetches `location.pathname` without the query
 * (next/dist/server/app-render/instant-test-bootstrap.js), so the proxy, which rewrites `/?theme=`
 * only, would answer it with `/`'s data. The page would then hydrate as `/` and drop the query,
 * and Next would reset the lock mid-scope as the address changes. Unlocked, the document carries
 * its own data (landing-theme-picker.browser.test.ts). Until the route fires, Playwright intercepts
 * every request with the HTTP cache off, so the page's navigation waits for its own elements, not
 * `load`.
 */
async function keepQueryOnBootstrap(page: Page, search: string): Promise<void> {
  await page.route(
    (url) => url.pathname === "/" && url.searchParams.has("_rsc") && url.searchParams.size === 1,
    async (route) => {
      const url = new URL(route.request().url());
      for (const [key, value] of new URLSearchParams(search)) {
        url.searchParams.append(key, value);
      }
      await route.continue({ url: url.href });
    },
    { times: 1 }
  );
}

describe("instant landing", () => {
  it("serves / whole in the opening theme on an initial load, and hydrates it", async () => {
    const opening: ServedTheme = {
      label: "Theme: Elmera · Private · External",
      attributes: { variant: "external", brand: "elma", segment: "private" },
    };
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await snapshotWhenParsed(page, 'header button[aria-label^="Theme"]');
    await expectInstant(page, "load", async () => {
      await page.goto(`${docsBaseUrl()}/`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { level: 1, name: /^One system/u }).waitFor();
      expect(await servedTheme(page)).toEqual(opening);
      await waitForLandingHydration(page);
      expect(await themeChip(page).getAttribute("aria-label")).toBe(opening.label);
      expect(await readThemeAttributes(page.locator("html"))).toEqual(opening.attributes);
    });
    await context.close();
  });

  it("serves /?theme= whole in the shared theme on an initial load, and hydrates it", async () => {
    const shared: ServedTheme = {
      label: "Theme: Fjordkraft · Company · Internal",
      attributes: { variant: "internal", brand: "fkas", segment: "company" },
    };
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await snapshotWhenParsed(page, 'header button[aria-label^="Theme"]');
    await keepQueryOnBootstrap(page, "?theme=internal-fkas-company");
    await expectInstant(page, "load", async () => {
      await page.goto(`${docsBaseUrl()}/?theme=internal-fkas-company`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { level: 1, name: /^One system/u }).waitFor();
      expect(await servedTheme(page)).toEqual(shared);
      await waitForLandingHydration(page);
      expect(await themeChip(page).getAttribute("aria-label")).toBe(shared.label);
      expect(await readThemeAttributes(page.locator("html"))).toEqual(shared.attributes);
      expect(new URL(page.url()).search).toBe("?theme=internal-fkas-company");
    });
    await context.close();
  });

  // Each route group has a root layout of its own, so a link between groups loads a new document.
  it.each([
    {
      from: "/components/button",
      hydrated: waitForDocsShellHydration,
      role: "link",
      name: "Fuse",
      to: "/",
      heading: /^One system/u,
    },
    {
      from: "/studio",
      hydrated: waitForStudioOverview,
      role: "link",
      name: "Fuse",
      to: "/",
      heading: /^One system/u,
    },
    // The hero's call to action is a link rendered as a Button, so it keeps the button role.
    {
      from: "/",
      hydrated: waitForLandingHydration,
      role: "button",
      name: "Get started",
      to: "/quick-start",
      heading: "Quick start",
    },
  ] as const)(
    "loads $to as a new document from $from, served whole",
    async ({ from, hydrated, role, name, to, heading }) => {
      const page = await openPage(from, hydrated);
      await expectInstant(page, "load", async () => {
        // The landing offers Get started twice, in the hero and beside the install command.
        await page.getByRole(role, { name, exact: true }).filter({ visible: true }).first().click();
        await page.waitForURL((url) => url.pathname === to);
        await page.getByRole("heading", { level: 1, name: heading }).waitFor();
      });
      await page.context().close();
    }
  );

  // The landing's only client navigation is the home link from a shared theme: a theme pick
  // replaces the address without navigating. Back and Forward are traversals, which Next's testing
  // API leaves out of a scope (`resetNavigationLockToPending`), so no scope covers them.
  it("lands the home link from a shared theme on the opening theme in a client navigation", async () => {
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/?theme=internal-fkas-company`, { waitUntil: "domcontentloaded" });
    await waitForLandingHydration(page);
    await expectInstant(page, "client", async () => {
      await page.getByRole("banner").getByRole("link", { name: "Fuse", exact: true }).click();
      await page.waitForURL((url) => url.pathname === "/" && url.search === "");
      await expect
        .poll(async () => themeChip(page).getAttribute("aria-label"))
        .toBe("Theme: Elmera · Private · External");
      expect(await readThemeAttributes(page.locator("html"))).toEqual({
        variant: "external",
        brand: "elma",
        segment: "private",
      });
    });
    await context.close();
  });
});
