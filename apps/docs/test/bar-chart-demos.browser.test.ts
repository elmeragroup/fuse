import { AxeBuilder } from "@axe-core/playwright";
// Unit under test: the bar-chart page's scenario demos as the docs build serves them. Oracle:
// `.scratch/charts-v1/tools/l05-oracles/scenario_goldens.py`, which reads only the frozen Elhub
// responses and the hand-typed price hours. Every count and total below is copied from its output.
import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo, waitForDemoHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

/** How many elements inside `demo` carry the data-slot, optionally narrowed by an attribute. */
async function slotCount(demo: Locator, slot: string, attribute = ""): Promise<number> {
  return demo.locator(`[data-slot="${slot}"]${attribute}`).count();
}

/**
 * The visible text of each cell in the demo's chart table, header row first. A cell whose spoken
 * form differs also holds that form in an `sr-only` span, which the visible text leaves out.
 */
async function tableText(demo: Locator): Promise<{ headers: string[]; rows: string[][] }> {
  return demo.locator('[data-slot="chart-table"] table').evaluate((table: HTMLTableElement) => {
    const visible = (cell: HTMLTableCellElement): string => {
      const copy = cell.cloneNode(true);
      if (!(copy instanceof HTMLElement)) return "";
      for (const spoken of copy.querySelectorAll(".sr-only")) spoken.remove();
      return copy.textContent.trim();
    };
    return {
      headers: [...(table.tHead?.rows[0]?.cells ?? [])].map(visible),
      rows: [...table.tBodies].flatMap((body) => [...body.rows].map((row) => [...row.cells].map(visible))),
    };
  });
}

/** The body rows of the demo's chart table. */
async function tableRows(demo: Locator): Promise<string[][]> {
  return (await tableText(demo)).rows;
}

/** An en-US printed number, such as "1,234 kWh", read back as a number. */
function printedNumber(text: string): number {
  return Number(
    text
      .replaceAll(",", "")
      .replace("−", "-")
      .replaceAll(/[^\d.-]/gu, "")
  );
}

describe("bar-chart scenario demos in Chromium", () => {
  const browser = launchSuiteBrowser();

  async function demo(name: string): Promise<{ page: Page; demo: Locator }> {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    return { page, demo: await openDemo(page, "bar-chart", name) };
  }

  it("shows S06's stack total at 19:00 in the tooltip's total row", async () => {
    // The oracle's peakMwh is 3,897.232 at 19:00, which the demo's 0-digit MWh format prints as
    // 3,897. The en-US dictionary names the row "Total", and the value's space is U+00A0.
    const { page, demo: groups } = await demo("Consumption per group");
    const surface = await groups.locator('[data-slot="chart-surface"]').boundingBox();
    if (surface === null) throw new Error("no plot");
    await groups.locator('[data-slot="chart-surface"]').scrollIntoViewIfNeeded();
    const box = (await groups.locator('[data-slot="chart-surface"]').boundingBox()) ?? surface;
    await page.mouse.move(0, 0);
    await page.mouse.move(box.x + (box.width * 19.5) / 24, box.y + box.height - 4, { steps: 5 });
    const tooltip = page.locator('[data-slot="chart-tooltip"]').filter({ hasText: "Households" });
    await expect
      .poll(async () => tooltip.locator('[data-slot="chart-tooltip-label"]').textContent())
      .toBe("7\u00a0\u2013\u00a08\u00a0PM");
    expect(await tooltip.locator('[data-slot="chart-tooltip-total"] > span').allTextContents()).toEqual([
      "Total",
      "3,897\u00a0MWh",
    ]);
    await page.close();
  });

  it("draws S06's five-group stack over 24 hours, with one table row per hour", async () => {
    const { page, demo: groups } = await demo("Consumption per group");
    expect(await slotCount(groups, "chart-bar-series")).toBe(5);
    expect(await slotCount(groups, "chart-bar")).toBe(120);
    expect(await tableRows(groups)).toHaveLength(24);
    // The oracle's householdPeakMwh is 2025.464 at 19:00, which prints as 2,025 at 0 digits. The
    // hour's label follows CLDR 48's en-US `h – h a`, as in time-literals.ts.
    const { headers, rows } = await tableText(groups);
    // A series column's header is its label followed by the format's unit.
    const households = headers.findIndex((header) => header.startsWith("Households"));
    expect(households).toBeGreaterThan(0);
    const peak = rows.find((row) => row[0] === "7\u00a0\u2013\u00a08\u00a0PM");
    expect(printedNumber(peak?.[households] ?? "")).toBe(2025);
    // js5 and js7: CONTRACT section 9.3 states the stack's lowest and highest total after the
    // series, with the unit once after the label. The judge's golden.py over the frozen 16 October
    // response gives the lowest total 2,722.47 MWh at 03:00 and the highest 3,897.23 MWh at 19:00.
    // Every space inside a formatted hour range is U+00A0, CONTRACT section 9.7's canonical space.
    const description = (await groups.locator('[data-slot="chart-description"]').textContent()) ?? "";
    expect(description).toMatch(
      /Total in megawatt-hours: lowest 2,722\s3\sAM\sto\s4\sAM, highest 3,897\s7\sPM\sto\s8\sPM\./u
    );
    expect(description).toMatch(/Households in megawatt-hours: lowest [\d,]+\s/u);
    await page.close();
  });

  it("draws 25 hours on the fall-back day and 23 on the spring-forward day", async () => {
    const { page, demo: days } = await demo("Daylight saving days");
    expect(await slotCount(days, "chart-bar")).toBe(50);
    expect(await tableRows(days)).toHaveLength(25);
    await days.getByRole("button", { name: "29 March 2026" }).click();
    await expect.poll(async () => slotCount(days, "chart-bar")).toBe(46);
    expect(await tableRows(days)).toHaveLength(23);
    await page.close();
  });

  it("draws S07's month to date with one missing tick, one estimated day and 15 pending cells", async () => {
    const { page, demo: month } = await demo("Month to date");
    expect(await slotCount(month, "chart-bar")).toBe(15);
    expect(await slotCount(month, "chart-bar-missing")).toBe(1);
    expect(await slotCount(month, "chart-bar", '[data-quality="estimated"]')).toBe(1);
    // 31 slots, of which 16 hold rows, so the table lists 16 days and the plot leaves 15 cells empty.
    expect(await tableRows(month)).toHaveLength(16);
    await page.close();
  });

  it("prints S09's change column with U+2212 on the 13 days October 2025 used less", async () => {
    const { page, demo: compared } = await demo("Month against last year");
    expect(await slotCount(compared, "chart-bar")).toBe(62);
    const { headers, rows } = await tableText(compared);
    const change = headers.indexOf("Change");
    expect(change).toBeGreaterThan(0);
    const cells = rows.map((row) => row[change] ?? "");
    expect(cells).toHaveLength(31);
    expect(cells.filter((cell) => cell.startsWith("−"))).toHaveLength(13);
    expect(cells.some((cell) => cell.startsWith("-"))).toBe(false);
    await page.close();
  });

  it("totals S10's two years of twelve months", async () => {
    const { page, demo: years } = await demo("Year against last year");
    expect(await slotCount(years, "chart-bar")).toBe(24);
    expect(await slotCount(years, "chart-bar", '[data-quality="estimated"]')).toBe(1);
    const { headers, rows } = await tableText(years);
    expect(rows).toHaveLength(12);
    const total = (label: string): number => {
      const column = headers.findIndex((header) => header.startsWith(label));
      expect(column, label).toBeGreaterThan(0);
      return rows.reduce((sum, row) => sum + printedNumber(row[column] ?? ""), 0);
    };
    expect(total("This year")).toBe(13_911);
    expect(total("Last year")).toBe(13_678);
    await page.close();
  });

  it("emphasises S14's three highest days, draws their 2.1723 kWh average under the step limit and names their peak hours", async () => {
    const { page, demo: step } = await demo("Capacity step");
    expect(await slotCount(step, "chart-bar")).toBe(31);
    expect(await slotCount(step, "chart-bar", "[data-emphasis]")).toBe(3);
    // The line prints the average to the config's 2 fraction digits.
    await expect.poll(async () => step.getByText("Average of the top three 2.17 kWh").count()).toBe(1);
    // 31 days split the plot into 31 equal bands, so a bar's centre names its day.
    const emphasised = await step.locator('[data-slot="chart-bar"][data-emphasis]').evaluateAll((bars) =>
      bars.map((bar) => {
        // The bar's series layer covers the plot, and each day owns one band of 31.
        const plot = bar.closest('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
        const box = bar.getBoundingClientRect();
        return Math.floor(((box.left + box.width / 2 - plot.left) / plot.width) * 31) + 1;
      })
    );
    expect(emphasised.toSorted((a, b) => a - b)).toEqual([19, 30, 31]);

    // The headline prints the oracle's 2.1723 average to the config's 2 fraction digits, in the
    // en-US form of value-literals.ts, over the caption written from Figma frame 5504:20089.
    expect(await step.locator('[data-slot="chart-headline"] > span').allTextContents()).toEqual([
      "2.17\u00a0kWh",
      "Average of the hours with the highest use",
    ]);
    // The step limit is one solid line in the error tone, inside the plot now that the axis reaches it.
    const limit = step.locator('[data-slot="chart-reference-line"][data-tone="error"]');
    expect(await limit.count()).toBe(1);
    expect(await limit.getAttribute("data-variant")).toBe("solid");
    expect(await limit.getAttribute("data-outside")).toBeNull();
    expect(await limit.locator('[data-slot="chart-reference-label"]').textContent()).toBe(
      "Desired capacity limit 5\u00a0kWh"
    );

    // The step's upper limit is the tariff constant 5 kW, which lies on the 1-2-5 grid, so the
    // value axis reaches it as its top tick though the highest day is 2.218 kWh.
    const ticks = await step
      .locator('[data-slot="chart-y-tick"]')
      .evaluateAll((elements) => elements.map((element) => element.textContent));
    expect(printedNumber(ticks.at(-1) ?? "")).toBe(5);

    // The oracle's S14 peakStarts are 2025-10-31T17:00+01:00, 2025-10-30T20:00+01:00 and
    // 2025-10-19T20:00+02:00, and its peakDays and peakHours are their en-US labels, copied here.
    const peakDays = [
      "Friday,\u00a0October\u00a031",
      "Thursday,\u00a0October\u00a030",
      "Sunday,\u00a0October\u00a019",
    ];
    const peakHours = [
      "5\u00a0\u2013\u00a06\u00a0PM",
      "8\u00a0\u2013\u00a09\u00a0PM",
      "8\u00a0\u2013\u00a09\u00a0PM",
    ];
    const listed = await step
      .getByRole("list", { name: "Hours that set the step" })
      .getByRole("listitem")
      .allTextContents();
    expect(listed).toEqual(peakDays.map((day, index) => `${day}, ${peakHours[index] ?? ""}`));

    // The tooltip over October 31 names that day's peak hour.
    const lastDay = step.locator('[data-slot="chart-bar"]').nth(30);
    expect(
      await lastDay.evaluate((bar) => {
        // The bar's series layer covers the plot, and each day owns one band of 31.
        const plot = bar.closest('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
        const box = bar.getBoundingClientRect();
        return Math.floor(((box.left + box.width / 2 - plot.left) / plot.width) * 31) + 1;
      })
    ).toBe(31);
    // The plot's surface sits above the bars and takes the pointer, so the mouse moves to the
    // bar's box once the bar is in view, and the pointer cannot land on a chart above it.
    await lastDay.scrollIntoViewIfNeeded();
    const box = await lastDay.boundingBox();
    if (box === null) throw new Error("the October 31 bar has no box");
    await page.mouse.move(0, 0);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2, { steps: 5 });
    // Another demo on the page keeps its tooltip open, so the series label picks this chart's popup.
    const tooltip = page.locator('[data-slot="chart-tooltip"]').filter({ hasText: "Highest hour" });
    await expect.poll(async () => tooltip.textContent()).toContain(peakDays[0]);
    expect(await tooltip.textContent()).toContain(`Peak ${peakHours[0] ?? ""}`);
    await page.mouse.move(0, 0);

    // The switch puts the chart under nb-NO. October 26's peak is 1.8986 kWh, which prints as 1,9 at
    // 2 fraction digits. The day's label and the energy form are copied from time-literals.ts, the
    // fall-back day date, and value-literals.ts, the energy case, never from Fuse's output.
    // The listbox renders the current option, so the keyboard walks to October 26 from the end.
    const option = step.locator('[data-slot="chart-point"][tabindex="0"]');
    await option.focus();
    await page.keyboard.press("End");
    for (let press = 0; press < 5; press += 1) await page.keyboard.press("ArrowLeft");
    await expect.poll(async () => option.getAttribute("aria-posinset")).toBe("26");
    expect(await option.getAttribute("aria-label")).toBe(
      "Sunday,\u00a0October\u00a026: Highest hour 1.9\u00a0kilowatt-hours"
    );
    await step.getByRole("button", { name: "Norsk" }).click();
    await expect
      .poll(async () => option.getAttribute("aria-label"))
      .toBe("søndag\u00a026.\u00a0oktober: Highest hour 1,9\u00a0kilowattimer");
    expect(await step.locator('[data-slot="chart-headline"] > span').allTextContents()).toEqual([
      "2,17\u00a0kWh",
      "Snitt av timene med høyest strømbruk",
    ]);
    await page.close();
  });

  it("speaks S14's emphasis word in the picked locale", async () => {
    // CONTRACT section 9.4's S14 phrase: the emphasised 31 October names the days that count. The
    // demo's English word follows the switch to "teller i effekttrinnet". 2.218 kWh prints as 2.22
    // and 2,22 at the config's 2 fraction digits, the date and unit words come from time-literals.ts and
    // value-literals.ts, and the series label stays the demo's English "Highest hour".
    const { page, demo: step } = await demo("Capacity step");
    const option = step.locator('[data-slot="chart-point"][tabindex="0"]');
    await option.focus();
    await page.keyboard.press("End");
    await expect
      .poll(async () => option.getAttribute("aria-label"))
      .toBe(
        "Friday,\u00a0October\u00a031: Highest hour 2.22\u00a0kilowatt-hours, counts toward the capacity step"
      );
    await step.getByRole("button", { name: "Norsk" }).click();
    await expect
      .poll(async () => option.getAttribute("aria-label"))
      .toBe("fredag\u00a031.\u00a0oktober: Highest hour 2,22\u00a0kilowattimer, teller i effekttrinnet");
    await page.close();
  });

  it("draws S03's 96 quarters with 16 below zero", async () => {
    const { page, demo: levels } = await demo("Price levels");
    expect(await slotCount(levels, "chart-bar")).toBe(96);
    const negative = await levels
      .locator('[data-slot="chart-bar"]')
      .evaluateAll((bars) => bars.filter((bar) => bar.hasAttribute("data-negative")).length);
    expect(negative).toBe(16);
    await page.close();
  });

  it("draws S04's 96 quarters under a y axis that reaches the cap above the data", async () => {
    const { page, demo: spike } = await demo("Price spike");
    expect(await slotCount(spike, "chart-bar")).toBe(96);
    // The highest quarter is 3.665 SEK, so only the cap of 4 can reach the axis top.
    const ticks = await spike
      .locator('[data-slot="chart-y-tick"]')
      .evaluateAll((elements) => elements.map((element) => element.textContent));
    expect(printedNumber(ticks.at(-1) ?? "")).toBe(4);
    await page.close();
  });
});

/** Each scenario demo's bars per series, as shares of the plot's height, or null for no bar. */
type BarGoldens = {
  readonly demos: Record<
    string,
    { readonly series: readonly (readonly (readonly [number, number] | null)[])[] }
  >;
};

/**
 * `scenario_goldens.py <ground-truth> <this file>` writes the fixture from the frozen Elhub rows
 * and the hand-typed price hours, with a port of d3's nice loop for the value axis.
 */
// SAFETY: scenario_goldens.py writes exactly the BarGoldens shape, and the length checks below
// fail on any other.
const BAR_GOLDENS = JSON.parse(
  readFileSync(new URL("fixtures/scenario-bar-goldens.json", import.meta.url), "utf8")
) as BarGoldens;

describe("every scenario bar's top and base in Chromium", () => {
  const browser = launchSuiteBrowser();

  it.each([
    "Price levels",
    "Price spike",
    "Consumption per group",
    "Month to date",
    "Month against last year",
    "Year against last year",
    "Capacity step",
  ])("draws %s's bars at their golden tops and bases", async (name) => {
    // The ticket's golden scenario values judge: each bar's top and base, not only counts and
    // totals. An inner stack segment ends the 2 px seam short of the one above it, the stack seam
    // rule, so its golden top moves down by that seam.
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    const demo = await openDemo(page, "bar-chart", name);
    // The chart measures its plot again once the page's fonts load, which moves the text above it.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });
    const drawn = await demo
      .locator('[data-slot="chart"]')
      .first()
      .evaluate((chart) =>
        [...chart.querySelectorAll('[data-slot="chart-bar-series"]')].map((series) => {
          const plot = series.getBoundingClientRect();
          // The browser draws an SVG layer's origin on the device pixel nearest the plot's top,
          // the upper one when the top lies half way, so a bar's drawn edge lies that much off its
          // layout box.
          const origin = Math.ceil(plot.top * devicePixelRatio - 0.5) / devicePixelRatio - plot.top;
          return [...series.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => {
            const box = bar.getBoundingClientRect();
            return {
              top: box.top - plot.top + origin,
              base: box.bottom - plot.top + origin,
              inner: !bar.hasAttribute("data-stack-top"),
              height: plot.height,
            };
          });
        })
      );
    const golden = BAR_GOLDENS.demos[name]?.series ?? [];
    expect(drawn.map((series) => series.length)).toEqual(
      golden.map((series) => series.filter((pair) => pair !== null).length)
    );
    for (const [index, series] of drawn.entries()) {
      const expected = (golden[index] ?? []).filter((pair) => pair !== null);
      for (const [slot, bar] of series.entries()) {
        const [top = 0, base = 0] = expected[slot] ?? [];
        const seam = bar.inner ? 2 : 0;
        expect(
          Math.abs(bar.top - (top * bar.height + seam)),
          `${name} ${String(index)}:${String(slot)} top`
        ).toBeLessThanOrEqual(0.75);
        expect(
          Math.abs(bar.base - base * bar.height),
          `${name} ${String(index)}:${String(slot)} base`
        ).toBeLessThanOrEqual(0.75);
      }
    }
    await page.close();
  });
});

describe("the year of hours in Chromium", () => {
  const browser = launchSuiteBrowser();

  it("dates every hour in its option, row header and description, with the year", async () => {
    // CONTRACT section 9.4: a domain of more than one date leads each slot label with its date,
    // and with its year across two calendar years. Hand-derived: 1 October 2025 and 30 September
    // 2026 are both Wednesdays, and the hour ranges follow time-literals.ts's en-US forms.
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    const year = await openDemo(page, "chart", "A year of hours");
    const description = (await year.locator('[data-slot="chart-description"]').textContent()) ?? "";
    expect(description).toMatch(
      /^From Wednesday,\sOctober\s1,\s2025 to Wednesday,\sSeptember\s30,\s2026, 8,760\shours\./u
    );
    const option = year.locator('[data-slot="chart-point"][tabindex="0"]');
    await option.focus();
    await page.keyboard.press("End");
    await expect
      .poll(async () => option.getAttribute("aria-label"))
      .toMatch(/^Wednesday,\sSeptember\s30,\s2026, 11\sPM\sto\s12\sAM: Household /u);
    const rows = await tableText(year);
    expect(rows.rows[0]?.[0]).toMatch(/^Wednesday,\sOctober\s1,\s2025, 12\s–\s1\sAM$/u);
    await page.close();
  });
});

describe.each([
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit],
] as const)("axe on the chart pages in %s", (_, engine) => {
  const browser = launchSuiteBrowser(engine);

  it.each(["bar-chart", "chart"])("finds no violation in any %s demo", async (slug) => {
    // AxeBuilder reads frames through the page's context, so the page needs a context of its own.
    const context = await browser().newContext({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
    const stages = page.locator("[data-demo-stage]");
    const regions = page.getByRole("region").filter({ has: stages });
    const count = await regions.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await waitForDemoHydration(regions.nth(index));
    }
    const results = await new AxeBuilder({ page })
      .include("[data-demo-stage]")
      // The legend toggles carry a visible label, which this experimental rule checks the
      // accessible name against.
      .options({ rules: { "label-content-name-mismatch": { enabled: true } } })
      .analyze();
    expect(results.violations.map(({ id, nodes }) => `${id} ${String(nodes.length)}`)).toEqual([]);
    // The rule ran and left nothing for review. A toggle takes its name from its visible label
    // alone, so axe finds no aria-label to compare, and each toggle's name must equal that label.
    expect(results.incomplete.map(({ id }) => id)).not.toContain("label-content-name-mismatch");
    expect(
      [...results.passes, ...results.inapplicable].some(({ id }) => id === "label-content-name-mismatch")
    ).toBe(true);
    const toggles = page.locator('[data-slot="chart-legend-toggle"]');
    expect(await toggles.count()).toBeGreaterThan(0);
    for (const toggle of await toggles.all()) {
      const label = (await toggle.innerText()).trim();
      expect(await page.getByRole("button", { name: label, exact: true }).and(toggle).count(), label).toBe(1);
    }
    await context.close();
  });
});

describe("the language of a demo's locale switch in Chromium", () => {
  const browser = launchSuiteBrowser();

  it.each([
    ["chart", "Hourly usage"],
    ["chart", "A year of hours"],
    ["bar-chart", "Consumption per group"],
    ["bar-chart", "Daylight saving days"],
    ["bar-chart", "Month to date"],
    ["bar-chart", "Month against last year"],
    ["bar-chart", "Year against last year"],
    ["bar-chart", "Capacity step"],
    ["bar-chart", "Price levels"],
    ["bar-chart", "Price spike"],
  ])("marks the %s page's %s chart nb under Norsk", async (slug, name) => {
    // WCAG 3.1.2: the chart's Norwegian names sit under a lang of their own, so a screen reader
    // speaks them in Norwegian. "nb" is the BCP 47 tag for Norwegian Bokmål, and the page is "en".
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
    const demo = await openDemo(page, slug, name);
    const lang = async (): Promise<string | null> =>
      demo
        .locator('[data-slot="chart"]')
        .first()
        .evaluate((chart) => chart.closest("[lang]")?.getAttribute("lang") ?? null);
    expect(await lang()).toBe("en");
    await demo.getByRole("button", { name: "Norsk" }).click();
    await expect.poll(lang).toBe("nb");
    // The recheck: the tooltip portalled outside the lang element and read as English. Focus opens
    // it, and its portal must sit inside the demo's nb subtree.
    await demo.locator('[data-slot="chart-point"][tabindex="0"]').first().focus();
    const popup = demo.locator('[data-slot="chart-tooltip"]').first();
    await popup.waitFor({ state: "attached" });
    expect(await popup.evaluate((element) => element.closest("[lang]")?.getAttribute("lang") ?? null)).toBe(
      "nb"
    );
    await page.close();
  });
});

describe.each([
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit],
] as const)("the tooltip at 400 % zoom, a 320 × 225 viewport, in %s", (_, engine) => {
  const browser = launchSuiteBrowser(engine);

  it.each([
    ["Entrance origins", -20],
    ["Entrance origins", 10],
    ["Entrance origins", 40],
    ["Streamed series", -20],
    ["Streamed series", 10],
    ["Streamed series", 40],
  ] as const)(
    "covers %s's column only when no side holds the popup at 8 px, with the plot top at %d px",
    async (name, plotTop) => {
      // The last recheck: the popup sat on its column while the side beside it held it. CONTRACT
      // section 9.5 tests every side with the 8 px viewport inset before it overlays the plot. The
      // oracle is that inset rule, computed here from the boxes alone.
      const page = await browser().newPage({
        viewport: { width: 320, height: 225 },
        timezoneId: "Europe/Oslo",
      });
      const demo = await openDemo(page, "bar-chart", name);
      const chart = demo.locator('[data-slot="chart"]').first();
      const surface = chart.locator('[data-slot="chart-surface"]');
      await surface.evaluate((element, top) => {
        window.scrollBy(0, element.getBoundingClientRect().top - top);
      }, plotTop);
      const column = await chart.evaluate((root) => {
        const plot =
          root.querySelector('[data-slot="chart-surface"]')?.getBoundingClientRect() ?? new DOMRect();
        const count = Number(root.querySelector('[role="option"]')?.getAttribute("aria-setsize") ?? "1");
        const bars = [...root.querySelectorAll('[data-slot="chart-bar"]')]
          .map((bar) => bar.getBoundingClientRect())
          .filter((box) => box.height > 0);
        const tallest = bars.reduce((best, box) => (box.top < best.top ? box : best));
        const slot = Math.floor(((tallest.left + tallest.width / 2 - plot.left) / plot.width) * count);
        const left = plot.left + (plot.width * slot) / count;
        const right = plot.left + (plot.width * (slot + 1)) / count;
        const top = Math.min(
          ...bars.filter((box) => box.right > left && box.left < right).map((box) => box.top)
        );
        const header = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
        return { left, right, top, bottom: plot.bottom, x: (left + right) / 2, header };
      });
      await page.evaluate(() => {
        for (const open of document.querySelectorAll('[data-slot="chart-tooltip"]'))
          open.setAttribute("data-earlier", "");
      });
      // The pointer meets the column below the sticky header, which covers the page's top.
      const y = Math.min(Math.max(column.top + 4, column.header + 4), Math.min(column.bottom, 225) - 4);
      await page.mouse.move(column.x, y, { steps: 4 });
      const popup = page.locator('[data-slot="chart-tooltip"]:not([data-earlier])');
      await popup.waitFor({ state: "visible" });
      await page.waitForTimeout(250);
      const shown = await popup.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          left: box.left,
          width: box.width,
          height: box.height,
          scroll: element.scrollHeight - element.clientHeight,
        };
      });
      expect(shown.top).toBeGreaterThanOrEqual(0);
      expect(shown.bottom).toBeLessThanOrEqual(225);
      expect(shown.scroll, "rows cut off").toBeLessThanOrEqual(1);
      const inset = 8;
      const holds =
        column.top - shown.height >= inset ||
        Math.max(column.bottom, 0) + shown.height <= 225 - inset ||
        column.right + shown.width <= 320 - inset ||
        column.left - shown.width >= inset;
      // The popup may reach 1 px over the column's edge beside it, which rounding leaves.
      const covers =
        shown.left < column.right - 1 &&
        column.left + 1 < shown.right &&
        shown.top < column.bottom - 1 &&
        column.top + 1 < shown.bottom;
      if (covers) expect(holds, JSON.stringify({ shown, column })).toBe(false);
      await page.close();
    }
  );

  it.each(["Month to date", "Consumption per group"])(
    "shows all of %s's popup on a column that fills the viewport, and stays open as the pointer crosses to it",
    async (name) => {
      // The final recheck: with a column that filled the viewport, the popup held to the 17 to 38 px
      // above or below it and clipped its rows. CONTRACT section 9.5 seats it beside the column, or
      // over the plot when no side holds it. The oracle is the viewport's box and the popup's own
      // scroll size, under WCAG 1.4.10 and 1.4.13.
      const page = await browser().newPage({
        viewport: { width: 320, height: 225 },
        timezoneId: "Europe/Oslo",
      });
      const demo = await openDemo(page, "bar-chart", name);
      const chart = demo.locator('[data-slot="chart"]').first();
      // The tallest column's top goes 20 px under the viewport's top edge, where the recheck saw
      // 22 px left above it, and the column runs on past the viewport's bottom.
      const tallest = async () =>
        chart.locator('[data-slot="chart-bar"]').evaluateAll((bars) => {
          const boxes = bars.map((bar) => bar.getBoundingClientRect()).filter((box) => box.height > 0);
          const top = boxes.reduce((best, box) => (box.top < best.top ? box : best));
          return { x: top.left + top.width / 2, top: top.top, bottom: top.bottom };
        });
      const before = await tallest();
      await page.evaluate((by) => {
        window.scrollBy(0, by);
      }, before.top - 20);
      const column = await tallest();
      const target = { x: column.x, y: Math.min(column.bottom, 225) - 10 };
      // Another demo on the page keeps its tooltip open, so the popups open before the hover are
      // marked and left out.
      await page.evaluate(() => {
        for (const open of document.querySelectorAll('[data-slot="chart-tooltip"]'))
          open.setAttribute("data-earlier", "");
      });
      await page.mouse.move(target.x, target.y, { steps: 4 });
      const popup = page.locator('[data-slot="chart-tooltip"]:not([data-earlier])');
      await popup.waitFor({ state: "visible" });
      await page.waitForTimeout(250);
      const shown = await popup.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          left: box.left,
          scroll: element.scrollHeight - element.clientHeight,
          side: element.getAttribute("data-side"),
          label: element.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null,
        };
      });
      expect(shown.top).toBeGreaterThanOrEqual(0);
      expect(shown.bottom).toBeLessThanOrEqual(225);
      expect(shown.left).toBeGreaterThanOrEqual(0);
      expect(shown.right).toBeLessThanOrEqual(320);
      expect(shown.scroll, "rows cut off").toBeLessThanOrEqual(1);
      // Along the column to the popup's height, which stays on the slot, then across into the
      // popup, which touches the column. A popup above or below meets the pointer on the way.
      const inY = Math.min(Math.max(target.y, shown.top + 4), shown.bottom - 4);
      const inX = Math.min(Math.max(target.x, shown.left + 4), shown.right - 4);
      await page.mouse.move(target.x, inY, { steps: 6 });
      await page.mouse.move(inX, inY, { steps: 2 });
      await page.waitForTimeout(400);
      expect(await popup.getAttribute("data-ending-style")).toBeNull();
      expect(await popup.locator('[data-slot="chart-tooltip-label"]').textContent()).toBe(shown.label);
      await page.close();
    }
  );
});
