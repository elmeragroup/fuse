// The x-tick judge of CONTRACT section 8.11, in Chromium, Firefox and WebKit: the 90-case matrix
// of the pass-2 cross-browser check, the DST days and a width sweep. The rendered label boxes are
// the oracle. They never overlap, stay inside the root, and never fall in count as the width grows.
import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { FALL_BACK_HOURS, S06_HOURS } from "../../../test/chart/elhub-rows";
import type { HourRow } from "../../../test/chart/elhub-rows";
import { intersects } from "../../../test/chart/marks";
import { renderThemed, stampDensity } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { XFormat } from "./chart-types";
import "./chart.css";
import spring from "./format/fixtures/elhub/no1-consumption-2026-03-29.json" with { type: "json" };
import year from "./format/fixtures/elhub/no1-household-hourly-2025-10_2026-09.json" with { type: "json" };
import spike from "./format/fixtures/prices/negative-spike-2026-05-24-quarter.json" with { type: "json" };

const WIDTHS = [300, 360, 480, 640, 820] as const;
const LOCALES: readonly SupportedLocale[] = ["nb-NO", "sv-SE", "fi-FI", "en-US"];

/** The 12 Oslo months of 2026, one row each. */
const MONTHS = Array.from({ length: 12 }, (_, month) => ({
  // Oslo's first of the month is 23:00 UTC the day before in winter and 22:00 in summer.
  month: new Date(Date.UTC(2026, month, 1, month >= 3 && month <= 9 ? -2 : -1)),
  kwh: 400 + month * 10,
}));

const SPRING_HOURS: HourRow[] = spring.rows
  .filter((row) => row.consumptionGroup === "household")
  .map((row) => ({
    start: new Date(row.startTime),
    household: row.quantityKwh / row.meteringPointCount,
    cabin: 0,
  }));

/** Every visible x tick's box, left to right. */
function visibleTicks(host: HTMLElement): DOMRect[] {
  // DOM audit: x ticks are aria-hidden text, and their rendered boxes are the oracle.
  return [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')]
    .filter((tick) => getComputedStyle(tick).display !== "none")
    .map((tick) => tick.getBoundingClientRect())
    .sort((a, b) => a.left - b.left);
}

/** Overlaps and overflows of the visible ticks against the root's box. */
function defects(host: HTMLElement): string[] {
  const root = host.querySelector('[data-slot="chart"]')?.getBoundingClientRect() ?? new DOMRect();
  const boxes = visibleTicks(host);
  const found: string[] = [];
  boxes.forEach((box, index) => {
    const previous = boxes[index - 1];
    if (previous !== undefined && box.left < previous.right) found.push(`overlap at ${String(index)}`);
    if (box.left < root.left - 0.5 || box.right > root.right + 0.5)
      found.push(`overflow at ${String(index)}`);
  });
  return found;
}

function monthChart(locale: SupportedLocale, format: XFormat, scale: "band" | "point", width: number) {
  return renderThemed(
    <div style={{ width, fontFamily: "var(--font-sans)" }}>
      <LocaleProvider locale={locale}>
        <Chart.Root
          data={MONTHS}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="month"
          interval="month"
          timeZone="Europe/Oslo"
          xScale={scale}
          aria-label="Forbruk per måned">
          <Chart.YAxis />
          <Chart.XAxis format={format} />
          {scale === "band" ? <Chart.Bar dataKey="kwh" /> : null}
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

function hourChart(rows: readonly HourRow[], format: XFormat, width: number) {
  return renderThemed(
    <div style={{ width, fontFamily: "var(--font-sans)" }} data-probe="">
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{ household: { label: "Forbruk", color: "chart-1" } }}
          xKey="start"
          interval="hour"
          timeZone="Europe/Oslo"
          aria-label="Forbruk per time">
          <Chart.YAxis />
          <Chart.XAxis format={format} />
          <Chart.Bar dataKey="household" />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

describe("the 90-case tick matrix", () => {
  const cases = LOCALES.flatMap((locale) =>
    (["short", "long"] as const).flatMap((month) =>
      (["point", "band"] as const).flatMap((scale) =>
        WIDTHS.map(
          (width) => [`${locale} ${month} ${scale} ${String(width)}`, locale, month, scale, width] as const
        )
      )
    )
  );

  it.each(cases)("%s", (_, locale, month, scale, width) => {
    const { host } = monthChart(locale, { month }, scale, width);
    expect(defects(host)).toEqual([]);
    expect(visibleTicks(host).length).toBeGreaterThan(0);
  });

  it.each(
    WIDTHS.flatMap((width) => (["hour", "hour-range"] as const).map((preset) => [preset, width] as const))
  )("hourly %s at %d px", (preset, width) => {
    const { host } = hourChart(S06_HOURS, preset, width);
    expect(defects(host)).toEqual([]);
  });
});

describe("tick dots", () => {
  it("paint in the muted text role, which the contrast matrix holds at 4.5:1", () => {
    // jc11: the dots painted the border role at 1.26:1, below 1.4.11's 3:1 for graphics.
    const { host } = renderThemed(
      <div style={{ width: 360 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={S06_HOURS}
            config={{ household: { label: "Forbruk", color: "chart-1" } }}
            xKey="start"
            interval="hour"
            timeZone="Europe/Oslo"
            aria-label="Forbruk per time">
            <Chart.XAxis tick="dot" />
            <Chart.Bar dataKey="household" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the dot is the tick's pseudo-element.
    const tick = host.querySelector('[data-slot="chart-x-tick"]');
    const probe = document.createElement("span");
    probe.style.color = "var(--muted-foreground)";
    host.querySelector('[data-slot="chart"]')?.append(probe);
    const dot = tick === null ? "" : getComputedStyle(tick, "::before").backgroundColor;
    expect(dot).toBe(getComputedStyle(probe).color);
    expect(dot).not.toBe("rgb(0, 0, 0)");
  });
});

describe("a year of hours", () => {
  // jc4: the committed hourly year, from 1 October 2025 in Oslo. Its labels fall back to month
  // starts, which read the ground truth's CLDR 48 nb-NO short months in slots.json, with the year
  // on 1 January.
  const rows: HourRow[] = year.values.map((household, hour) => ({
    start: new Date(Date.parse(year.start) + hour * 3_600_000),
    household,
    cabin: 0,
  }));
  const MONTH_LABELS = ["okt", "nov", "des", "2026", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep"];

  it.each(WIDTHS)("labels month starts apart at %d px and renders only the month ticks", (width) => {
    const { host } = renderThemed(
      <div style={{ width, fontFamily: "var(--font-sans)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{ household: { label: "Forbruk", color: "chart-1" } }}
            xKey="start"
            interval="hour"
            timeZone="Europe/Oslo"
            aria-label="Forbruk per time">
            <Chart.XAxis />
            <Chart.Bar dataKey="household" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    expect(defects(host)).toEqual([]);
    // DOM audit: x ticks are aria-hidden text.
    const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')];
    expect(ticks.map((tick) => tick.textContent)).toEqual(MONTH_LABELS);
    const shown = ticks.filter((tick) => getComputedStyle(tick).display !== "none");
    // A quarter of the months, at the 3-month stride, is the coarsest set the rule picks.
    expect(shown.length).toBeGreaterThanOrEqual(4);
  });

  it.each(["hour-range", "time-range"] as const)(
    "names the month starts under an explicit %s format",
    (format) => {
      const { host } = renderThemed(
        <div style={{ width: 640, fontFamily: "var(--font-sans)" }}>
          <LocaleProvider locale="nb-NO">
            <Chart.Root
              data={rows}
              config={{ household: { label: "Forbruk", color: "chart-1" } }}
              xKey="start"
              interval="hour"
              timeZone="Europe/Oslo"
              aria-label="Forbruk per time">
              <Chart.XAxis format={format} />
              <Chart.Bar dataKey="household" />
            </Chart.Root>
          </LocaleProvider>
        </div>
      );
      // DOM audit: x ticks are aria-hidden text.
      const ticks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')];
      expect(ticks.map((tick) => tick.textContent)).toEqual(MONTH_LABELS);
    }
  );
});

describe("an axis of seconds", () => {
  /** Ten seconds from 13:42:00 in Oslo on 15 January 2026, which is 12:42:00 UTC. */
  const rows = Array.from({ length: 10 }, (_, second) => ({
    at: new Date(Date.UTC(2026, 0, 15, 12, 42, second)),
    kw: 2 + (second % 3),
  }));

  it("labels each tick within one minute with its own second", () => {
    const { host } = renderThemed(
      <div style={{ width: 640, fontFamily: "var(--font-sans)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{ kw: { label: "Effekt", color: "chart-1" } }}
            xKey="at"
            interval="second"
            timeZone="Europe/Oslo"
            aria-label="Effekt per sekund">
            <Chart.XAxis />
            <Chart.Line dataKey="kw" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: x ticks are aria-hidden text.
    const texts = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')]
      .filter((tick) => getComputedStyle(tick).display !== "none")
      .map((tick) => tick.textContent);
    expect(texts.length).toBeGreaterThanOrEqual(3);
    expect(new Set(texts).size).toBe(texts.length);
    for (const text of texts) expect(text).toMatch(/^13:42:0\d$/u);
  });
});

describe("the DST days", () => {
  it.each([
    ["the fall-back day", FALL_BACK_HOURS],
    ["the spring day", SPRING_HOURS],
  ] as const)("keeps %s's labels apart at every width", (_, rows) => {
    for (const width of WIDTHS) {
      const { host, unmount } = hourChart(rows, "hour", width);
      expect(defects(host), String(width)).toEqual([]);
      unmount();
    }
  });
});

/** The negative-price day of 24 May 2026 in SE3, 96 quarter hours. */
const QUARTERS = spike.map((row) => ({ start: new Date(row.time_start), price: row.SEK_per_kWh }));

/** Twelve Oslo months from November 2025, as year-vs-last-year draws them. */
const SWEEP_MONTHS = Array.from({ length: 12 }, (_, index) => ({
  month: new Date(Date.UTC(2025, 10 + index, 1, index >= 5 && index <= 11 ? -2 : -1)),
  kwh: 900 + index * 40,
}));

/** Twelve named categories, which thin by row strides. */
const SWEEP_CATEGORIES = [
  "North",
  "South",
  "East",
  "West",
  "Coast",
  "Inland",
  "Fjord",
  "Valley",
  "Plateau",
  "Islands",
  "Harbour",
  "Border",
].map((region, index) => ({ region, kwh: 400 + index * 25 }));

/** A vertical chart's visible x labels and their defects, or a horizontal chart's value labels. */
function sweepChart(kind: "hours" | "quarters" | "months" | "categories" | "horizontal") {
  const rows =
    kind === "horizontal"
      ? ["January", "February", "March", "April"].map((month, index) => ({ month, kwh: 50 + index * 100 }))
      : [];
  return renderThemed(
    <div style={{ width: 160, fontFamily: "var(--font-sans)" }} data-probe="">
      <LocaleProvider locale="en-US">
        {kind === "hours" ? (
          <Chart.Root
            data={S06_HOURS}
            config={{ household: { label: "Usage", color: "chart-1" } }}
            xKey="start"
            interval="hour"
            timeZone="Europe/Oslo"
            aria-label="Usage per hour">
            <Chart.YAxis />
            <Chart.XAxis />
            <Chart.Bar dataKey="household" />
          </Chart.Root>
        ) : kind === "months" ? (
          <Chart.Root
            data={SWEEP_MONTHS}
            config={{ kwh: { label: "Usage", color: "chart-1" } }}
            xKey="month"
            interval="month"
            timeZone="Europe/Oslo"
            aria-label="Usage per month">
            <Chart.YAxis />
            <Chart.XAxis />
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        ) : kind === "categories" ? (
          <Chart.Root
            data={SWEEP_CATEGORIES}
            config={{ kwh: { label: "Usage", color: "chart-1" } }}
            xKey="region"
            aria-label="Usage per region">
            <Chart.YAxis />
            <Chart.XAxis />
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        ) : kind === "quarters" ? (
          <Chart.Root
            data={QUARTERS}
            config={{ price: { label: "Price", color: "chart-1" } }}
            xKey="start"
            interval="quarter-hour"
            timeZone="Europe/Stockholm"
            aria-label="Price per quarter hour">
            <Chart.YAxis />
            <Chart.XAxis />
            <Chart.Bar dataKey="price" />
          </Chart.Root>
        ) : (
          <Chart.Root
            data={rows}
            config={{ kwh: { label: "Usage", color: "chart-1" } }}
            xKey="month"
            orientation="horizontal"
            aria-label="Usage per month">
            <Chart.YAxis />
            <Chart.XAxis />
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        )}
      </LocaleProvider>
    </div>
  );
}

describe("the width sweep", () => {
  it.each(["hours", "quarters", "months", "categories"] as const)(
    "never shows fewer %s labels as the root widens from 160 to 1,200 px, and at least two on a 160 px plot",
    async (kind) => {
      const { host } = sweepChart(kind);
      const box = host.querySelector<HTMLElement>("[data-probe]");
      let previous = 0;
      for (let width = 160; width <= 1200; width += 8) {
        box?.style.setProperty("width", `${String(width)}px`);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const count = visibleTicks(host).length;
        expect(count, String(width)).toBeGreaterThanOrEqual(previous);
        expect(defects(host), String(width)).toEqual([]);
        // DOM audit: the x axis is the size container the buckets measure.
        const axis = host.querySelector('[data-slot="chart-x-axis"]')?.getBoundingClientRect().width ?? 0;
        if (axis >= 160)
          expect(count, `${String(width)} with a ${String(axis)} px plot`).toBeGreaterThanOrEqual(2);
        previous = count;
      }
    }
  );

  it("keeps every value label of a horizontal chart inside the root and apart from 160 to 1,200 px", async () => {
    // The recheck saw "35" for the last tick, 350, cut at a 320 px stage's edge, and then the
    // clamped 350 over 300 by 3.7 px. The rendered boxes are the oracle.
    const { host } = sweepChart("horizontal");
    const box = host.querySelector<HTMLElement>("[data-probe]");
    let previous = 0;
    for (let width = 160; width <= 1200; width += 8) {
      box?.style.setProperty("width", `${String(width)}px`);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // DOM audit: the root's box bounds the labels, and the value ticks are aria-hidden text
      // whose boxes are the oracle.
      const root = host.querySelector('[data-slot="chart"]')?.getBoundingClientRect() ?? new DOMRect();
      const shownTicks = [...host.querySelectorAll('[data-slot="chart-y-axis"] > [data-slot="chart-y-tick"]')]
        .filter((tick) => getComputedStyle(tick).display !== "none")
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const boxes = shownTicks.map((tick) => tick.getBoundingClientRect());
      // The final recheck saw 0, 50, 200 and 350. The shown values keep one step from zero.
      const values = shownTicks.map((tick) => Number(tick.textContent.replaceAll(",", "")));
      expect(values[0], String(width)).toBe(0);
      const steps = values.slice(1).map((value, index) => value - (values[index] ?? 0));
      expect(new Set(steps).size, `${String(width)} ${values.join(" ")}`).toBeLessThanOrEqual(1);
      boxes.forEach((rect, index) => {
        expect(rect.left, String(width)).toBeGreaterThanOrEqual(root.left - 0.5);
        expect(rect.right, String(width)).toBeLessThanOrEqual(root.right + 0.5);
        const before = boxes[index - 1];
        if (before !== undefined)
          expect(rect.left, `overlap at ${String(width)}`).toBeGreaterThanOrEqual(before.right);
      });
      expect(boxes.length, String(width)).toBeGreaterThanOrEqual(previous);
      // DOM audit: the value axis is the size container the buckets measure.
      const axis = host.querySelector('[data-slot="chart-y-axis"]')?.getBoundingClientRect().width ?? 0;
      if (axis >= 160)
        expect(boxes.length, `${String(width)} with a ${String(axis)} px axis`).toBeGreaterThanOrEqual(2);
      previous = boxes.length;
    }
  });
});

/** Whether two boxes share any area. */
describe("axis titles", () => {
  it("keeps a 4 px gutter between the y title and the widest tick label", () => {
    // jc12: the rotated title touched the tick labels. The gap is the 2xs spacing role, 4 px.
    const { host } = renderThemed(
      <div style={{ width: 480, fontFamily: "var(--font-sans)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={[1.2, 1.4, 0.2].map((kwh, index) => ({ name: `k${String(index)}`, kwh }))}
            config={{
              kwh: { label: "Forbruk", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
            }}
            xKey="name"
            aria-label="Forbruk">
            <Chart.YAxis label="Energi" />
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the title and ticks are aria-hidden plot output.
    const title = host.querySelector('[data-slot="chart-y-axis"] > [data-slot="chart-axis-label"]');
    const ticks = [...host.querySelectorAll('[data-slot="chart-y-tick"]')].map((tick) =>
      tick.getBoundingClientRect()
    );
    const right = title?.getBoundingClientRect().right ?? 0;
    expect(Math.min(...ticks.map((tick) => tick.left)) - right).toBeGreaterThanOrEqual(3.5);
  });

  it.each(["vertical", "horizontal"] as const)(
    "keeps %s axis titles clear of every tick label across the width sweep, in 12 px text on a 16 px line",
    async (orientation) => {
      const rows = ["January", "February", "March", "April"].map((month, index) => ({
        month,
        kwh: 400 + index * 150,
      }));
      for (const density of ["dense", "comfortable"] as const) {
        stampDensity(density);
        const { host, unmount } = renderThemed(
          <div style={{ width: 280, fontFamily: "var(--font-sans)" }} data-probe="">
            <LocaleProvider locale="nb-NO">
              <Chart.Root
                data={rows}
                config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
                xKey="month"
                orientation={orientation}
                aria-label="Forbruk per måned">
                <Chart.YAxis label="Energi" />
                <Chart.XAxis label="Måned" />
                <Chart.Bar dataKey="kwh" />
              </Chart.Root>
            </LocaleProvider>
          </div>
        );
        // DOM audit: the titles and ticks are aria-hidden plot output, so their slots are the locators.
        const titles = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-axis-label"]')];
        expect(titles).toHaveLength(2);
        for (const title of titles) {
          expect(title.closest('[aria-hidden="true"]')).not.toBeNull();
          const style = getComputedStyle(title);
          expect([style.fontSize, style.lineHeight], density).toEqual(["12px", "16px"]);
        }
        const box = host.querySelector<HTMLElement>("[data-probe]");
        for (let width = 280; width <= 1200; width += 40) {
          box?.style.setProperty("width", `${String(width)}px`);
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const ticks = [
            ...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"], [data-slot="chart-y-tick"]'),
          ]
            .filter((tick) => getComputedStyle(tick).display !== "none")
            .map((tick) => tick.getBoundingClientRect());
          for (const title of titles) {
            const rect = title.getBoundingClientRect();
            expect(
              ticks.filter((tick) => intersects(rect, tick)).length,
              `${density} ${String(width)} ${title.textContent}`
            ).toBe(0);
          }
        }
        unmount();
      }
    }
  );
});

describe("user text styles", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("font-size");
    document.getElementById("text-spacing")?.remove();
  });

  it("keeps S06's labels apart under a 200 % text size, as a text-only zoom sets it", async () => {
    // A text-only zoom scales the root font size and leaves CSS pixels alone.
    document.documentElement.style.setProperty("font-size", "200%");
    const { host } = hourChart(S06_HOURS, "hour", 280);
    const box = host.querySelector<HTMLElement>("[data-probe]");
    for (let width = 280; width <= 1200; width += 40) {
      box?.style.setProperty("width", `${String(width)}px`);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(defects(host), String(width)).toEqual([]);
    }
  });

  it("keeps S06's labels apart under the WCAG 1.4.12 text spacing", async () => {
    // The spacing of the 1.4.12 bookmarklet: line height 1.5, letter spacing 0.12 em and word
    // spacing 0.16 em on every element.
    const style = document.createElement("style");
    style.id = "text-spacing";
    style.textContent =
      "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }";
    document.head.append(style);
    const { host } = hourChart(S06_HOURS, "hour", 280);
    const box = host.querySelector<HTMLElement>("[data-probe]");
    for (let width = 280; width <= 1200; width += 40) {
      box?.style.setProperty("width", `${String(width)}px`);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(defects(host), String(width)).toEqual([]);
    }
  });
});
