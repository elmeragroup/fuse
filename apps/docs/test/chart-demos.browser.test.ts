// Unit under test: the chart page's composed scenario demos as the docs build serves them. Oracles:
// the demos' own fixture constants, counted by hand. October 2025 has 31 days, and the October view
// stops at noon on the 31st, so 30 days hold usage and the 31st is pending. Config order puts the
// second series at data-series 1, which Down, Down and Enter select (CONTRACT section 9.4).
import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

describe("chart scenario demos in Chromium", () => {
  const browser = launchSuiteBrowser();

  async function demo(name: string): Promise<{ page: Page; demo: Locator }> {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    return { page, demo: await openDemo(page, "chart", name) };
  }

  it.each(["Usage and price", "A month of usage and price", "Total price"])(
    "selects the second series from the keyboard in %s",
    async (name) => {
      const { page, demo: chart } = await demo(name);
      // The plot's single tab stop is its listbox's option.
      await chart.getByRole("option").focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      // DOM audit: Root's data-selected and the toggle's data-series are the selection contract.
      await expect
        .poll(async () => chart.locator('[data-slot="chart"]').getAttribute("data-selected"))
        .toBe("");
      expect(
        await chart.locator('[data-slot="chart-legend-toggle"][data-series="1"]').getAttribute("aria-pressed")
      ).toBe("true");
      await page.close();
    }
  );

  it("lists S12's October days in a data table, with the 31st pending and no Sparkline", async () => {
    const { page, demo: month } = await demo("A month of usage and price");
    const days = month.getByRole("table", { name: "Usage per day, October 2025" });
    const rows = days.locator("tbody tr");
    expect(await rows.count()).toBe(31);
    const last = rows.filter({ hasText: "2025-10-31" });
    expect(await last.locator("td").nth(1).textContent()).toBe("Pending");
    // DOM audit: Sparklines are the cell renderer's output under test.
    expect(await last.locator('[data-slot="sparkline"]').count()).toBe(0);
    expect(await days.locator('[data-slot="sparkline"]').count()).toBe(30);
    // The chart's own table prints the pending usage once, beside a price.
    expect(await month.locator('[data-slot="chart-table"] td', { hasText: "no data yet" }).count()).toBe(1);
    await page.close();
  });

  it.each(["bar-chart", "line-chart", "area-chart", "sparkline", "chart"])(
    "fills its container with every chart on the %s page, inside the demo stage",
    async (slug) => {
      // The stage centres each demo root's content, which shrinks an auto grid track to its
      // content. Every chart Root, and every Sparkline at its default 100 % width, must still fill
      // its parent's content box, whatever the demo wraps it in.
      const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
      page.setDefaultTimeout(20_000);
      await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document.querySelectorAll("[data-demo-frame]").length ===
          document.querySelectorAll("[data-demo-frame][data-demo-hydrated]").length
      );
      // DOM audit: chart Roots and Sparklines are the boxes under test, located by their slots.
      const narrow = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '[data-demo-stage] :is([data-slot="chart"], [data-slot="sparkline"])'
          ),
        ]
          .filter((chart) => {
            const width = chart.computedStyleMap().get("width");
            return width instanceof CSSUnitValue && width.unit === "percent" && width.value === 100;
          })
          .flatMap((chart) => {
            const parent = chart.parentElement;
            if (parent === null) return [];
            const style = getComputedStyle(parent);
            const content =
              parent.clientWidth -
              Number.parseFloat(style.paddingLeft) -
              Number.parseFloat(style.paddingRight);
            const width = chart.getBoundingClientRect().width;
            const demo = chart.closest("[data-demo-frame]")?.getAttribute("aria-labelledby") ?? "?";
            // A grid parent's tracks and gaps fill its content box, and the chart fills its track.
            // Any other parent's content box is the chart's.
            const tracks =
              style.display === "grid"
                ? style.gridTemplateColumns.split(" ").map((track) => Number.parseFloat(track))
                : [content];
            const gaps = (tracks.length - 1) * (Number.parseFloat(style.columnGap) || 0);
            const filled = tracks.reduce((sum, track) => sum + track, 0) + gaps;
            const fits = tracks.some((track) => Math.abs(width - track) <= 1);
            // A chart Root's frame, whose grid holds the plot, fills the Root too.
            const frame = chart.querySelector(':scope > [data-slot="chart-frame"]')?.getBoundingClientRect();
            const framed = frame === undefined || Math.abs(frame.width - width) <= 1;
            return Math.abs(filled - content) > 1 || !fits || !framed
              ? [
                  `${demo}: ${String(width)} in tracks ${tracks.join(", ")} of ${String(content)} px, frame ${String(frame?.width)}`,
                ]
              : [];
          })
      );
      expect(narrow).toEqual([]);
      await page.close();
    },
    60_000
  );

  it.each(["bar-chart", "line-chart", "area-chart", "chart"])(
    "keeps every chart on the %s page inside its Frame's clip, and every Panel surface on its plots",
    async (slug) => {
      // Each demo stage sits in a Frame panel that clips what overflows it. No chart Root may run
      // past the nearest clipping ancestor. With Panels, the surface the pointer and focus use
      // spans from the first plot's top to the last plot's bottom, as on a bare page.
      const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
      page.setDefaultTimeout(20_000);
      await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document.querySelectorAll("[data-demo-frame]").length ===
          document.querySelectorAll("[data-demo-frame][data-demo-hydrated]").length
      );
      // DOM audit: chart Roots, their Panel plots and surfaces are the boxes under test.
      const faults = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-demo-stage] [data-slot="chart"]')].flatMap(
          (chart) => {
            const demo = chart.closest("[data-demo-frame]")?.getAttribute("aria-labelledby") ?? "?";
            const found: string[] = [];
            const box = chart.getBoundingClientRect();
            let clip = chart.parentElement;
            while (clip !== null && getComputedStyle(clip).overflow === "visible") clip = clip.parentElement;
            const edge = clip?.getBoundingClientRect();
            if (
              edge !== undefined &&
              (box.left < edge.left - 0.5 ||
                box.right > edge.right + 0.5 ||
                box.top < edge.top - 0.5 ||
                box.bottom > edge.bottom + 0.5)
            ) {
              found.push(`${demo}: chart past its clip`);
            }
            const plots = [
              ...chart.querySelectorAll(
                ':scope > [data-slot="chart-frame"] > [data-slot="chart-panel"] > [data-slot="chart-plot"]'
              ),
            ].map((plot) => plot.getBoundingClientRect());
            const surface = chart.querySelector('[data-slot="chart-surface"]')?.getBoundingClientRect();
            if (plots.length > 0 && surface !== undefined) {
              const top = Math.min(...plots.map((plot) => plot.top));
              const bottom = Math.max(...plots.map((plot) => plot.bottom));
              if (Math.abs(surface.top - top) > 0.5 || Math.abs(surface.bottom - bottom) > 0.5) {
                found.push(
                  `${demo}: surface ${String(surface.top)}-${String(surface.bottom)}, plots ${String(top)}-${String(bottom)}`
                );
              }
            }
            return found;
          }
        )
      );
      expect(faults).toEqual([]);
      await page.close();
    },
    60_000
  );
});
