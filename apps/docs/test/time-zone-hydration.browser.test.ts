import { chromium, webkit } from "playwright";
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { closeContext, launchSuiteBrowser } from "./suite-browser";
import type { SuiteBrowser } from "./suite-browser";

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
  /** The demo chart's `data-entrance` once every bar has hydrated, or null with no chart. */
  readonly entrance: string | null;
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
 * window's `error` event, and logs some through `console.error`. A chart draws its bars once the
 * browser measures the plot, so `barCount` names how many the demo draws in the end. `serverHtml`
 * edits the document's HTML before the browser parses it.
 */
async function hydrateDemo(
  browser: SuiteBrowser,
  pathname: string,
  demoName: string,
  {
    barCount = 0,
    serverHtml,
  }: { readonly barCount?: number; readonly serverHtml?: (html: string) => string } = {}
): Promise<Hydration> {
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
  if (serverHtml !== undefined) {
    // The negative control: the page's HTML as the server sent it, edited before the browser parses
    // it, so the server text and the client's first render differ where the edit lands. Only the
    // document is edited; Next's RSC fetches of the same path go through untouched.
    await context.route(
      (url) => url.pathname === pathname,
      async (route) => {
        if (route.request().resourceType() !== "document") {
          await route.continue();
          return;
        }
        const response = await route.fetch();
        await route.fulfill({ response, body: serverHtml(await response.text()) });
      }
    );
  }
  const page = await context.newPage();
  await page.goto(new URL(pathname, docsBaseUrl()).href, { waitUntil: "domcontentloaded" });
  const demo = page.getByRole("region", { name: demoName, exact: true });
  const stage = demo.locator("[data-demo-stage]");
  // React streams a finished Suspense boundary into a hidden node and moves it into place with an
  // inline script, which WebKit can run after DOMContentLoaded. The move isn't hydration, so the
  // observer starts once the stage holds its table and no pending boundary marker (`$?` or `$~`).
  await expect
    .poll(
      async () =>
        stage.evaluate((element) => {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT);
          for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            if (node.nodeValue === "$?" || node.nodeValue === "$~") {
              return false;
            }
          }
          return element.querySelector("table") !== null;
        })
      // The wait is on the server's stream, whose late boundary the demo delays by 400 ms; the
      // project's poll timeout is a hang guard, so a slow engine only waits longer.
    )
    .toBe(true);
  await stage.evaluate((element) => {
    globalThis.demoMutations = 0;
    // The server sends a chart's plot with a loader, and the browser draws the marks and places
    // the plot's followers and focus target once it measures the plot. Those writes land inside
    // plot output and are drawing, not hydration, so only records outside it count. Root writes
    // its entrance state on its figure as it draws, which is drawing too, and the x axis takes the
    // slot run's margins in its style when it measures. Any other change to the axis's style counts.
    const plotOutput = [
      '[data-slot="chart-frame"] svg',
      '[data-slot="chart-plot"]',
      '[data-slot="chart-point"]',
      '[data-slot="chart-reference-line"]',
      '[data-slot="chart-reference-area"]',
      '[data-slot="chart-active-value-line"]',
      '[data-slot="chart-frame"] > [data-slot="chart-active-value"]',
    ].join(", ");
    // A style's declarations, less the slot run's margins.
    const unmargined = (style: string | null): string =>
      (style ?? "")
        .split(";")
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration !== "" && !/^--_run-(?:before|after)\s*:/u.test(declaration))
        .join("; ");
    const drawn = (record: MutationRecord): boolean => {
      if (record.attributeName === "data-entrance") return true;
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const axis = target?.matches('[data-slot="chart-x-axis"]') === true;
      if (axis && record.attributeName === "style") {
        return unmargined(record.oldValue) === unmargined(target.getAttribute("style"));
      }
      return target?.closest(plotOutput) !== null && target?.closest(plotOutput) !== undefined;
    };
    new MutationObserver((batch) => {
      globalThis.demoMutations =
        (globalThis.demoMutations ?? 0) + batch.filter((record) => !drawn(record)).length;
    }).observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
    });
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
  // A Suspense boundary that resolves late hydrates after the rest of the demo, and only then draws
  // its bars, so the count waits until every bar is drawn and React owns each one.
  await expect
    .poll(async () => {
      const drawn = await readBars(page);
      return drawn.length === barCount && drawn.every((bar) => bar.hydrated);
    })
    .toBe(true);
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
  const entrance = await stage.evaluate(
    (element) => element.querySelector('[data-slot="chart"]')?.getAttribute("data-entrance") ?? null
  );
  await closeContext(context);
  return { ...result, cells, barsAtHydration, bars, entrance };
}

describe.each([
  ["Chromium", chromium],
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
      entrance: null,
    });
  });

  it("report a server text the client renders differently, as the negative control", async () => {
    // The harness must fail where hydration does: the server HTML says 0,999 where the demo
    // renders 0,412, so React reports its text mismatch (418) and the client rewrites the cell.
    const hydration = await hydrateDemo(browser(), "/handbook/localization", "Market time zone", {
      serverHtml: (html) => {
        expect(html).toContain(">0,412<");
        return html.replace(">0,412<", ">0,999<");
      },
    });
    expect(hydration.mutations).toBeGreaterThan(0);
    expect(hydration.errors.some((error) => error.includes("418"))).toBe(true);
    expect(hydration.cells[1]).toBe("0,412");
  });

  it("hydrate a Bar whose Suspense boundary resolves after the chart's first effect, with no mutation, into the waiting entrance", async () => {
    const hydration = await hydrateDemo(browser(), "/components/bar-chart", "Streamed series", {
      barCount: 12,
    });
    expect(hydration.mutations).toBe(0);
    expect(hydration.errors).toEqual([]);
    // The demo holds 6 months in 2 stacked series. The grid series hydrates with the chart, so the
    // chart's effects have run and its bars are drawn, while the solar series waits 400 ms more for
    // its readings and draws nothing until its boundary hydrates.
    const series = (bars: readonly BarState[], hydrated: boolean): (string | null)[] =>
      bars.filter((bar) => bar.hydrated === hydrated).map((bar) => bar.series);
    expect(series(hydration.barsAtHydration, true)).toEqual(Array.from({ length: 6 }, () => "0"));
    expect(series(hydration.barsAtHydration, false)).toEqual([]);
    // The demo sits below the fold of the 1280 × 720 page, so its entrance waits. The server wrote
    // no bar. Each one the browser draws once it measures the plot, the late series' after its
    // boundary hydrates, at its base in the waiting entrance, so none writes a fade.
    expect(hydration.entrance).toBe("waiting");
    expect(hydration.bars).toHaveLength(12);
    expect(hydration.bars.every((bar) => bar.hydrated && bar.intro === null)).toBe(true);
    // Motion rule 1: hydration starts no motion, before or after the late boundary resolves.
    expect(hydration.barsAtHydration.map((bar) => bar.animations)).toEqual(
      Array.from({ length: 6 }, () => 0)
    );
    expect(hydration.bars.map((bar) => bar.animations)).toEqual(Array.from({ length: 12 }, () => 0));
  });
});
