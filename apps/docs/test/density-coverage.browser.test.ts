import type { ElementHandle, Locator, Page } from "playwright";
import { beforeAll, describe, expect, it } from "vitest";

import { DENSITIES } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";
import { DENSITY_FROZEN_CONTEXTS, PART_DENSITY, resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";
import type { DensityPart, DensityRole } from "@elmeragroup/fuse/theme-catalog";

import { COMPONENT_INVENTORY } from "./component-inventory";
import { DESKTOP_VIEWPORT, launchSuiteBrowser } from "./demo-page";
import {
  PROBED_PROPERTIES,
  probeParts,
  roleViolation,
  sentinelLengths,
  showsUnmeasuredPart,
  startDensityPass,
} from "./density-attribution";
import type { PartReading, ProbeOptions } from "./density-attribution";
import { docsBaseUrl } from "./docs-server";

/**
 * The density coverage gate. Every component page's demos are probed once per density, with the
 * document and every stage stamped, and every visible part must
 * behave as `PART_DENSITY` declares: a `control`, `row`, `surface` or `label` part reads a density
 * metric through its own properties, and a `layout` or `fixed` part reads none. Attribution is
 * `density-attribution.ts`'s; the oracle is the declared table, the unit under test the rendered
 * parts. Where one slot renders with two roles, an override key (the slot plus a CSS selector
 * suffix) splits them, and a part a frozen context names, such as a menu row in the collapsed icon rail, is checked as `fixed` there.
 */

/** One probed part on one page. */
type Instance = PartReading & { readonly page: string; readonly density: Density };

function isDensityPart(key: string): key is DensityPart {
  return Object.hasOwn(PART_DENSITY, key);
}

/** Every override key with the selector it matches a part with: `[data-slot="slot"]` plus its suffix. */
const OVERRIDES = Object.keys(PART_DENSITY).flatMap((key) => {
  const match = /^(?<slot>[a-z0-9-]+)(?<suffix>[[:].*)$/u.exec(key);
  const slot = match?.groups?.slot;
  const suffix = match?.groups?.suffix;
  return slot === undefined || suffix === undefined
    ? []
    : [{ key, selector: `[data-slot="${slot}"]${suffix}` }];
});

/** The part an instance resolves to: the first override in table order it matches, else its slot. */
function partOf({ slot, overrides }: Instance): DensityPart | undefined {
  const key = overrides[0] ?? slot;
  return isDensityPart(key) ? key : undefined;
}

/** The role an instance is checked against: `fixed` where a frozen context names its slot. */
function roleOf(instance: Instance, part: DensityPart): DensityRole {
  const frozen = DENSITY_FROZEN_CONTEXTS.some(
    ({ context, parts }) =>
      instance.contexts.includes(context) && parts.some((frozenPart) => frozenPart === instance.slot)
  );
  return frozen ? "fixed" : PART_DENSITY[part];
}

const SENTINELS = sentinelLengths(resolveThemeCatalog().density);
const CONTEXTS = DENSITY_FROZEN_CONTEXTS.map(({ context }) => context);

async function probe(
  page: Page,
  stage: Locator,
  scope: "stage" | "unseen",
  density: Density
): Promise<Instance[]> {
  const options: ProbeOptions = {
    scope,
    sentinels: SENTINELS,
    properties: PROBED_PROPERTIES,
    contexts: CONTEXTS,
    overrides: OVERRIDES,
  };
  const readings = await stage.evaluate(probeParts, options);
  const pageName = new URL(page.url()).pathname;
  return readings.map((reading) => ({ ...reading, page: pageName, density }));
}

/** Controls that open a popup or reveal a panel: menus, selects, dialogs, disclosures. */
const OPENERS = '[aria-haspopup]:not([aria-haspopup="false"]), [aria-expanded="false"]';

/** How long an opened popup may take to mount, or a closed one to leave. */
const POPUP_WAIT = { timeout: 2000 } as const;

/**
 * Opens each closed popup and disclosure in the stage, probes the parts it reveals, then closes
 * it again; tooltips open on hover. Each combobox input also gets a query that matches nothing,
 * so its empty state shows. An opener that reveals no visible, unmeasured part within the wait is
 * closed again without a probe, so its parts stay unprobed rather than read half-mounted.
 */
async function readOpenedParts(page: Page, stage: Locator, density: Density): Promise<Instance[]> {
  const instances: Instance[] = [];
  const revealed = async (): Promise<void> => {
    const shows = await page
      .waitForFunction(showsUnmeasuredPart, undefined, POPUP_WAIT)
      .then(() => true)
      .catch(() => false);
    if (shows) {
      instances.push(...(await probe(page, stage, "unseen", density)));
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
  return instances;
}

async function readComponentPage(page: Page, slug: string): Promise<Instance[]> {
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  const stages = page.locator("[data-demo-stage]");
  await stages.first().waitFor();
  const instances: Instance[] = [];
  // One full pass per density: a rule that only one density's stamp activates, such as a
  // comfortable-only literal override, shows up in that pass's attribution.
  for (const density of DENSITIES) {
    await page.evaluate(startDensityPass, density);
    for (const stage of await stages.all()) {
      await stage.scrollIntoViewIfNeeded();
      instances.push(...(await probe(page, stage, "stage", density)));
      instances.push(...(await readOpenedParts(page, stage, density)));
    }
  }
  return instances;
}

function pagesOf(instances: readonly Instance[]): string {
  return [...new Set(instances.map(({ page }) => page))].join(", ");
}

const browser = launchSuiteBrowser();
const measured: Instance[] = [];

describe("density coverage", () => {
  beforeAll(async () => {
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    for (const slug of COMPONENT_INVENTORY.keys()) {
      measured.push(...(await readComponentPage(page, slug)));
    }
    await context.close();
  }, 900_000);

  it("finds a declared role for every rendered part", () => {
    const undeclared = new Set(
      measured.filter((instance) => partOf(instance) === undefined).map(({ slot }) => slot)
    );
    expect([...undeclared].sort()).toEqual([]);
  });

  it("renders every instance of every part as its declared role", () => {
    const broken = new Map<string, Instance[]>();
    for (const instance of measured) {
      const part = partOf(instance);
      if (part === undefined) {
        continue;
      }
      const role = roleOf(instance, part);
      const reason = roleViolation(role, instance.probe);
      if (reason !== undefined) {
        const claim = `${part} is ${role} but ${reason} at ${instance.density}`;
        broken.set(claim, [...(broken.get(claim) ?? []), instance]);
      }
    }
    const report = [...broken].map(
      ([claim, instances]) => `${claim} (${String(instances.length)} on ${pagesOf(instances)})`
    );
    expect(report.sort()).toEqual([]);
  });
});
