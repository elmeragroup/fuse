// The paint model and the path form of ticket 05, in Chromium, after layer 05's
// review findings q4 to q8, q23, s6 to s10, s17, s18 and s20 and the "layer 05 review decisions" of
// DECISIONS-LOG.md. Oracles: the theme's own role colours, read through a probe element styled with
// `var(--chart-1)` and friends, so no expectation comes from chart code; CONTRACT section 8.12's
// path-form table; and hand-written slot counts and positions.
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { bars } from "../../../test/chart/marks";
import { chromaAt, pagePixels } from "../../../test/chart/media";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartColor, ChartQuality } from "./chart-types";
import "./chart.css";
import { Sparkline } from "./sparkline";

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
          data-intro="none"
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
    // DOM audit: the path form's gradient stops are SVG internals with no role, and the path's own
    // gradient is the one whose id ends in "-list".
    const stops = [
      ...host.querySelectorAll<SVGStopElement>(
        '[data-slot="chart-bar-series"] linearGradient[id$="-list"] stop'
      ),
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
    expect(bars(scale.host).map((bar) => getComputedStyle(bar).fill)).toEqual([red, red]);
    scale.unmount();
    const list = chart([{ name: "a", v: 4 }], ["chart-1", "chart-3"], { style: { "--chart-color-v": red } });
    // DOM audit: a list bar fills from its series' gradient, whose stops are SVG internals.
    const stops = [...list.host.querySelectorAll('[data-slot="chart-bar-series"] linearGradient stop')];
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) expect(getComputedStyle(stop).stopColor).toBe(red);
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
            data-intro="none"
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
    expect(getComputedStyle(first ?? overlay).strokeDasharray.replaceAll("px", "")).toBe("3, 2");
    expect(getComputedStyle(overlay).strokeDasharray.replaceAll("px", "")).toBe("6, 4");
    expect(getComputedStyle(overlay).stroke).toBe(getComputedStyle(first ?? overlay).stroke);
    // js14: L14 rounds every bar's far end, so the estimated bar and its overlay round as the
    // measured bar does.
    const clip = getComputedStyle(second ?? overlay).clipPath;
    expect(clip).toMatch(/round [1-9]/u);
    expect(getComputedStyle(first ?? overlay).clipPath).toBe(clip);
    expect(getComputedStyle(overlay).clipPath).toBe(clip);
    await userEvent.keyboard("{ArrowRight}");
    expect(overlay.hasAttribute("data-quality")).toBe(false);
    expect(getComputedStyle(overlay).fill).toBe(getComputedStyle(second ?? overlay).fill);
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
            data-intro="none"
            aria-label="Under null">
            <Chart.Bar dataKey="v" />
            <Chart.ActiveValue dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    // DOM audit: the value and the series box are aria-hidden plot output.
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

  it("defines the role-list gradient the active overlay fills from", async () => {
    // T3: above 100 slots a role list paints the overlay over the active column from its tip in
    // the first role, through a gradient the series has to define.
    const { host } = chart(many(101), ["chart-1", "chart-3"]);
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}");
    // DOM audit: the overlay is aria-hidden plot output.
    const overlay = host.querySelector<HTMLElement>('[data-slot="chart-bar-active"]');
    expect(overlay?.getAttribute("visibility")).toBe("visible");
    const id = /^url\(#(.+)\)$/u.exec(overlay?.style.getPropertyValue("--_fill") ?? "")?.[1] ?? "";
    expect(id).toMatch(/-list-positive$/u);
    // DOM audit: a paint server is an SVG internal, found by the id the overlay references.
    expect(host.querySelector(`[id="${id}"]`)?.tagName).toBe("linearGradient");
  });

  it("fills the overlay from the role list's gradient when a look without a path form falls back", async () => {
    // Q2-3: hatched has no path look, so the series draws the default look above 100 slots, and
    // its overlay, which reads the same look, fills from the list's gradient as the paths do.
    const { host } = chart(many(101), ["chart-1", "chart-3"], { variant: "hatched" });
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}");
    // DOM audit: the overlay is aria-hidden plot output.
    const overlay = host.querySelector<HTMLElement>('[data-slot="chart-bar-active"]');
    const id = /^url\(#(.+)\)$/u.exec(overlay?.style.getPropertyValue("--_fill") ?? "")?.[1] ?? "";
    expect(id).toMatch(/-list-positive$/u);
    // DOM audit: a paint server is an SVG internal, found by the id the overlay references.
    expect(host.querySelector(`[id="${id}"]`)?.tagName).toBe("linearGradient");
  });

  it("fades the gradient look from full colour near the top to the background near the base", async () => {
    // T4: the fade ramp is opaque down to a fifth of the plot and clear from nine tenths, so a
    // column paints its colour a quarter of the way down and the page's background near its base.
    const { host } = chart(many(101), "chart-1", { variant: "gradient" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: the series layer covers the plot box.
    const plot = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect();
    if (plot === undefined) throw new Error("no plot");
    const pixels = await pagePixels();
    // The middle of slot 50 of 101.
    const x = (plot.left + (plot.width * 50.5) / 101) * pixels.scale;
    expect(chromaAt(pixels, x, (plot.top + plot.height * 0.25) * pixels.scale)).toBeGreaterThan(40);
    expect(chromaAt(pixels, x, (plot.top + plot.height * 0.95) * pixels.scale)).toBeLessThan(15);
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
      // DOM audit: the markers are aria-hidden plot output. The path form keeps its missing path
      // mounted, and it draws nothing.
      const drawn = [
        ...host.querySelectorAll('[data-slot="chart-bar-missing"], [data-quality="missing"]'),
      ].filter((marker) => marker.getAttribute("d") !== "");
      expect(drawn, String(count)).toHaveLength(0);
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
    expect(bars(host).map((bar) => getComputedStyle(bar).opacity)).toEqual(["0.4", "0.4", "1", "1"]);
  });

  it("keeps a past blocks track at its own tenth of the dim, 0.04", () => {
    // B5-2: readings 2 and 10 on 1 and 2 October, with now in 2 October, put the first bar in the
    // past. Its body dims to 0.4, and its empty track, 0.1 on its own, to 0.4 × 0.1.
    const rows = [
      { day: day(1), v: 2 },
      { day: day(2), v: 10 },
    ];
    const { host } = renderThemed(
      <div style={{ width: 200 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            now={new Date(Date.UTC(2025, 9, 2, 10))}
            data-fade="past"
            aria-label="Fortid i blokker">
            <Chart.Bar dataKey="v" variant="blocks" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the bars' parts are aria-hidden plot output, so their slots are the only locator.
    const tracks = [...host.querySelectorAll('[data-slot="chart-bar-detail"][data-part="track"]')];
    const blocks = [...host.querySelectorAll('[data-slot="chart-bar-detail"][data-part="blocks"]')];
    expect(tracks.map((track) => Number(getComputedStyle(track).opacity))).toEqual([0.04, 0.1]);
    expect(blocks.map((block) => Number(getComputedStyle(block).opacity))).toEqual([0.4, 1]);
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
    // Now lies a minute into the eleventh hour, so ten of 101 hours have ended, and the dim ends
    // on the pixel nearest the eleventh hour's left edge.
    // DOM audit: the mask is an SVG internal with no role.
    const past = host.querySelector('[data-slot="chart-bar-series"] mask rect');
    const width = host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect().width ?? 0;
    expect(Math.abs(Number(past?.getAttribute("width")) - (10 * width) / 101)).toBeLessThanOrEqual(0.5);
  });
});

describe("data-series on marks", () => {
  // js15: CONTRACT section 11 lists data-series on marks, and only the series wrapper wrote it.
  it.each([
    ["the bars form", 12],
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

describe("dimming a line series", () => {
  it("keeps a chart-other line's stroke while a series is selected (B1-6)", () => {
    // Selecting a series changes only the other series' opacity, so each line strokes in the same
    // colour with and without a selection, chart-other's included.
    const config = {
      v: { label: "Annet", color: "chart-other" },
      w: { label: "Verdi", color: "chart-1" },
    } as const;
    const chart = (selectedKey: "v" | "w" | null) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[10, 40, 25, 100].map((v, index) => ({ name: `c${String(index)}`, v, w: 50 - index * 10 }))}
            config={config}
            xKey="name"
            xScale="point"
            selectedKey={selectedKey}
            data-intro="none"
            aria-label="Verdier">
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.Line dataKey="w" curve="linear" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the lines are aria-hidden plot output.
    const strokes = (host: HTMLElement) =>
      [...host.querySelectorAll('[data-slot="chart-line"][data-part="solid"]')].map(
        (path) => getComputedStyle(path).stroke
      );
    const { host, rerender } = renderThemed(chart(null));
    const unselected = strokes(host);
    expect(unselected[0]).not.toBe(unselected[1]);
    for (const selected of ["v", "w"] as const) {
      rerender(chart(selected));
      expect(strokes(host)).toEqual(unselected);
      const other = host.querySelector(
        `[data-slot="chart-line-series"][data-series="${selected === "v" ? "1" : "0"}"]`
      );
      // The dim's 150 ms opacity transition ends at its target.
      for (const animation of other?.getAnimations() ?? []) animation.finish();
      expect(Number(getComputedStyle(other ?? document.body).opacity)).toBeLessThan(1);
    }
  });
});

describe("isolated readings in an area (B2-1)", () => {
  it("paints a dot for each lone reading of an Area drawn alone", async () => {
    // [10, null, 20] on 300 px of band slots over [0, 20]: no run holds two readings, so the fill
    // paints nothing and each reading draws L18's dot, a 2 px ring of radius 2.5 around its
    // vertex, at the slot centres 50 and 250 px and at 100 and 0 px down a 200 px plot.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[
              { name: "a", v: 10 },
              { name: "b", v: null },
              { name: "c", v: 20 },
            ]}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            yInclude={[0, 20]}
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Flate">
            <Chart.Area dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the plot box, and the area's dot path is aria-hidden plot output.
    const plot = host.querySelector('[data-slot="chart-area-series"]')?.getBoundingClientRect();
    if (plot === undefined) throw new Error("no plot");
    const dots = host.querySelector('[data-slot="chart-area"][data-part="dot"]');
    expect(dots?.getAttribute("d")?.match(/M/gu)).toHaveLength(2);
    const pixels = await pagePixels();
    const at = (x: number, y: number) =>
      chromaAt(pixels, (plot.left + x) * pixels.scale, (plot.top + y) * pixels.scale);
    // The ring's stroke lies 2.5 px from each centre, and the slot between them stays empty.
    expect(at(52.5, 100)).toBeGreaterThan(40);
    expect(at(252.5, 0.5)).toBeGreaterThan(40);
    expect(at(150, 50)).toBeLessThan(15);
  });

  it("paints a round cap for each lone reading of a Sparkline area", async () => {
    // [10, null, 20] in a 60 by 32 px Sparkline: cells of 20 px, so the caps centre at 10 px,
    // halfway down at 16 px, and at 50 px, at the top.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 60 }}>
          <Sparkline data={[10, null, 20]} variant="area" locale="nb-NO" aria-label="Pris" />
        </div>
      </LocaleProvider>
    );
    // DOM audit: the Sparkline is one image, and its lone path is its plot output.
    const box = host.querySelector('[data-slot="sparkline"]')?.getBoundingClientRect();
    if (box === undefined) throw new Error("no sparkline");
    expect(host.querySelector('[data-slot="sparkline-path"][data-part="lone"]')?.getAttribute("d")).toBe(
      "M5,50ZM25,0Z"
    );
    const pixels = await pagePixels();
    expect(chromaAt(pixels, (box.left + 10) * pixels.scale, (box.top + 16) * pixels.scale)).toBeGreaterThan(
      40
    );
    expect(chromaAt(pixels, (box.left + 30) * pixels.scale, (box.top + 16) * pixels.scale)).toBeLessThan(15);
  });
});

describe("dimming a Marker with its series (B2-8, Q2-5)", () => {
  it("keeps the selected series' Marker at full opacity and dims the other's", () => {
    const chart = (selectedKey: "a" | "b") => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[10, 40, 25].map((a, index) => ({ name: `c${String(index)}`, a, b: 50 - index * 10 }))}
            config={{ a: { label: "A", color: "chart-1" }, b: { label: "B", color: "chart-2" } }}
            xKey="name"
            selectedKey={selectedKey}
            data-intro="none"
            aria-label="Markører">
            <Chart.Line dataKey="a" />
            <Chart.Marker dataKey="a" at="last">
              <Chart.ValueLabel />
            </Chart.Marker>
            <Chart.Line dataKey="b" />
            <Chart.Marker dataKey="b" at="last">
              <Chart.ValueLabel />
            </Chart.Marker>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the markers are aria-hidden plot output, one per series.
    const opacities = (host: HTMLElement) =>
      [...host.querySelectorAll('[data-slot="chart-marker"]:not([data-outgoing])')].map((marker) => {
        // The dim's 150 ms opacity transition ends at its target.
        for (const animation of marker.getAnimations()) animation.finish();
        return Number(getComputedStyle(marker).opacity);
      });
    const { host, rerender } = renderThemed(chart("b"));
    const [a = 1, b = 0] = opacities(host);
    expect(a).toBeLessThan(1);
    expect(b).toBe(1);
    rerender(chart("a"));
    const [first = 0, second = 1] = opacities(host);
    expect(first).toBe(1);
    expect(second).toBeLessThan(1);
  });
});

describe("outgoing dots keep their look (B3-2)", () => {
  it("draws a crossfading ring dot hollow and a halo dot in its 6 px halo, as the live dots draw", () => {
    // [20, 40, 100] gains [10, 30] before it, so the line crossfades and its old dots fade out
    // in copies. A ring dot fills with the surface and strokes the series paint; a halo strokes
    // 6 px. Each copy draws as the live dots of its look draw.
    const chart = (variant: "ring" | "halo", names: readonly string[]) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={names.map((name, index) => ({
              name,
              v: [10, 30, 20, 40, 100].slice(-names.length)[index] ?? 0,
            }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            data-intro="none"
            aria-label="Prikker">
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.Dots dataKey="v" variant={variant} />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    for (const variant of ["ring", "halo"] as const) {
      const { host, rerender, unmount } = renderThemed(chart(variant, ["h0", "h1", "h2"]));
      rerender(chart(variant, ["g0", "g1", "h0", "h1", "h2"]));
      // DOM audit: the dots and their outgoing copies are aria-hidden plot output.
      const look = (dot: Element | null) => {
        const style = getComputedStyle(dot ?? document.body);
        return [style.fill, style.stroke, style.strokeWidth];
      };
      const live = host.querySelector(
        '[data-slot="chart-dots"] [data-slot="chart-dot"]:not([data-outgoing] *)'
      );
      const copy = host.querySelector('[data-slot="chart-dots"] [data-outgoing] [data-slot="chart-dot"]');
      expect(copy, variant).not.toBeNull();
      expect(look(copy), variant).toEqual(look(live));
      if (variant === "ring") expect(look(live)[0]).not.toBe(look(live)[1]);
      else expect(look(live)[2]).toBe("6px");
      unmount();
    }
  });
});

describe("dimming the active dots with their series (Q3-4)", () => {
  it("dims the other series' ActiveDot to the hover dim while active, and hides both while not", async () => {
    // selectedKey="b": b's ActiveDot shows at full opacity, and a's at 1 - (1 - 0.45) × 1 = 0.45.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[10, 40, 25].map((a, index) => ({ name: `c${String(index)}`, a, b: 50 - index * 10 }))}
            config={{ a: { label: "A", color: "chart-1" }, b: { label: "B", color: "chart-2" } }}
            xKey="name"
            selectedKey="b"
            data-intro="none"
            aria-label="Aktive">
            <Chart.Line dataKey="a" />
            <Chart.ActiveDot dataKey="a" />
            <Chart.Line dataKey="b" />
            <Chart.ActiveDot dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the active dots are aria-hidden plot output, one per series.
    const opacities = () =>
      [...host.querySelectorAll('[data-slot="chart-active-dot"]:not([data-outgoing])')].map((dot) => {
        for (const animation of dot.getAnimations()) animation.finish();
        return Number(getComputedStyle(dot).opacity);
      });
    expect(opacities()).toEqual([0, 0]);
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}");
    const [a = 0, b = 0] = opacities();
    expect(a).toBeCloseTo(0.45, 6);
    expect(b).toBe(1);
  });
});

describe("the consumer colour override on swatches (X5)", () => {
  const red = "rgb(255, 0, 0)";

  /** Every colour the legend swatch paints its background with. */
  function swatchColours(
    color: ChartColor,
    options: { readonly active?: string; readonly red?: boolean }
  ): string[] {
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={[
              { name: "a", v: 1 },
              { name: "b", v: 10 },
            ]}
            config={{ v: { label: "V", color } }}
            xKey="name"
            data-intro="none"
            defaultActiveX={options.active}
            aria-label="Maling"
            style={options.red === true ? { "--chart-color-v": red } : undefined}>
            <Chart.Bar dataKey="v" />
            <Chart.Legend>
              <Chart.LegendItem>
                <Chart.Swatch />
              </Chart.LegendItem>
            </Chart.Legend>
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the swatch is aria-hidden decoration, so its slot is the only locator.
    const swatch = host.querySelector('[data-slot="chart-swatch"]');
    if (swatch === null) throw new Error("no swatch");
    const style = getComputedStyle(swatch);
    return (
      `${style.backgroundColor} ${style.backgroundImage}`.match(
        /(?:rgba?|oklch|oklab|lab|lch|color)\([^)]*\)/gu
      ) ?? []
    );
  }

  it("paints a scale's ramp in more than one colour without an override", () => {
    expect(new Set(swatchColours("chart-seq", {})).size).toBeGreaterThan(1);
  });

  it.each([
    ["a scale's ramp", "chart-seq", undefined],
    ["a scale's active step", "chart-seq", "b"],
    ["a diverging scale's ramp", "chart-diverging", undefined],
    ["a role list's gradient", ["chart-1", "chart-3"], undefined],
  ] as const)("wins over %s", (_, color, active) => {
    const colours = swatchColours(color, { active, red: true }).filter(
      (colour) => colour !== "rgba(0, 0, 0, 0)"
    );
    expect(colours.length).toBeGreaterThan(0);
    expect(new Set(colours)).toEqual(new Set([red]));
  });
});
