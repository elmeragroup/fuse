// Unit under test: every demo stage on the chart pages as the docs build paints it. Oracle: the
// committed baselines under `test/visual/chart/`, each captured once in the Playwright Linux image
// and reviewed in the change that wrote it. A later layer replaces a baseline only with a logged
// reason.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { decodePng } from "./png";

/**
 * The browser server's address, from `pnpm --filter docs visual:server`, which runs Playwright's
 * server in the Linux image that matches the repo's Playwright. Fonts and rasterisation differ by
 * platform, so the suite never paints in the host's own browser.
 */
// oxlint-disable-next-line turbo/no-undeclared-env-vars -- set by hand for this suite only, outside turbo
const ENDPOINT = process.env.CHART_VISUAL_ENDPOINT;
/** Writes every capture as the new baseline instead of comparing. */
// oxlint-disable-next-line turbo/no-undeclared-env-vars -- set by hand for this suite only, outside turbo
const UPDATE = process.env.CHART_VISUAL_UPDATE === "1";

/** The configured baseline directory. The repo ignores `__screenshots__/`, so it lives here. */
const BASELINES = path.join(path.dirname(fileURLToPath(import.meta.url)), "visual", "chart");

const SCHEMES = ["light", "dark"] as const;
const DENSITIES = ["dense", "comfortable"] as const;
/** Two internal brands with different palettes, Fjordkraft and Telinet. */
const BRANDS = ["fkas", "fkse"] as const;
const PAGES = ["bar-chart", "chart"] as const;

/** A channel may differ by this much, the anti-aliasing noise of one engine build. */
const CHANNEL_TOLERANCE = 8;
/** At most this share of a stage's pixels may differ before the capture fails. */
const PIXEL_SHARE = 0.001;

/** How many pixels differ by more than the channel tolerance, or `null` when the sizes differ. */
function differingPixels(actual: Uint8Array, expected: Uint8Array): number | null {
  const a = decodePng(actual);
  const b = decodePng(expected);
  if (a.width !== b.width || a.height !== b.height) return null;
  let count = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const left = a.pixel(x, y);
      const right = b.pixel(x, y);
      if (left.some((channel, index) => Math.abs(channel - (right[index] ?? 0)) > CHANNEL_TOLERANCE)) {
        count += 1;
      }
    }
  }
  return count;
}

/** Puts every stage on `page` under one scheme, density and brand. */
async function applyTheme(
  page: Page,
  scheme: (typeof SCHEMES)[number],
  density: (typeof DENSITIES)[number],
  brand: (typeof BRANDS)[number]
): Promise<void> {
  await page.evaluate(
    ({ scheme, density, brand }) => {
      document.documentElement.setAttribute("data-theme", scheme);
      document.documentElement.setAttribute("data-density", density);
      for (const stage of document.querySelectorAll("[data-demo-stage]")) {
        stage.setAttribute("data-density", density);
        stage.setAttribute("data-theme-brand", brand);
      }
    },
    { scheme, density, brand }
  );
  // Two frames let the new tokens and any container query settle.
  await page.evaluate(
    async () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
}

describe.skipIf(ENDPOINT === undefined)("chart demo baselines", () => {
  let browser: Browser | null = null;

  beforeAll(async () => {
    // The remote browser reaches the docs server on this machine's loopback through the client.
    browser = await chromium.connect(ENDPOINT ?? "", { exposeNetwork: "<loopback>" });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each(PAGES)(
    "paints every %s demo as its baseline in both schemes, both densities and two brands",
    async (slug) => {
      if (browser === null) throw new Error("no browser");
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        timezoneId: "Europe/Oslo",
        locale: "en-US",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
      const frames = page.locator("[data-demo-frame]");
      const ids = await frames.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-labelledby") ?? "")
      );
      for (let index = 0; index < ids.length; index += 1) {
        await waitForDemoHydration(frames.nth(index));
      }
      await page.evaluate(async () => document.fonts.ready.then(() => undefined));
      const failures: string[] = [];
      for (const scheme of SCHEMES) {
        for (const density of DENSITIES) {
          for (const brand of BRANDS) {
            await applyTheme(page, scheme, density, brand);
            for (const [index, id] of ids.entries()) {
              const stage = frames.nth(index).locator("[data-demo-stage]");
              await stage.scrollIntoViewIfNeeded();
              const shot = await stage.screenshot({ animations: "disabled", caret: "hide" });
              const file = path.join(BASELINES, slug, `${id}-${scheme}-${density}-${brand}.png`);
              if (UPDATE) {
                await mkdir(path.dirname(file), { recursive: true });
                await writeFile(file, shot);
                continue;
              }
              const baseline = await readFile(file).catch(() => null);
              const name = path.relative(BASELINES, file);
              if (baseline === null) {
                failures.push(`${name} has no baseline`);
                continue;
              }
              const differing = differingPixels(shot, baseline);
              const { width, height } = decodePng(shot);
              if (differing === null) failures.push(`${name} changed size`);
              else if (differing > width * height * PIXEL_SHARE) {
                failures.push(`${name} differs in ${String(differing)} pixels`);
              }
            }
          }
        }
      }
      await context.close();
      expect(failures).toEqual([]);
    },
    600_000
  );
});
