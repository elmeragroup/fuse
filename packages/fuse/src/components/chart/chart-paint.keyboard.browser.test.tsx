// The paint model and the path form of ticket 05, in Chromium, Firefox and WebKit, after layer 05's
// review findings q4 to q8, q23, s6 to s10, s17, s18 and s20 and the "layer 05 review decisions" of
// DECISIONS-LOG.md. Oracles: the theme's own role colours, read through a probe element styled with
// `var(--chart-1)` and friends, so no expectation comes from chart code; CONTRACT section 8.12's
// path-form table; and hand-written slot counts and positions.
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { pagePixels } from "../../../test/chart/media";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartColor, ChartQuality } from "./chart-types";
import "./chart.css";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A theme colour as the browser resolves it, through a probe outside every chart rule. */
function resolved(host: HTMLElement, value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  host.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** The sRGB channels a resolved colour paints, read back from a one-pixel canvas. */
function channels(color: string): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2d context");
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data.subarray(0, 3)];
}

function bars(host: HTMLElement): HTMLElement[] {
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [...host.querySelectorAll<HTMLElement>('[data-slot="chart-bar"]')];
}

function chart(
  rows: readonly { readonly [key: string]: number | string | null }[],
  color: ChartColor,
  options: {
    readonly variant?: "default" | "gradient" | "hatched";
    readonly style?: { readonly [name: `--${string}`]: string };
  } = {}
) {
  return renderThemed(
    <div style={{ width: 400 }}>
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{ v: { label: "V", color } }}
          xKey="name"
          aria-label="Maling"
          style={options.style}>
          <Chart.Bar dataKey="v" variant={options.variant} />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

const many = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ name: `c${String(index)}`, v: 2 }));

describe("role lists", () => {
  it("paint each bar from its tip in the list's first role to its base in the last", async () => {
    // q6 and s8: one tall bar, so the gradient's ends are far apart on screen.
    const { host } = chart([{ name: "a", v: 4 }], ["chart-1", "chart-3"]);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: Root's figure holds every animation of the chart.
    for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ?? [])
      animation.finish();
    const [bar] = bars(host);
    if (bar === undefined) throw new Error("no bar");
    const box = bar.getBoundingClientRect();
    const pixels = await pagePixels();
    const at = (y: number): number[] => {
      const index =
        (Math.round(y * pixels.scale) * pixels.width +
          Math.round((box.left + box.width / 2) * pixels.scale)) *
        4;
      return [...pixels.data.subarray(index, index + 3)];
    };
    const near = (actual: number[], expected: number[]): boolean =>
      actual.every((channel, index) => Math.abs(channel - (expected[index] ?? 0)) <= 12);
    expect(near(at(box.top + 2), channels(resolved(host, "var(--chart-1)")))).toBe(true);
    expect(near(at(box.bottom - 2), channels(resolved(host, "var(--chart-3)")))).toBe(true);
  });

  it("fill the path form through one gradient whose stops are the list's roles", () => {
    const { host } = chart(many(101), ["chart-1", "chart-3"]);
    // DOM audit: the path form's gradient stops are SVG internals with no role.
    const stops = [
      ...host.querySelectorAll<SVGStopElement>('[data-slot="chart-bar-series"] linearGradient stop'),
    ];
    expect(stops.map((stop) => getComputedStyle(stop).stopColor)).toEqual([
      resolved(host, "var(--chart-1)"),
      resolved(host, "var(--chart-3)"),
    ]);
  });
});

describe("the consumer colour override", () => {
  it("wins over a scale step and over each role of a list", () => {
    // s17: CONTRACT section 11 says --chart-color-<key> wins for every paint.
    const red = "rgb(255, 0, 0)";
    const scale = chart(
      [
        { name: "a", v: 1 },
        { name: "b", v: 10 },
      ],
      "chart-seq",
      { style: { "--chart-color-v": red } }
    );
    expect(bars(scale.host).map((bar) => getComputedStyle(bar).backgroundColor)).toEqual([red, red]);
    scale.unmount();
    const list = chart([{ name: "a", v: 4 }], ["chart-1", "chart-3"], { style: { "--chart-color-v": red } });
    const [bar] = bars(list.host);
    expect(bar === undefined ? "" : getComputedStyle(bar).backgroundImage).toBe(
      `linear-gradient(${red}, ${red})`
    );
  });
});

describe("the active overlay", () => {
  it("keeps a scale-coloured bar's own step and an estimated reading's outline", async () => {
    // q7 and s9: chart-seq over [1, 10] paints 1 and 10 in different steps.
    const rows: { name: string; v: number; q: ChartQuality }[] = [
      { name: "a", v: 1, q: "estimated" },
      { name: "b", v: 10, q: "measured" },
    ];
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <button type="button">før</button>
          <Chart.Root
            data={rows}
            config={{ v: { label: "V", color: "chart-seq", qualityKey: "q" } }}
            xKey="name"
            aria-label="Aktiv">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    // DOM audit: the overlay is aria-hidden plot output.
    const overlay = host.querySelector<HTMLElement>('[data-slot="chart-bar-active"]');
    if (overlay === null) throw new Error("no overlay");
    const [first, second] = bars(host);
    expect(overlay.getAttribute("data-quality")).toBe("estimated");
    expect(getComputedStyle(overlay).outlineStyle).toBe("dashed");
    expect(getComputedStyle(overlay).outlineColor).toBe(getComputedStyle(first ?? overlay).outlineColor);
    // js14: L14 rounds every bar's far end, so the estimated bar and its overlay take the measured
    // bar's radius.
    const radius = getComputedStyle(second ?? overlay).borderTopLeftRadius;
    expect(Number.parseFloat(radius)).toBeGreaterThan(0);
    expect(getComputedStyle(first ?? overlay).borderTopLeftRadius).toBe(radius);
    expect(getComputedStyle(overlay).borderTopLeftRadius).toBe(radius);
    await userEvent.keyboard("{ArrowRight}");
    expect(overlay.hasAttribute("data-quality")).toBe(false);
    expect(getComputedStyle(overlay).backgroundColor).toBe(
      getComputedStyle(second ?? overlay).backgroundColor
    );
  });
});

describe("followers of a negative bar", () => {
  it("sit at the bar's value end, not at zero", async () => {
    // s10: under [-4, 0] the -4 bar spans the whole plot, so its value sits at the plot's bottom.
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <button type="button">før</button>
          <Chart.Root
            data={[
              { name: "a", v: -4 },
              { name: "b", v: -2 },
            ]}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Under null">
            <Chart.Bar dataKey="v" />
            <Chart.ActiveValue dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    // DOM audit: Root's figure holds every animation, and the value and the series box are
    // aria-hidden plot output.
    for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ?? [])
      animation.finish();
    const value = host.querySelector('[data-slot="chart-active-value"]')?.getBoundingClientRect();
    const plot = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect();
    if (value === undefined || plot === undefined) throw new Error("no value");
    expect(Math.abs(value.bottom - plot.bottom)).toBeLessThan(plot.height / 4);
  });
});

describe("the path form", () => {
  it.each(["hatched", "striped", "duotone", "duotone-reverse"] as const)(
    "draws %s as the default look with the bar-variant-needs-html hint",
    (variant) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const { host } = renderThemed(
        <div style={{ width: 400 }}>
          <LocaleProvider locale="nb-NO">
            <Chart.Root
              data={many(101)}
              config={{ v: { label: "V", color: "chart-1" } }}
              xKey="name"
              aria-label="Mange">
              <Chart.Bar dataKey="v" variant={variant} />
            </Chart.Root>
          </LocaleProvider>
        </div>
      );
      // DOM audit: the series wrapper is aria-hidden plot output.
      expect(host.querySelector('[data-slot="chart-bar-series"]')?.getAttribute("data-variant")).toBe(
        "default"
      );
      expect(warn.mock.calls.some(([message]) => String(message).includes(`variant="${variant}"`))).toBe(
        true
      );
    }
  );

  it("draws the gradient variant through a fade mask", () => {
    const { host } = chart(many(101), "chart-1", { variant: "gradient" });
    // DOM audit: the mask is an SVG internal with no role.
    expect(host.querySelector('[data-slot="chart-bar-series"]')?.getAttribute("data-variant")).toBe(
      "gradient"
    );
    expect(host.querySelectorAll('[data-slot="chart-bar-series"] mask')).toHaveLength(1);
  });

  it("draws projected readings in a path of their own and missing ones as dashed ticks", () => {
    const quality = (index: number): ChartQuality => (index === 3 ? "missing" : "measured");
    const rows = Array.from({ length: 101 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index === 3 ? null : 2,
      q: quality(index),
    }));
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{ v: { label: "V", color: "chart-1", qualityKey: "q", projectedFrom: "c100" } }}
            xKey="name"
            aria-label="Prognose">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the paths are aria-hidden plot output.
    expect(host.querySelectorAll('[data-slot="chart-bar-path"][data-projected]')).toHaveLength(1);
    const missing = host.querySelector('[data-slot="chart-bar-path"][data-quality="missing"]');
    expect(missing === null ? "" : getComputedStyle(missing).strokeDasharray.replaceAll("px", "")).toBe(
      "3, 3"
    );
  });
});

const missingQuality: ChartQuality = "missing";

describe("empty charts", () => {
  it("draw no missing marker in either form", () => {
    // s20: CONTRACT section 8.13 shows Empty and suppresses the missing markers.
    for (const count of [1, 101]) {
      const rows = Array.from({ length: count }, (_, index) => ({
        name: `c${String(index)}`,
        v: null,
        q: missingQuality,
      }));
      const { host, unmount } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{ v: { label: "V", color: "chart-1", qualityKey: "q" } }}
            xKey="name"
            aria-label="Tom">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      );
      // DOM audit: the markers are aria-hidden plot output.
      expect(
        host.querySelectorAll('[data-slot="chart-bar-missing"], [data-quality="missing"]'),
        String(count)
      ).toHaveLength(0);
      unmount();
    }
  });
});

describe('data-fade="past"', () => {
  /** Oslo midnight of a day in October 2025, in summer time up to 26 October. */
  const day = (date: number) => new Date(Date.UTC(2025, 9, date, -2));
  const now = new Date(Date.UTC(2025, 9, 3, 10));

  it("dims the bars of slots that ended before now", () => {
    // q23 and s18: now on 3 October leaves 1 and 2 October in the past.
    const rows = [1, 2, 3, 4].map((date) => ({ day: day(date), v: 2 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          now={now}
          data-fade="past"
          aria-label="Fortid">
          <Chart.Bar dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host).map((bar) => getComputedStyle(bar).filter)).toEqual([
      "opacity(0.4)",
      "opacity(0.4)",
      "none",
      "none",
    ]);
  });

  it("masks the past span of the path form", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      day: new Date(day(1).getTime() + index * 3_600_000),
      v: 2,
    }));
    const hour = new Date(day(1).getTime() + 10 * 3_600_000 + 60_000);
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="day"
          interval="hour"
          timeZone="Europe/Oslo"
          now={hour}
          data-fade="past"
          aria-label="Fortid">
          <Chart.Bar dataKey="v" />
        </Chart.Root>
      </LocaleProvider>
    );
    // Now lies a minute into the eleventh hour, so ten hours have ended.
    // DOM audit: the mask is an SVG internal with no role.
    const past = host.querySelector('[data-slot="chart-bar-series"] mask rect');
    expect(past?.getAttribute("width")).toBe("10");
  });
});

describe("data-series on marks", () => {
  // js15: CONTRACT section 11 lists data-series on marks, and only the series wrapper wrote it.
  it.each([
    ["the HTML form", 12],
    ["the path form", 120],
  ])("names each mark's series in %s", (_, count) => {
    const rows = Array.from({ length: count }, (_, index) => ({
      name: `k${String(index)}`,
      p: 1 + (index % 4),
      q: 2,
      state: index === 1 ? ("missing" as const) : ("measured" as const),
    }));
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{
              p: { label: "P", color: "chart-1", qualityKey: "state" },
              q: { label: "Q", color: "chart-2" },
            }}
            xKey="name"
            aria-label="Serier">
            <Chart.Bar dataKey="p" emphasis="max" />
            <Chart.Bar dataKey="q" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: marks are aria-hidden plot output, so their slots are the locators.
    const wrappers = [...host.querySelectorAll('[data-slot="chart-bar-series"]')];
    expect(wrappers.map((wrapper) => wrapper.getAttribute("data-series"))).toHaveLength(2);
    expect(new Set(wrappers.map((wrapper) => wrapper.getAttribute("data-series"))).size).toBe(2);
    for (const wrapper of wrappers) {
      const marks = [
        ...wrapper.querySelectorAll(
          '[data-slot="chart-bar"], [data-slot="chart-bar-path"], [data-slot="chart-bar-missing"], [data-slot="chart-bar-emphasis"], [data-slot="chart-bar-active"]'
        ),
      ];
      expect(marks.length).toBeGreaterThan(1);
      for (const mark of marks)
        expect(mark.getAttribute("data-series")).toBe(wrapper.getAttribute("data-series"));
    }
  });
});
