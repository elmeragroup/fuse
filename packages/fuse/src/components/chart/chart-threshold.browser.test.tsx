// Threshold colours in Chromium. Units under test: the marks, the legend and the readouts of a
// series whose config colour is a ChartThresholdColor. Oracles: the theme's own sentiment roles,
// resolved through a probe outside every chart rule; the rule ChartThresholdColor documents, a
// value above the threshold paints `above` and a value at it or below paints `below`; the
// threshold's y, where a ReferenceLine at the same number draws; and labels written by hand.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { bars, popup } from "../../../test/chart/marks";
import { pagePixels } from "../../../test/chart/media";
import type { PagePixels } from "../../../test/chart/media";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartSeriesConfig } from "./chart-types";
import "./chart.css";

/** Four categories whose values sit below, above, below and above 50. */
const ROWS = [
  { name: "a", v: 20 },
  { name: "b", v: 80 },
  { name: "c", v: 30 },
  { name: "d", v: 70 },
];

function config(threshold: number, projectedFrom?: string): ChartConfig {
  const series: ChartSeriesConfig = {
    label: "Spotpris",
    color: {
      threshold,
      below: { color: "chart-sentiment-positive", label: "Under snittet" },
      above: { color: "chart-sentiment-negative", label: "Over snittet" },
    },
  };
  if (projectedFrom !== undefined) series.projectedFrom = projectedFrom;
  return { v: series };
}

function chart(
  marks: ReactNode,
  options: { readonly threshold?: number; readonly projectedFrom?: string; readonly rows?: typeof ROWS } = {}
) {
  return renderThemed(
    <div style={{ width: 400, padding: 16 }}>
      <button type="button">Før</button>
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={options.rows ?? ROWS}
          config={config(options.threshold ?? 50, options.projectedFrom)}
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

/** The two sides' channels in this theme. */
function sides(host: HTMLElement) {
  return {
    below: channels(resolved(host, "var(--chart-sentiment-positive)")),
    above: channels(resolved(host, "var(--chart-sentiment-negative)")),
  };
}

/** The rule's box: its y is the threshold's, and its run spans the plot. */
function rule(host: HTMLElement): DOMRect {
  // DOM audit: the reference rule is aria-hidden plot output.
  const line = host.querySelector('[data-slot="chart-reference-rule"]');
  if (line === null) throw new Error("no reference rule");
  return line.getBoundingClientRect();
}

/** A pixel's channels at a point in CSS pixels. */
function pixelAt(pixels: PagePixels, x: number, y: number): number[] {
  const index = (Math.round(y * pixels.scale) * pixels.width + Math.round(x * pixels.scale)) * 4;
  return [...pixels.data.subarray(index, index + 3)];
}

/** The most saturated pixel in a box, which is a coloured mark's over the grey grid and rule. */
function strongestIn(pixels: PagePixels, box: { x0: number; x1: number; y0: number; y1: number }): number[] {
  let best: number[] = [0, 0, 0];
  let chroma = -1;
  for (let y = box.y0; y <= box.y1; y += 1 / pixels.scale) {
    for (let x = box.x0; x <= box.x1; x += 1 / pixels.scale) {
      const pixel = pixelAt(pixels, x, y);
      const spread = Math.max(...pixel) - Math.min(...pixel);
      if (spread > chroma) {
        chroma = spread;
        best = pixel;
      }
    }
  }
  return best;
}

const near = (actual: number[], expected: number[]): boolean =>
  actual.every((channel, index) => Math.abs(channel - (expected[index] ?? 0)) <= 12);

/** The centre of slot `index` of four band slots along the rule's run. */
const slotCentre = (box: DOMRect, index: number) => box.left + ((index + 0.5) * box.width) / 4;

describe("a threshold-coloured line", () => {
  it("strokes each step in its side's role and splits a riser at the threshold's y", async () => {
    const { host } = chart(<Chart.Line dataKey="v" curve="step-after" />);
    await nextFrames(2);
    const { below, above } = sides(host);
    const box = rule(host);
    const pixels = await pagePixels();
    // Each step's run, scanned top to bottom at its slot's centre, is the column's coloured pixel.
    const steps = [0, 1, 2, 3].map((index) =>
      strongestIn(pixels, {
        x0: slotCentre(box, index),
        x1: slotCentre(box, index),
        y0: box.top - 100,
        y1: box.top + 100,
      })
    );
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
    expect(near(tail[0] ?? [], below), JSON.stringify(tail)).toBe(true);
    expect(near(tail[1] ?? [], above), JSON.stringify(tail)).toBe(true);
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
      const steps = [0, 1, 2, 3].map((index) =>
        strongestIn(pixels, {
          x0: slotCentre(box, index),
          x1: slotCentre(box, index),
          y0: box.top - 100,
          y1: box.top + 100,
        })
      );
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
    const positive = resolved(host, "var(--chart-sentiment-positive)");
    const negative = resolved(host, "var(--chart-sentiment-negative)");
    expect(bars(host).map((bar) => getComputedStyle(bar).fill)).toEqual([
      positive,
      negative,
      positive,
      negative,
    ]);
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
      color: {
        threshold: 50,
        below: { color: "chart-sentiment-positive", label: "Under snittet" },
        above: { color: "chart-sentiment-negative", label: "Over snittet" },
      },
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
    const positive = resolved(host, "var(--chart-sentiment-positive)");
    const negative = resolved(host, "var(--chart-sentiment-negative)");
    expect(drawn(host, "projected")).toEqual([
      { columns: 1, stroke: positive },
      { columns: 50, stroke: negative },
    ]);
  });

  it("keeps an estimated reading's side: 2 estimated above, 1 estimated below", () => {
    const { host } = pathForm();
    const positive = resolved(host, "var(--chart-sentiment-positive)");
    const negative = resolved(host, "var(--chart-sentiment-negative)");
    expect(drawn(host, "estimated")).toEqual([
      { columns: 1, stroke: positive },
      { columns: 2, stroke: negative },
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
    const { host } = emphasised({
      threshold: 50,
      below: { color: "chart-sentiment-positive", label: "Under snittet" },
      above: { color: "chart-sentiment-negative", label: "Over snittet" },
    });
    expect(boxFills(host)).toEqual([resolved(host, "var(--chart-sentiment-negative)")]);
  });

  it("paints the box over a scale series' maximum in the scale's top step", () => {
    // chart-seq bins 20 to 80 in 7 equal steps, so the maximum takes step 7.
    const { host } = emphasised("chart-seq");
    expect(boxFills(host)).toEqual([resolved(host, "var(--chart-seq-7)")]);
  });
});

describe("the glow of a threshold series", () => {
  /**
   * Whether a halo pixel leans toward the above role rather than the below one: its offset from the
   * surface, projected on the line from the below role to the above role.
   */
  function leansAbove(host: HTMLElement, pixel: number[]): boolean {
    const { below, above } = sides(host);
    const surface = channels(resolved(host, "var(--background)"));
    const lean = pixel.reduce(
      (sum, channel, index) =>
        sum + (channel - (surface[index] ?? 0)) * ((above[index] ?? 0) - (below[index] ?? 0)),
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
    expect(
      swatches.map((swatch) => (swatch === null ? "" : getComputedStyle(swatch).backgroundColor))
    ).toEqual([
      resolved(host, "var(--chart-sentiment-negative)"),
      resolved(host, "var(--chart-sentiment-positive)"),
    ]);
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
    const positive = resolved(host, "var(--chart-sentiment-positive)");
    const negative = resolved(host, "var(--chart-sentiment-negative)");
    // DOM audit: the active dot and the tooltip are aria-hidden plot output.
    const dot = () => host.querySelector('[data-slot="chart-active-dot"] [data-slot="chart-dot"]');
    const swatch = () => popup()?.querySelector('[data-slot="chart-swatch"]') ?? null;
    page.getByRole("button", { name: "Før" }).element().focus();
    await userEvent.keyboard("{Tab}{Home}");
    await nextFrames(2);
    const first = [dot(), swatch()].map((node) => (node === null ? "" : getComputedStyle(node)));
    expect(first.map((style) => (style === "" ? "" : style.fill))[0]).toBe(positive);
    expect(first.map((style) => (style === "" ? "" : style.backgroundColor))[1]).toBe(positive);
    expect(popup()?.querySelector('[data-slot="chart-series-label"]')?.textContent).toBe("Spotpris");
    await userEvent.keyboard("{ArrowRight}");
    await nextFrames(2);
    const node = dot();
    const shown = swatch();
    expect(node === null ? "" : getComputedStyle(node).fill).toBe(negative);
    expect(shown === null ? "" : getComputedStyle(shown).backgroundColor).toBe(negative);
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
    const positive = resolved(host, "var(--chart-sentiment-positive)");
    const negative = resolved(host, "var(--chart-sentiment-negative)");
    // DOM audit: the dots and their outgoing copies are aria-hidden plot output.
    const copies = [
      ...host.querySelectorAll('[data-slot="chart-dots"] [data-outgoing] [data-slot="chart-dot"]'),
    ].map((dot) => getComputedStyle(dot).fill);
    expect(copies).toEqual([positive, negative, positive, negative]);
    const live = [
      ...host.querySelectorAll('[data-slot="chart-dots"] [data-slot="chart-dot"]:not([data-outgoing] *)'),
    ].map((dot) => getComputedStyle(dot).fill);
    expect(live).toEqual([negative, positive, negative, positive, negative]);
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
    page.getByRole("button", { name: "Før" }).element().focus();
    await userEvent.keyboard("{Tab}{Home}");
    await nextFrames(2);
    await userEvent.keyboard("{ArrowRight}");
    // The glide from 20 to 80 lands.
    await nextFrames(60);
    // DOM audit: the active dot and its outgoing copy are aria-hidden plot output.
    const dot = host.querySelector('[data-slot="chart-active-dot"] [data-slot="chart-dot"]');
    await Promise.allSettled(
      host
        .querySelector('[data-slot="chart-active-dot"]')
        ?.getAnimations()
        .map((a) => a.finished) ?? []
    );
    const negative = resolved(host, "var(--chart-sentiment-negative)");
    expect(dot === null ? "" : getComputedStyle(dot).fill).toBe(negative);
    rerender(stepped([{ name: "z", v: 60 }, ...pair]));
    const copy = host.querySelector('[data-slot="chart-active-dot"][data-outgoing] [data-slot="chart-dot"]');
    expect(copy, "an outgoing active dot").not.toBeNull();
    expect(copy === null ? "" : getComputedStyle(copy).fill).toBe(negative);
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
      [...marker.querySelectorAll('[data-slot="chart-dot"]')].map((dot) => getComputedStyle(dot).fill)
    );
    expect(max).toEqual([resolved(host, "var(--chart-sentiment-negative)")]);
    // A ping ring wears its dot's paint.
    expect(min).toEqual([
      resolved(host, "var(--chart-sentiment-positive)"),
      resolved(host, "var(--chart-sentiment-positive)"),
    ]);
  });
});
