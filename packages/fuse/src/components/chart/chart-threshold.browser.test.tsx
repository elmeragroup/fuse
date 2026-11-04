// Threshold colours in Chromium. Units under test: the marks, the legend and the readouts of a
// series whose config colour is a ChartThresholdColor. Oracles: the theme's own sentiment roles,
// resolved through a probe outside every chart rule; the rule ChartThresholdColor documents, a
// value above the threshold paints `above` and a value at it or below paints `below`; the
// threshold's y, where a ReferenceLine at the same number draws; and labels written by hand.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Oklab from "@elmeragroup/color/oklab";
import { getOrThrow } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { computedColor } from "../../../test/assert-invalid-ring";
import { dotLayer } from "../../../test/chart/active-dot";
import { bars, popup } from "../../../test/chart/marks";
import { pagePixels, pixelAt } from "../../../test/chart/media";
import type { PagePixels } from "../../../test/chart/media";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartSeriesConfig, ChartThresholdColor } from "./chart-types";
import "./chart.css";

/** Four categories whose values sit below, above, below and above 50. */
const ROWS = [
  { name: "a", v: 20 },
  { name: "b", v: 80 },
  { name: "c", v: 30 },
  { name: "d", v: 70 },
];

/** A split at 50: positive at or below it, negative above it. */
const SPLIT: ChartThresholdColor = {
  threshold: 50,
  below: { color: "chart-sentiment-positive", label: "Under snittet" },
  above: { color: "chart-sentiment-negative", label: "Over snittet" },
};

function config(threshold: number, projectedFrom?: string): ChartConfig {
  const series: ChartSeriesConfig = { label: "Spotpris", color: { ...SPLIT, threshold } };
  if (projectedFrom !== undefined) series.projectedFrom = projectedFrom;
  return { v: series };
}

function chart(
  marks: ReactNode,
  options: {
    readonly threshold?: number;
    readonly projectedFrom?: string;
    readonly rows?: typeof ROWS;
    readonly config?: ChartConfig;
  } = {}
) {
  return renderThemed(
    <div style={{ width: 400, padding: 16 }}>
      <button type="button">Før</button>
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={options.rows ?? ROWS}
          config={options.config ?? config(options.threshold ?? 50, options.projectedFrom)}
          xKey="name"
          yInclude={[0, 100]}
          data-intro="none"
          style={{ "--chart-plot-height": "200px" }}
          aria-label="Spotpris">
          {/* The rule locates the threshold's y, where the paint must split. */}
          <Chart.ReferenceLine y={50} />
          {marks}
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

/**
 * The two sides' roles as the browser computes them in this theme, through a probe outside every
 * chart rule, so they compare exactly with a mark's computed paint.
 */
function roles(host: HTMLElement) {
  return {
    below: computedColor(host, "var(--chart-sentiment-positive)"),
    above: computedColor(host, "var(--chart-sentiment-negative)"),
  };
}

/** A computed CSS colour in sRGB, to compare with a screenshot's pixels. */
const srgb = (value: string): Srgb => CssColor.toSrgb(getOrThrow(CssColor.parse(value)));

/** The two sides' roles in sRGB. */
function sides(host: HTMLElement) {
  const { below, above } = roles(host);
  return { below: srgb(below), above: srgb(above) };
}

/** The rule's box: its y is the threshold's, and its run spans the plot. */
function rule(host: HTMLElement): DOMRect {
  // DOM audit: the reference rule is aria-hidden plot output.
  const line = host.querySelector('[data-slot="chart-reference-rule"]');
  if (line === null) throw new Error("no reference rule");
  return line.getBoundingClientRect();
}

/** The most saturated pixel in a box, which is a coloured mark's over the grey grid and rule. */
function strongestIn(pixels: PagePixels, box: { x0: number; x1: number; y0: number; y1: number }): Srgb {
  let best = pixelAt(pixels, box.x0, box.y0);
  let chroma = -1;
  for (let y = box.y0; y <= box.y1; y += 1 / pixels.scale) {
    for (let x = box.x0; x <= box.x1; x += 1 / pixels.scale) {
      const pixel = pixelAt(pixels, x, y);
      const spread = Math.max(pixel.r, pixel.g, pixel.b) - Math.min(pixel.r, pixel.g, pixel.b);
      if (spread > chroma) {
        chroma = spread;
        best = pixel;
      }
    }
  }
  return best;
}

/**
 * Whether a mark's pixel paints a role, within 3 ΔE. A pixel that paints the role reads back within
 * 0.1 of it after the screenshot's 8-bit rounding, and the two sides lie nearly 28 apart, so 3
 * leaves room for antialiasing at a run's edge and never takes one side for the other.
 */
const near = (actual: Srgb, expected: Srgb): boolean => Oklab.deltaE(actual, expected) <= 3;

/** The centre of slot `index` of four band slots along the rule's run. */
const slotCentre = (box: DOMRect, index: number) => box.left + ((index + 0.5) * box.width) / 4;

/** Each of the four steps' coloured pixel, scanned top to bottom at its slot's centre. */
function stepPixels(pixels: PagePixels, box: DOMRect): Srgb[] {
  return [0, 1, 2, 3].map((index) =>
    strongestIn(pixels, {
      x0: slotCentre(box, index),
      x1: slotCentre(box, index),
      y0: box.top - 100,
      y1: box.top + 100,
    })
  );
}

/** An element's computed fill, or "" when there is no element. */
const fillOf = (node: Element | null | undefined): string =>
  node === null || node === undefined ? "" : getComputedStyle(node).fill;

/** DOM audit: the active dot's circle is aria-hidden plot output. */
const activeDot = (host: HTMLElement) => dotLayer(host)?.querySelector('[data-slot="chart-dot"]');

describe("a threshold-coloured line", () => {
  it("strokes each step in its side's role and splits a riser at the threshold's y", async () => {
    const { host } = chart(<Chart.Line dataKey="v" curve="step-after" />);
    await nextFrames(2);
    const { below, above } = sides(host);
    const box = rule(host);
    const pixels = await pagePixels();
    const steps = stepPixels(pixels, box);
    expect(
      steps.map((pixel) => near(pixel, below)),
      JSON.stringify(steps)
    ).toEqual([true, false, true, false]);
    expect(
      steps.map((pixel) => near(pixel, above)),
      JSON.stringify(steps)
    ).toEqual([false, true, false, true]);
    // The riser from 20 up to 80 sits on the boundary of slots a and b and crosses 50.
    const riser = box.left + box.width / 4;
    const at = (y: number) => strongestIn(pixels, { x0: riser - 3, x1: riser + 3, y0: y, y1: y });
    expect(near(at(box.top - 4), above), JSON.stringify(at(box.top - 4))).toBe(true);
    expect(near(at(box.top + 4), below), JSON.stringify(at(box.top + 4))).toBe(true);
  });

  it("dashes its projected tail in the side colours too", async () => {
    const { host } = chart(<Chart.Line dataKey="v" curve="step-after" />, { projectedFrom: "c" });
    await nextFrames(2);
    const { below, above } = sides(host);
    const box = rule(host);
    const pixels = await pagePixels();
    // A dash covers a few pixels of each slot's run, so each slot's middle half is scanned.
    const tail = [2, 3].map((index) =>
      strongestIn(pixels, {
        x0: slotCentre(box, index) - box.width / 16,
        x1: slotCentre(box, index) + box.width / 16,
        y0: box.top - 100,
        y1: box.top + 100,
      })
    );
    expect(
      tail.map((pixel, index) => near(pixel, index === 0 ? below : above)),
      JSON.stringify(tail)
    ).toEqual([true, true]);
  });

  it("paints one side throughout when the threshold lies outside the drawn values", async () => {
    for (const [threshold, side] of [
      [500, "below"],
      [-500, "above"],
    ] as const) {
      const { host, unmount } = chart(<Chart.Line dataKey="v" curve="step-after" />, { threshold });
      await nextFrames(2);
      const expected = sides(host)[side];
      const box = rule(host);
      const pixels = await pagePixels();
      const steps = stepPixels(pixels, box);
      expect(
        steps.map((pixel) => near(pixel, expected)),
        `${String(threshold)} ${JSON.stringify(steps)}`
      ).toEqual([true, true, true, true]);
      unmount();
    }
  });
});

describe("a threshold-coloured area", () => {
  it("fills above the threshold's y in the above role and below it in the below role", async () => {
    const { host } = chart(
      <Chart.Area dataKey="v" variant="solid" curve="step-after" style={{ "--chart-area-opacity": 1 }} />
    );
    await nextFrames(2);
    const { below, above } = sides(host);
    const box = rule(host);
    const pixels = await pagePixels();
    // Slot b fills from 0 up to 80, so it crosses the threshold's y.
    const b = slotCentre(box, 1);
    expect(
      near(pixelAt(pixels, b, box.top - 4), above),
      JSON.stringify(pixelAt(pixels, b, box.top - 4))
    ).toBe(true);
    expect(
      near(pixelAt(pixels, b, box.top + 4), below),
      JSON.stringify(pixelAt(pixels, b, box.top + 4))
    ).toBe(true);
    // Slot a fills from 0 to 20 only, all of it below.
    expect(near(pixelAt(pixels, slotCentre(box, 0), box.top + 80), below)).toBe(true);
  });
});

describe("threshold-coloured bars", () => {
  it("paint each bar its side's role, a bar at the threshold below", () => {
    const rows = [
      { name: "a", v: 20 },
      { name: "b", v: 80 },
      { name: "c", v: 50 },
      { name: "d", v: 70 },
    ];
    const { host } = chart(<Chart.Bar dataKey="v" />, { rows });
    const { below, above } = roles(host);
    expect(bars(host).map((bar) => getComputedStyle(bar).fill)).toEqual([below, above, below, above]);
  });
});

describe("threshold-coloured bars above 100 slots", () => {
  /**
   * 101 categories at 80, above the threshold, but c60 at 20, below it. From c50 on the readings
   * are projected, and c10 and c20 are estimated, as is c30, which sits at 20.
   */
  function pathForm() {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index === 30 || index === 60 ? 20 : 80,
      q: index === 10 || index === 20 || index === 30 ? "estimated" : "measured",
    }));
    const series: ChartSeriesConfig = {
      label: "Spotpris",
      color: SPLIT,
      qualityKey: "q",
      projectedFrom: "c50",
    };
    return renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root data={rows} config={{ v: series }} xKey="name" data-intro="none" aria-label="Spotpris">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  /** The columns each path of a part draws, and the paint it strokes them in. */
  function drawn(host: HTMLElement, part: "projected" | "estimated") {
    // DOM audit: the path form's paths are aria-hidden plot output.
    return [...host.querySelectorAll(`[data-slot="chart-bar-path"][data-part="${part}"]`)].map((path) => ({
      columns: (path.getAttribute("d")?.match(/M/gu) ?? []).length,
      stroke: getComputedStyle(path).stroke,
    }));
  }

  it("keeps a projected reading's side: 50 projected above, 1 projected below", () => {
    const { host } = pathForm();
    const { below, above } = roles(host);
    expect(drawn(host, "projected")).toEqual([
      { columns: 1, stroke: below },
      { columns: 50, stroke: above },
    ]);
  });

  it("keeps an estimated reading's side: 2 estimated above, 1 estimated below", () => {
    const { host } = pathForm();
    const { below, above } = roles(host);
    expect(drawn(host, "estimated")).toEqual([
      { columns: 1, stroke: below },
      { columns: 2, stroke: above },
    ]);
  });
});

describe("path-form emphasis", () => {
  /** 101 categories at 20, but c40 at 80, its maximum, with the maximum emphasised. */
  function emphasised(color: ChartSeriesConfig["color"]) {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index === 40 ? 80 : 20,
    }));
    return renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={{ v: { label: "Spotpris", color } }}
            xKey="name"
            data-intro="none"
            aria-label="Spotpris">
            <Chart.Bar dataKey="v" emphasis="max" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  /** The fill of each emphasis box. */
  function boxFills(host: HTMLElement): string[] {
    // DOM audit: the emphasis boxes are aria-hidden plot output.
    return [...host.querySelectorAll('[data-slot="chart-bar-emphasis"]')].map(
      (box) => getComputedStyle(box).fill
    );
  }

  it("paints the box over a threshold series' maximum in the maximum's side", () => {
    const { host } = emphasised(SPLIT);
    expect(boxFills(host)).toEqual([roles(host).above]);
  });

  it("paints the box over a scale series' maximum in the scale's top step", () => {
    // chart-seq bins 20 to 80 in 7 equal steps, so the maximum takes step 7.
    const { host } = emphasised("chart-seq");
    expect(boxFills(host)).toEqual([computedColor(host, "var(--chart-seq-7)")]);
  });
});

describe("the glow of a threshold series", () => {
  /**
   * Whether a halo pixel leans toward the above role rather than the below one: its offset from the
   * surface, projected on the line from the below role to the above role.
   */
  function leansAbove(host: HTMLElement, pixel: Srgb): boolean {
    const { below, above } = sides(host);
    const surface = srgb(computedColor(host, "var(--background)"));
    const lean = (["r", "g", "b"] as const).reduce(
      (sum, channel) => sum + (pixel[channel] - surface[channel]) * (above[channel] - below[channel]),
      0
    );
    return lean > 0;
  }

  it("haloes each step of a line in its own side's colour", async () => {
    const { host } = chart(
      <Chart.Glow>
        <Chart.Line dataKey="v" curve="step-after" />
      </Chart.Glow>
    );
    await nextFrames(2);
    const box = rule(host);
    const pixels = await pagePixels();
    // The plot runs 0 to 100 over 200 px, so b's run at 80 lies 60 px above the rule at 50, and
    // a's at 20 lies 60 px below it. Each halo pixel sits 8 px off its run, on the far side from
    // the other runs.
    const b = pixelAt(pixels, slotCentre(box, 1), box.top - 68);
    const a = pixelAt(pixels, slotCentre(box, 0), box.top + 68);
    expect(leansAbove(host, b), JSON.stringify(b)).toBe(true);
    expect(leansAbove(host, a), JSON.stringify(a)).toBe(false);
  });

  it("haloes each bar in its own side's colour", async () => {
    const { host } = chart(
      <Chart.Glow>
        <Chart.Bar dataKey="v" />
      </Chart.Glow>
    );
    await nextFrames(2);
    const box = rule(host);
    const pixels = await pagePixels();
    // b's bar reaches 80, 60 px above the rule, and a's reaches 20, 60 px below it. Each halo
    // pixel sits 5 px above its bar's top.
    const b = pixelAt(pixels, slotCentre(box, 1), box.top - 65);
    const a = pixelAt(pixels, slotCentre(box, 0), box.top + 55);
    expect(leansAbove(host, b), JSON.stringify(b)).toBe(true);
    expect(leansAbove(host, a), JSON.stringify(a)).toBe(false);
  });
});

describe("the legend of a threshold series", () => {
  it("lists one entry per side, above first, each with its own label and swatch", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend />
      </>
    );
    const items = page.getByRole("listitem").elements();
    expect(items.map((item) => item.textContent)).toEqual(["Over snittet", "Under snittet"]);
    // DOM audit: the swatch is aria-hidden decoration inside each item.
    const swatches = items.map((item) => item.querySelector('[data-slot="chart-swatch"]'));
    const { below, above } = roles(host);
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([above, below]);
  });

  it("keeps the series' own label and value beside a side in a template", () => {
    chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend>
          <Chart.LegendItem>
            <Chart.SeriesLabel />
            <Chart.SeriesLabel dataKey="v" />
            <Chart.LegendValue />
          </Chart.LegendItem>
        </Chart.Legend>
      </>
    );
    // Each side's item names its side through the series' parts; the value is the series' last, 70.
    expect(
      page
        .getByRole("listitem")
        .elements()
        .map((item) => item.textContent)
    ).toEqual(["Over snittetOver snittet70", "Under snittetUnder snittet70"]);
  });

  it("leaves another series' parts nested in a side's entry their own label and paint", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Line dataKey="w" />
        <Chart.Legend>
          <Chart.LegendItem dataKey="v">
            <Chart.SeriesLabel />
            <Chart.LegendToggleGroup>
              <Chart.LegendToggle dataKey="w">
                <Chart.Swatch />
                <Chart.SeriesLabel />
              </Chart.LegendToggle>
            </Chart.LegendToggleGroup>
          </Chart.LegendItem>
        </Chart.Legend>
      </>,
      {
        rows: ROWS.map((row) => ({ ...row, w: 50 })),
        config: {
          v: { label: "Spotpris", color: SPLIT },
          w: { label: "Snitt", color: "chart-sentiment-positive" },
        },
      }
    );
    // Each side's entry nests one toggle for w, which names w and wears w's own role. The first
    // button is the page's "Før".
    const toggles = page.getByRole("button").elements().slice(1);
    expect(toggles.map((toggle) => toggle.textContent)).toEqual(["Snitt", "Snitt"]);
    // DOM audit: the swatch is aria-hidden decoration inside each toggle.
    const swatches = toggles.map((toggle) => toggle.querySelector('[data-slot="chart-swatch"]'));
    const own = computedColor(host, "var(--chart-sentiment-positive)");
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([own, own]);
  });

  it("leaves a Root nested in a side's entry its own series' label and paint", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend>
          <Chart.LegendItem dataKey="v">
            <Chart.Root
              data={ROWS}
              config={{ v: { label: "Snitt", color: "chart-3" } }}
              xKey="name"
              data-intro="none"
              aria-label="Snitt">
              <Chart.Line dataKey="v" />
              <Chart.Swatch dataKey="v" />
              <Chart.SeriesLabel dataKey="v" />
            </Chart.Root>
          </Chart.LegendItem>
        </Chart.Legend>
      </>
    );
    // Each side's entry nests a Root whose own v is plain, so its parts name and paint that v.
    // DOM audit: the nested Root's label and swatch are its own slots inside each legend item.
    const items = page.getByRole("listitem").elements();
    const labels = items.map((item) => item.querySelector('[data-slot="chart-series-label"]')?.textContent);
    expect(labels).toEqual(["Snitt", "Snitt"]);
    const swatches = items.map((item) => item.querySelector('[data-slot="chart-swatch"]'));
    const own = computedColor(host, "var(--chart-3)");
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([own, own]);
  });

  it("leaves a Root nested in another series' entry its own keys", () => {
    const { host } = chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.Legend>
          <Chart.LegendItem dataKey="v">
            <Chart.Root
              data={ROWS.map(({ name, v }) => ({ name, w: v }))}
              config={{ w: { label: "Snitt", color: "chart-3" } }}
              xKey="name"
              data-intro="none"
              aria-label="Snitt">
              <Chart.Line dataKey="w" />
              <Chart.Swatch />
              <Chart.SeriesLabel />
            </Chart.Root>
          </Chart.LegendItem>
        </Chart.Legend>
      </>,
      { config: { v: { label: "Spotpris", color: "chart-sentiment-negative" } } }
    );
    // The nested parts have no dataKey, no row of their own Root and no active point, so the label
    // prints nothing and the swatch falls back to the nested Root's first series, w.
    // DOM audit: the nested Root's label and swatch are its own slots inside the legend item.
    const [item] = page.getByRole("listitem").elements();
    expect(item?.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("");
    const swatch = item?.querySelector('[data-slot="chart-swatch"]');
    expect(swatch === null || swatch === undefined ? "" : getComputedStyle(swatch).backgroundColor).toBe(
      computedColor(host, "var(--chart-3)")
    );
  });

  it("keeps one toggle per series, named by the series' label", () => {
    chart(
      <>
        <Chart.Bar dataKey="v" />
        <Chart.LegendToggleGroup />
      </>
    );
    expect(
      page
        .getByRole("button")
        .elements()
        .map((button) => button.textContent)
    ).toEqual(["Før", "Spotpris"]);
  });
});

describe("the readouts of a threshold series", () => {
  it("paint the active dot and the tooltip swatch by the active value's side, under the series' label", async () => {
    const { host } = chart(
      <>
        <Chart.Line dataKey="v" curve="step-after" />
        <Chart.ActiveDot dataKey="v" />
        <Chart.Tooltip />
      </>
    );
    const { below, above } = roles(host);
    // DOM audit: the tooltip swatch is aria-hidden decoration.
    const swatch = () => {
      const node = popup()?.querySelector('[data-slot="chart-swatch"]');
      return node === null || node === undefined ? "" : getComputedStyle(node).backgroundColor;
    };
    roleNamed("button", "Før").focus();
    await userEvent.keyboard("{Tab}{Home}");
    await nextFrames(2);
    expect(fillOf(activeDot(host))).toBe(below);
    expect(swatch()).toBe(below);
    expect(popup()?.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("Spotpris");
    await userEvent.keyboard("{ArrowRight}");
    await nextFrames(2);
    expect(fillOf(activeDot(host))).toBe(above);
    expect(swatch()).toBe(above);
  });

  it("keeps each crossfading dot's own side", () => {
    // [20, 80, 30, 70] gains a category before it, so the line crossfades and its old dots fade out
    // in copies, which must keep the sides they wore: below, above, below, above.
    const dotted = (rows: typeof ROWS) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={rows}
            config={config(50)}
            xKey="name"
            xScale="point"
            data-intro="none"
            aria-label="Spotpris">
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.Dots dataKey="v" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(dotted(ROWS));
    rerender(dotted([{ name: "z", v: 60 }, ...ROWS]));
    const { below, above } = roles(host);
    // DOM audit: the dots and their outgoing copies are aria-hidden plot output.
    const copies = [
      ...host.querySelectorAll('[data-slot="chart-dots"] [data-outgoing] [data-slot="chart-dot"]'),
    ].map(fillOf);
    expect(copies).toEqual([below, above, below, above]);
    const live = [
      ...host.querySelectorAll('[data-slot="chart-dots"] [data-slot="chart-dot"]:not([data-outgoing] *)'),
    ].map(fillOf);
    expect(live).toEqual([above, below, above, below, above]);
  });

  it("fades out the active dot in the paint of the reading it last stepped to", async () => {
    // [20, 80]: the dot shows at 20, below, steps to 80, above, and then a category before them
    // crossfades the line, so the old dot fades out where it showed, above.
    const pair = [
      { name: "a", v: 20 },
      { name: "b", v: 80 },
    ];
    const stepped = (rows: typeof ROWS) => (
      <div style={{ width: 300, padding: 16 }}>
        <button type="button">Før</button>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data={rows}
            config={config(50)}
            xKey="name"
            xScale="point"
            data-intro="none"
            aria-label="Spotpris">
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.ActiveDot dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const { host, rerender } = renderThemed(stepped(pair));
    roleNamed("button", "Før").focus();
    await userEvent.keyboard("{Tab}{Home}");
    await nextFrames(2);
    await userEvent.keyboard("{ArrowRight}");
    // The glide from 20 to 80 lands.
    await nextFrames(60);
    await Promise.allSettled(
      dotLayer(host)
        ?.getAnimations()
        .map((animation) => animation.finished) ?? []
    );
    const { above } = roles(host);
    expect(fillOf(activeDot(host))).toBe(above);
    rerender(stepped([{ name: "z", v: 60 }, ...pair]));
    // DOM audit: the active dot's outgoing copy is aria-hidden plot output.
    const copy = host.querySelector('[data-slot="chart-active-dot"][data-outgoing] [data-slot="chart-dot"]');
    expect(copy, "an outgoing active dot").not.toBeNull();
    expect(fillOf(copy)).toBe(above);
  });

  it("paints each marker by its reading's side", async () => {
    const { host } = chart(
      <>
        <Chart.Line dataKey="v" curve="step-after" />
        <Chart.Marker dataKey="v" at="max" />
        <Chart.Marker dataKey="v" at="min" variant="ping" />
      </>
    );
    await nextFrames(2);
    // DOM audit: markers are aria-hidden plot output, one layer per Marker in tree order.
    const [max, min] = [...host.querySelectorAll('[data-slot="chart-marker"]')].map((marker) =>
      [...marker.querySelectorAll('[data-slot="chart-dot"]')].map(fillOf)
    );
    const { below, above } = roles(host);
    expect(max).toEqual([above]);
    // A ping ring wears its dot's paint.
    expect(min).toEqual([below, below]);
  });
});
