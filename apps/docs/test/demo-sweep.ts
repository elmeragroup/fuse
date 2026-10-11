import type { Browser, ElementHandle, Locator, Page } from "playwright";

import { DENSITIES } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";

import { COMPONENT_INVENTORY } from "./component-inventory";
import { DESKTOP_VIEWPORT } from "./demo-page";
import { showsUnmeasuredPart, startDensityPass } from "./density-attribution";
import type { PartReading } from "./density-attribution";
import { docsBaseUrl } from "./docs-server";

/**
 * The demo sweep: one walk over every component page's demos, at both densities, that runs a set
 * of in-page probes on each stage and on each popup, disclosure and tooltip a demo opens. Suites
 * that read the rendered demos share one walk, so adding a probe costs its own reads, not another
 * pass over the pages.
 *
 * The density probe discovers each reveal: it records the parts an opener revealed
 * (`densityOpened`), which the walk waits on to close and the other probes scope by. So it is a
 * fixed first step, not a member of the probe set.
 */

/** Every part in the stage, or every part that appeared on the page since the last probe. */
export type ProbeScope = "stage" | "unseen";

/** An in-page probe of one demo stage, run once per stage and once per opened popup. */
export type StageProbe<Reading> = (stage: Locator, scope: ProbeScope) => Promise<readonly Reading[]>;

/** A reading with the page and density it was taken at. */
export type Located<Reading> = Reading & { readonly page: string; readonly density: Density };

type ProbeSet = Readonly<Record<string, StageProbe<object>>>;

/** Each probe's readings, in inventory order. */
export type SweepReadings<Probes extends ProbeSet> = {
  readonly [Name in keyof Probes]: Located<
    Probes[Name] extends StageProbe<infer Reading> ? Reading : never
  >[];
};

/** The discovery readings, and the other readings by probe name, as the walk collects them. */
type Collected = {
  readonly discovered: Located<PartReading>[];
  readonly probes: Map<string, Located<object>[]>;
};

/** The steps run on each reveal: the density probe first, then the probe set. */
type Steps = { readonly discover: StageProbe<PartReading>; readonly probes: ProbeSet };

/** Controls that open a popup or reveal a panel: menus, selects, dialogs, disclosures. */
const OPENERS = '[aria-haspopup]:not([aria-haspopup="false"]), [aria-expanded="false"]';

/** How long an opened popup may take to mount, or a closed one to leave. */
const POPUP_WAIT = { timeout: 2000 } as const;

/**
 * Component pages probed at once, each in its own context. A page spends most of its pass
 * waiting for popups to mount or leave, so a few side by side cut the wall time without
 * contending for the CPU.
 */
const CONCURRENT_PAGES = 4;

/** Runs the density probe, then every other probe, and files each reading under its step. */
async function runProbes(
  page: Page,
  { discover, probes }: Steps,
  collected: Collected,
  stage: Locator,
  scope: ProbeScope,
  density: Density
): Promise<void> {
  const pageName = new URL(page.url()).pathname;
  const located = <Reading extends object>(readings: readonly Reading[]): Located<Reading>[] =>
    readings.map((reading) => ({ ...reading, page: pageName, density }));
  collected.discovered.push(...located(await discover(stage, scope)));
  for (const [name, probe] of Object.entries(probes)) {
    collected.probes.get(name)?.push(...located(await probe(stage, scope)));
  }
}

/**
 * Opens each closed popup and disclosure in the stage, probes the parts it reveals, then closes
 * it again; tooltips open on hover. Each combobox input also gets a query that matches nothing,
 * so its empty state shows. An opener that reveals no visible, unmeasured part within the wait is
 * closed again without a probe, so its parts stay unprobed rather than read half-mounted.
 */
async function readOpenedParts(
  page: Page,
  stage: Locator,
  probe: (scope: ProbeScope) => Promise<void>
): Promise<void> {
  const revealed = async (): Promise<void> => {
    const shows = await page
      .waitForFunction(showsUnmeasuredPart, undefined, POPUP_WAIT)
      .then(() => true)
      .catch(() => false);
    if (shows) {
      await probe("unseen");
    }
  };
  const closed = async (opener: ElementHandle): Promise<void> => {
    await page.keyboard.press("Escape");
    if ((await opener.getAttribute("aria-expanded").catch(() => null)) === "true") {
      await opener.click({ timeout: 1000 }).catch(() => undefined);
    }
    await page.mouse.move(0, 0);
    await page
      .waitForFunction(
        () =>
          (globalThis.densityOpened ?? []).every(
            (element) => !element.isConnected || element.getBoundingClientRect().height === 0
          ),
        undefined,
        POPUP_WAIT
      )
      .catch(() => undefined);
  };
  // Types a query no option matches, reads the empty state, then restores the value.
  const searchEmpty = async (query: ElementHandle): Promise<boolean> => {
    const typed = await query
      .fill("zzzz", { timeout: 1000 })
      .then(() => true)
      .catch(() => false);
    if (typed) {
      await revealed();
      await query.fill("", { timeout: 1000 }).catch(() => undefined);
    }
    return typed;
  };
  // Handles, not locators: opening a disclosure drops it from the selector, which would shift
  // every later `nth` locator.
  const openers = await stage.locator(OPENERS).elementHandles();
  const tooltips = await stage.locator("[data-slot=tooltip-trigger]").elementHandles();
  const queries = await stage.locator('input[role="combobox"]').elementHandles();
  const open = async (opener: ElementHandle, action: "click" | "hover"): Promise<void> => {
    const opened = await (
      action === "click" ? opener.click({ timeout: 1000 }) : opener.hover({ timeout: 1000 })
    )
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      // A disabled, covered or scrolled-away opener.
      return;
    }
    await revealed();
    // A popup that mounts its own search input, such as `ComboboxInputGroupAnchor` or the phone
    // country picker, only shows its empty state for a query typed into that input. Stages are
    // portal containers, so the open popup, not the stage, scopes the search.
    for (const search of await page.locator('[data-open] input[role="combobox"]:visible').elementHandles()) {
      await searchEmpty(search);
    }
    await closed(opener);
  };
  for (const opener of openers) {
    await open(opener, "click");
  }
  for (const tooltip of tooltips) {
    await open(tooltip, "hover");
  }
  for (const query of queries) {
    if (await searchEmpty(query)) {
      await closed(query);
    }
  }
}

async function readComponentPage(
  page: Page,
  slug: string,
  steps: Steps,
  collected: Collected
): Promise<void> {
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  const stages = page.locator("[data-demo-stage]");
  await stages.first().waitFor();
  // One full pass per density: a rule that only one density's stamp activates, such as a
  // comfortable-only literal override, shows up in that pass's attribution.
  for (const density of DENSITIES) {
    await page.evaluate(startDensityPass, density);
    for (const stage of await stages.all()) {
      await stage.scrollIntoViewIfNeeded();
      const probe = (scope: ProbeScope): Promise<void> =>
        runProbes(page, steps, collected, stage, scope, density);
      await probe("stage");
      await readOpenedParts(page, stage, probe);
    }
  }
}

/**
 * Walks every component page in the inventory and runs `discover`, then `probes`, on each demo
 * stage and on each part its openers reveal. Every probe runs after `discover` on the same reveal,
 * so it may scope itself by what the density probe recorded in the page.
 *
 * @param browser - The suite's browser; each concurrent page gets its own context.
 * @param discover - The density probe, which records each reveal's parts.
 * @param probes - The other in-page probes, by name.
 * @returns The density probe's readings and each other probe's, with their page and density, in
 *   inventory order.
 */
export async function sweepDemos<Probes extends ProbeSet>(
  browser: Browser,
  discover: StageProbe<PartReading>,
  probes: Probes
): Promise<{ readonly discovered: Located<PartReading>[]; readonly probes: SweepReadings<Probes> }> {
  const slugs = [...COMPONENT_INVENTORY.keys()];
  const pending = [...slugs];
  const bySlug = new Map<string, Collected>();
  const readPages = async (): Promise<void> => {
    const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      for (let slug = pending.shift(); slug !== undefined; slug = pending.shift()) {
        const collected: Collected = {
          discovered: [],
          probes: new Map(Object.keys(probes).map((name) => [name, []])),
        };
        await readComponentPage(page, slug, { discover, probes }, collected);
        bySlug.set(slug, collected);
      }
    } finally {
      await context.close();
    }
  };
  await Promise.all(Array.from({ length: CONCURRENT_PAGES }, readPages));
  const readings = Object.fromEntries(
    Object.keys(probes).map((name) => [
      name,
      slugs.flatMap((slug) => bySlug.get(slug)?.probes.get(name) ?? []),
    ])
  );
  return {
    discovered: slugs.flatMap((slug) => bySlug.get(slug)?.discovered ?? []),
    // SAFETY: each name holds only the readings its own probe returned, which `SweepReadings` types by name.
    probes: readings as SweepReadings<Probes>,
  };
}
