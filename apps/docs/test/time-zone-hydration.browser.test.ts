import { chromium, firefox, webkit } from "playwright";
import type { Browser, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { closeContext, launchSuiteBrowser } from "./suite-browser";

/** The browser runs in Oslo, six hours ahead of the New York server. */
const BROWSER_TIME_ZONE = "Europe/Oslo";

declare global {
  /** The errors the page reported, from its first script on. */
  var hydrationErrors: string[] | undefined;
  /** The MutationObserver records inside the observed demo's stage. */
  var demoMutations: number | undefined;
  /** Reads every chart bar in the observed demo's stage. */
  var readDemoBars: (() => BarState[]) | undefined;
  /** The stage's chart bars at the moment the demo frame turned hydrated. */
  var barsAtHydration: BarState[] | undefined;
}

/** What a demo did while its page hydrated. */
type Hydration = {
  /** MutationObserver records inside the demo's stage, from before the first script ran. */
  readonly mutations: number;
  /** Uncaught and reported errors, and `console.error` calls, on the whole page. */
  readonly errors: readonly string[];
  /** The demo's table text after hydration. */
  readonly cells: readonly string[];
  /** Each chart bar in the stage once the demo's own effects ran, in document order. */
  readonly barsAtHydration: readonly BarState[];
  /** Each chart bar once every bar has hydrated. */
  readonly bars: readonly BarState[];
};

/** One `chart-bar` element: its series wrapper's ordinal, whether React owns it yet, and its `data-intro`. */
type BarState = {
  readonly series: string | null;
  readonly hydrated: boolean;
  readonly intro: string | null;
  /** The bar's running animations, which motion rule 1 keeps at 0 through hydration. */
  readonly animations: number;
};

/** Reads every chart bar in the observed stage, through the reader `hydrateDemo` installs. */
async function readBars(page: Page): Promise<BarState[]> {
  return page.evaluate(() => globalThis.readDemoBars?.() ?? []);
}

/**
 * Loads `pathname` in `browser` with the Oslo zone and counts what hydration changed in the demo
 * titled `demoName`. Next loads its chunks as async scripts, so the test holds them back until the
 * parsed page has an observer on the demo's stage, and the observer sees every mutation hydration
 * makes. React reports a recoverable hydration error through `reportError`, which fires the
 * window's `error` event, and logs some through `console.error`.
 */
async function hydrateDemo(browser: Browser, pathname: string, demoName: string): Promise<Hydration> {
  const context = await browser.newContext({ timezoneId: BROWSER_TIME_ZONE });
  await context.addInitScript(() => {
    const errors: string[] = [];
    globalThis.hydrationErrors = errors;
    window.addEventListener("error", (event) => {
      errors.push(event.message);
    });
    const consoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
      consoleError(...args);
    };
  });
  const scriptsHeld = Promise.withResolvers<undefined>();
  // Only the scripts wait. A held stylesheet would block the parser and the inline scripts.
  const isChunkScript = (url: URL): boolean =>
    url.pathname.startsWith("/_next/static/chunks/") && url.pathname.endsWith(".js");
  await context.route(isChunkScript, async (route) => {
    await scriptsHeld.promise;
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto(new URL(pathname, docsBaseUrl()).href, { waitUntil: "domcontentloaded" });
  const demo = page.getByRole("region", { name: demoName, exact: true });
  const stage = demo.locator("[data-demo-stage]");
  // React streams a finished Suspense boundary into a hidden node and moves it into place with an
  // inline script, which WebKit can run after DOMContentLoaded. The move isn't hydration, so the
  // observer starts once the stage holds its table and no pending boundary marker (`$?` or `$~`).
  await expect
    .poll(async () =>
      stage.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          if (node.nodeValue === "$?" || node.nodeValue === "$~") {
            return false;
          }
        }
        return element.querySelector("table") !== null;
      })
    )
    .toBe(true);
  await stage.evaluate((element) => {
    globalThis.demoMutations = 0;
    new MutationObserver((batch) => {
      globalThis.demoMutations = (globalThis.demoMutations ?? 0) + batch.length;
    }).observe(element, { subtree: true, childList: true, characterData: true, attributes: true });
    // React marks each DOM node it has hydrated with a `__reactFiber$` key, and a node still
    // inside a dehydrated Suspense boundary has none.
    globalThis.readDemoBars = () =>
      [...element.querySelectorAll<HTMLElement>('[data-slot="chart-bar"]')].map((bar) => ({
        series: bar.closest('[data-slot="chart-bar-series"]')?.getAttribute("data-series") ?? null,
        hydrated: Object.keys(bar).some((key) => key.startsWith("__reactFiber$")),
        intro: bar.getAttribute("data-intro"),
        animations: bar.getAnimations().length,
      }));
    // The marker stamps the frame from the demo's own passive effects, and this callback runs in
    // the microtask after, before any timer can let a late boundary hydrate.
    const frame = element.closest("[data-demo-frame]");
    if (frame === null) return;
    new MutationObserver(() => {
      if (frame.hasAttribute("data-demo-hydrated") && globalThis.barsAtHydration === undefined) {
        globalThis.barsAtHydration = globalThis.readDemoBars?.();
      }
    }).observe(frame, { attributes: true, attributeFilter: ["data-demo-hydrated"] });
  });
  scriptsHeld.resolve(undefined);
  await waitForDemoHydration(demo);
  // A Suspense boundary that resolves late hydrates after the rest of the demo, so the count waits
  // until React owns every bar.
  await expect.poll(async () => (await readBars(page)).every((bar) => bar.hydrated)).toBe(true);
  // Two frames let a client re-render of the demo's Suspense boundary commit, and the observer
  // deliver its last records.
  await page.evaluate(
    async () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
  const result = await page.evaluate(() => ({
    mutations: globalThis.demoMutations ?? -1,
    errors: globalThis.hydrationErrors ?? ["no error log"],
  }));
  const cells = await demo.getByRole("cell").allTextContents();
  const bars = await readBars(page);
  const barsAtHydration = await page.evaluate(() => globalThis.barsAtHydration ?? []);
  await closeContext(context);
  return { ...result, cells, barsAtHydration, bars };
}

describe.each([
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit],
] as const)("A New York server and an Oslo browser in %s", (_, engine) => {
  const browser = launchSuiteBrowser(engine);

  it("hydrate the market time zone demo with no mutation and no error, in Oslo hours", async () => {
    const hydration = await hydrateDemo(browser(), "/handbook/localization", "Market time zone");
    expect(hydration).toEqual({
      mutations: 0,
      errors: [],
      // CLDR nb medium date and short time: the Oslo wall clock, with 02:00 twice. Date cells write
      // every space as U+00A0.
      cells: [
        "26.\u00a0okt.\u00a02025,\u00a000:00",
        "0,412",
        "26.\u00a0okt.\u00a02025,\u00a001:00",
        "0,385",
        "26.\u00a0okt.\u00a02025,\u00a002:00",
        "0,356",
        "26.\u00a0okt.\u00a02025,\u00a002:00",
        "0,341",
        "26.\u00a0okt.\u00a02025,\u00a003:00",
        "0,367",
      ],
      barsAtHydration: [],
      bars: [],
    });
  });

  it("hydrate a Bar whose Suspense boundary resolves after the chart's first effect, with no mutation and no entrance", async () => {
    const hydration = await hydrateDemo(browser(), "/components/bar-chart", "Streamed series");
    expect(hydration.mutations).toBe(0);
    expect(hydration.errors).toEqual([]);
    // The demo holds 6 months in 2 stacked series. The grid series hydrates with the chart, so the
    // chart's effects have run, while the solar series waits 400 ms more for its readings.
    const series = (bars: readonly BarState[], hydrated: boolean): (string | null)[] =>
      bars.filter((bar) => bar.hydrated === hydrated).map((bar) => bar.series);
    expect(series(hydration.barsAtHydration, true)).toEqual(Array.from({ length: 6 }, () => "0"));
    expect(series(hydration.barsAtHydration, false)).toEqual(Array.from({ length: 6 }, () => "1"));
    // Every bar the server wrote keeps its markup, so none writes an entrance or a fade.
    expect(hydration.bars).toHaveLength(12);
    expect(hydration.bars.every((bar) => bar.hydrated && bar.intro === null)).toBe(true);
    // Motion rule 1: hydration starts no motion, before or after the late boundary resolves.
    expect(hydration.barsAtHydration.map((bar) => bar.animations)).toEqual(
      Array.from({ length: 12 }, () => 0)
    );
    expect(hydration.bars.map((bar) => bar.animations)).toEqual(Array.from({ length: 12 }, () => 0));
  });

  it("mismatch on a date demo with no zone, which the browser regenerates", async () => {
    // The negative control: the client-paged DataTable demo formats UTC midnights in the runtime's
    // zone. The server writes 30 September, and the browser rewrites the table as 1 October.
    const hydration = await hydrateDemo(browser(), "/components/data-table", "Client-paged");
    expect(hydration.mutations).toBeGreaterThan(0);
    // React 418: the server HTML didn't match what the client rendered.
    expect(hydration.errors.some((error) => error.includes("418"))).toBe(true);
    expect(hydration.cells[3]).toBe("Oct\u00a01,\u00a02026");
  });
});
