// ScatterChart's Root and marks in Chromium. Unit under test: the whole path from Root's rows to
// the drawn `d`, the grid and axis placements, the server HTML and the data rules. Oracles: pixels
// worked out by hand on a 200 by 140 px plot over x [−2, 18] and y [20 000, 160 000], where x = 2
// sits 40 px from the left and y = 90 000 sits 70 px from the top, and sentences written by hand.
import type { ReactNode } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { chromaAt, pagePixels } from "../../../test/chart/media";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

type Row = { readonly t: number | null; readonly kwh: number | null; readonly s: string };

/** Points whose extents nice to exactly [−2, 18] and [20 000, 160 000]. */
const ROWS: readonly Row[] = [
  { t: 18, kwh: 160_000, s: "now" },
  { t: -2, kwh: 20_000, s: "now" },
  { t: 2, kwh: 90_000, s: "now" },
  { t: 2, kwh: 90_000, s: "normal" },
  { t: -2, kwh: 20_000, s: "normal" },
  { t: 18, kwh: 160_000, s: "normal" },
];

/** A scatter chart with no axes, so its plot is the whole 200 by 140 px frame, and no entrance. */
function Scatter({
  data = ROWS,
  children,
}: {
  readonly data?: readonly Row[];
  readonly children: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 200 }}>
        <ScatterChart.Root
          data={data}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          xFormat={{ style: "unit", unit: "celsius" }}
          valueFormat={{ preset: "energy", unit: "kWh" }}
          xLabel="Temperatur"
          yLabel="Forbruk"
          data-intro="none"
          aria-label="Forbruk mot temperatur"
          style={{ "--chart-plot-height": "140px" }}>
          {children}
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The `d` of every points path, in part order. */
function pointPaths(host: HTMLElement): (string | null)[] {
  // DOM audit: the points are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-points-path"]')].map((path) => path.getAttribute("d"));
}

/** A line attribute of every element a selector matches, as numbers. */
function numbers(host: HTMLElement, selector: string, attribute: string): number[] {
  // DOM audit: grid lines and reference rules are aria-hidden plot output.
  return [...host.querySelectorAll(selector)].map((line) => Number(line.getAttribute(attribute)));
}

describe("ScatterChart marks", () => {
  it("draws a series' points as one path of dots at the hand-computed pixels", async () => {
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    // DOM audit: the plot box is Root's measured element.
    const plot = host.querySelector('[data-slot="chart-plot"]')?.getBoundingClientRect();
    expect([plot?.width, plot?.height]).toEqual([200, 140]);
    // An 8 px dot is 8 device pixels across, an even count, so each centre sits on a pixel edge.
    // The path lists the points in x order: (−2, 20 000), (2, 90 000), (18, 160 000).
    await expect.poll(() => pointPaths(host)).toEqual(["M0 140h0M40 70h0M200 0h0"]);
    expect(host.querySelector('[data-slot="chart-points-path"]')?.getAttribute("stroke-width")).toBe("8");
  });

  it("joins a line's points in x order, whatever the row order", async () => {
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.Line dataKey="normal" />
      </Scatter>
    );
    await expect
      .poll(() => host.querySelector('[data-slot="chart-line"]')?.getAttribute("d"))
      .toBe("M0,140L40,70L200,0");
  });

  it("draws grid lines on every x and y tick, each a hairline on the pixel grid", async () => {
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.Grid />
      </Scatter>
    );
    // x ticks every 2 from −2 to 18 lie 20 px apart, y ticks every 20 000 lie 20 px apart, and a
    // 1 px rule centres half a pixel past its edge.
    await expect
      .poll(() => numbers(host, '[data-slot="chart-grid-line"][data-axis="x"]', "x1"))
      .toEqual([0.5, 20.5, 40.5, 60.5, 80.5, 100.5, 120.5, 140.5, 160.5, 180.5, 200.5]);
    expect(numbers(host, '[data-slot="chart-grid-line"][data-axis="value"]', "y1")).toEqual([
      140.5, 120.5, 100.5, 80.5, 60.5, 40.5, 20.5, 0.5,
    ]);
  });

  it("draws a vertical reference line at x = 0 and a horizontal one at 90 000", async () => {
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.ReferenceLine x={0} />
        <ScatterChart.ReferenceLine y={90_000} label="Budsjett {value}" />
      </Scatter>
    );
    // 0 °C lies 2 of the domain's 20 from its start, 20 px, and 90 000 lies 70 px from the top.
    await expect.poll(() => numbers(host, '[data-slot="chart-reference-rule"]', "x1")).toEqual([20.5, 0]);
    expect(numbers(host, '[data-slot="chart-reference-rule"]', "y1")).toEqual([0, 70.5]);
    // DOM audit: the reference sentences are visually hidden text, which no role names.
    expect(
      [...host.querySelectorAll('[data-slot="chart-reference-text"]')].map((node) => node.textContent)
    ).toEqual([
      "Referanselinje: 0\u00a0grader\u00a0celsius",
      "Referanselinje: Budsjett 90\u00a0000\u00a0kilowattimer",
    ]);
  });

  it("labels the axes in Root's formats and places each tick at its share of the domain", () => {
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.XAxis label="Ukemiddeltemperatur (°C)" />
        <ScatterChart.YAxis format={{ maximumFractionDigits: 0 }} />
      </Scatter>
    );
    // DOM audit: axes are aria-hidden plot output.
    const xTicks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')];
    expect(xTicks.map((tick) => tick.textContent)).toEqual([
      "−2\u00a0°C",
      "0\u00a0°C",
      "2\u00a0°C",
      "4\u00a0°C",
      "6\u00a0°C",
      "8\u00a0°C",
      "10\u00a0°C",
      "12\u00a0°C",
      "14\u00a0°C",
      "16\u00a0°C",
      "18\u00a0°C",
    ]);
    expect(xTicks.map((tick) => tick.style.getPropertyValue("--chart-at"))).toEqual([
      "0",
      "0.1",
      "0.2",
      "0.3",
      "0.4",
      "0.5",
      "0.6",
      "0.7",
      "0.8",
      "0.9",
      "1",
    ]);
    // DOM audit: the y axis ticks are aria-hidden plot output, so their slot is the only locator.
    const yTicks = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-y-tick"]')];
    expect(yTicks.map((tick) => tick.textContent)).toEqual([
      "20\u00a0000",
      "40\u00a0000",
      "60\u00a0000",
      "80\u00a0000",
      "100\u00a0000",
      "120\u00a0000",
      "140\u00a0000",
      "160\u00a0000",
    ]);
    expect(yTicks.map((tick) => tick.style.getPropertyValue("--chart-at"))[0]).toBe("100%");
    // DOM audit: the axis title is aria-hidden plot output, which no role names.
    expect(host.querySelector('[data-slot="chart-axis-label"]')?.textContent).toBe(
      "Ukemiddeltemperatur (°C)"
    );
  });
});

describe("ScatterChart Root", () => {
  it("renders the final figure on the server, with no mark drawn before the browser measures", () => {
    const html = renderToString(
      <Scatter>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    const template = document.createElement("template");
    template.innerHTML = html;
    const figure = template.content.querySelector("figure");
    expect(figure?.getAttribute("aria-label")).toBe("Forbruk mot temperatur");
    expect(template.content.querySelector('[role="listbox"] [role="option"]')).not.toBeNull();
    // DOM audit: the server HTML is a detached fragment, and the marks and the description are
    // aria-hidden or visually hidden, so their slots are the only locators.
    expect(template.content.querySelector('[data-slot="chart-points"]')).not.toBeNull();
    expect(template.content.querySelector('[data-slot="chart-points-path"]')).toBeNull();
    expect(template.content.querySelector('[data-slot="chart-description"]')?.textContent).toBe(
      // Fuse writes every space inside a number, a unit and a count as U+00A0.
      "Forbruk 2026: 3\u00a0punkter, Temperatur minus\u00a02\u00a0grader\u00a0celsius til 18\u00a0grader\u00a0celsius, Forbruk 20\u00a0000\u00a0kilowattimer til 160\u00a0000\u00a0kilowattimer. " +
        "Normalforbruk: 3\u00a0punkter, Temperatur minus\u00a02\u00a0grader\u00a0celsius til 18\u00a0grader\u00a0celsius, Forbruk 20\u00a0000\u00a0kilowattimer til 160\u00a0000\u00a0kilowattimer."
    );
  });

  it("throws non-finite-x in development for a NaN x, naming the row and the column", () => {
    renderThemed(
      <CaughtError>
        <Scatter data={[...ROWS, { t: Number.NaN, kwh: 1, s: "now" }]}>
          <ScatterChart.Points dataKey="now" />
        </Scatter>
      </CaughtError>
    );
    expect(caughtError().name).toBe("ChartDataError");
    expect(caughtError().message).toContain('Row 6 of "t"');
  });

  it("skips a row with a null x or y quietly", async () => {
    const { host } = renderThemed(
      <Scatter data={[...ROWS, { t: null, kwh: 1, s: "now" }, { t: 4, kwh: null, s: "now" }]}>
        <ScatterChart.Points dataKey="now" />
      </Scatter>
    );
    await expect.poll(() => pointPaths(host)).toEqual(["M0 140h0M40 70h0M200 0h0"]);
  });

  it("throws unknown-key for a part that names no config key", () => {
    renderThemed(
      <CaughtError>
        <Scatter>
          <ScatterChart.Points dataKey="missing" />
        </Scatter>
      </CaughtError>
    );
    expect(caughtError().name).toBe("ChartCompositionError");
    expect(caughtError().message).toContain('"missing"');
  });

  it("sweeps the points and the line in from the left once, when the plot comes into view", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200 }}>
          <ScatterChart.Root
            data={ROWS}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Inngang">
            <ScatterChart.Points dataKey="now" />
            <ScatterChart.Line dataKey="normal" />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the marks are aria-hidden plot output, and Root carries the entrance state.
    const wipes = () =>
      [...host.querySelectorAll('[data-slot="chart-points"], [data-slot="chart-line-series"]')].map((layer) =>
        layer
          .getAnimations()
          .flatMap((animation) => (animation instanceof CSSAnimation ? [animation.animationName] : []))
          .join()
      );
    await expect.poll(wipes).toEqual(["chart-wipe-left", "chart-wipe-left"]);
    // Once the wipe ends, Root drops the attribute, so no layer wipes again.
    for (const animation of document.getAnimations()) animation.finish();
    await expect
      .poll(() => host.querySelector('[data-slot="chart"]')?.hasAttribute("data-entrance"))
      .toBe(false);
  });

  it("glides the domains to fit a data update, and the points with them", async () => {
    const clock = installFrameClock();
    try {
      const { host, rerender } = renderThemed(
        <Scatter>
          <ScatterChart.Points dataKey="now" />
        </Scatter>
      );
      await expect.poll(() => pointPaths(host)).toEqual(["M0 140h0M40 70h0M200 0h0"]);
      // A point at 38 °C widens x to [−5, 40]: 40 / 10 = 4, between √10 and √50, so the step is 5.
      // There (2, 90 000) sits 7 of 45 from the start, 31.1 px, which snaps to 31.
      rerender(
        <Scatter data={[...ROWS, { t: 38, kwh: 90_000, s: "now" }]}>
          <ScatterChart.Points dataKey="now" />
        </Scatter>
      );
      const xOf = () => Number((pointPaths(host)[0] ?? "").split("M")[2]?.split(" ")[0]);
      clock.frameAt(clock.now());
      // Mid-glide the domain lies between the two, so the point does too.
      // React renders a store change in a microtask, so each frame's drawing is polled.
      clock.frameAt(clock.now() + 240);
      await expect.poll(xOf).toBeLessThan(40);
      expect(xOf()).toBeGreaterThan(31);
      clock.frameAt(clock.now() + 480);
      await expect.poll(xOf).toBe(31);
    } finally {
      clock.restore();
    }
  });
});

describe("ScatterChart mid-glide", () => {
  const SQUARE = { a: { label: "A", color: "chart-1" } } as const satisfies ChartConfig;
  type Point = { readonly t: number; readonly v: number; readonly s: string };

  /** A chart of series a, or the config's series, on a 200 by 140 px plot, its marks and guides as children. */
  function Square({
    data,
    config = SQUARE,
    children,
  }: {
    readonly data: readonly Point[];
    readonly config?: ChartConfig;
    readonly children: ReactNode;
  }) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <div style={{ width: 200 }}>
            <ScatterChart.Root
              data={data}
              config={config}
              xKey="t"
              yKey="v"
              seriesKey="s"
              data-intro="none"
              aria-label="Glid"
              style={{ "--chart-plot-height": "140px" }}>
              {children}
            </ScatterChart.Root>
          </div>
        </div>
      </LocaleProvider>
    );
  }

  it("finds a point where it draws while the domains glide", async () => {
    // x spans [0, 10] and widens to [0, 20] on the update. On the glide's first frame the marks
    // still draw under [0, 10], so (5, 0) sits at (100, 140), where the new domain would put 10.
    const clock = installFrameClock();
    try {
      const before = [
        { t: 0, v: 0, s: "a" },
        { t: 5, v: 0, s: "a" },
        { t: 10, v: 10, s: "a" },
      ];
      const parts = <ScatterChart.Points dataKey="a" size="lg" />;
      const { host, rerender } = renderThemed(
        <Square data={before}>
          {parts}
          <ScatterChart.ActiveDot />
        </Square>
      );
      // DOM audit: the points and the active dot are aria-hidden plot output.
      await expect.poll(() => host.querySelector('[data-slot="chart-points-path"]')).not.toBeNull();
      rerender(
        <Square data={[...before, { t: 20, v: 10, s: "a" }]}>
          {parts}
          <ScatterChart.ActiveDot />
        </Square>
      );
      clock.frameAt(clock.now());
      await userEvent.hover(page.getByRole("listbox"), { position: { x: 100, y: 138 } });
      const ring = () =>
        host.querySelector('[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]');
      // An 11 px dot is an odd count of pixels across, so its centre sits half a pixel in.
      await expect.poll(() => ring()?.getAttribute("cx")).toBe("100.5");
    } finally {
      clock.restore();
    }
  });

  it("keeps a point the domains have not reached inside the plot, and an edge dot whole", async () => {
    // x spans [0, 10] and widens to [0, 13] on the update: 13 / 10 = 1.3, under √2, so the step is
    // 1. On the glide's first frame the marks still draw under [0, 10], so (13, 5) would draw at
    // (260, 70), 60 px past the plot's right edge.
    const clock = installFrameClock();
    try {
      const before = [
        { t: 0, v: 0, s: "a" },
        { t: 10, v: 10, s: "a" },
      ];
      const { host, rerender } = renderThemed(
        <Square data={before}>
          <ScatterChart.Points dataKey="a" size="lg" />
        </Square>
      );
      // DOM audit: the points are aria-hidden plot output.
      await expect.poll(() => host.querySelector('[data-slot="chart-points-path"]')).not.toBeNull();
      rerender(
        <Square data={[...before, { t: 13, v: 5, s: "a" }]}>
          <ScatterChart.Points dataKey="a" size="lg" />
        </Square>
      );
      clock.frameAt(clock.now());
      // DOM audit: the plot box is Root's measured element.
      const plot = host.querySelector('[data-slot="chart-plot"]')?.getBoundingClientRect() ?? new DOMRect();
      await expect
        .poll(() => host.querySelector('[data-slot="chart-points-path"]')?.getAttribute("d"))
        .toContain("M260.5 70.5h0");
      const pixels = await pagePixels();
      const at = (x: number, y: number) =>
        chromaAt(pixels, (plot.left + x) * pixels.scale, (plot.top + y) * pixels.scale);
      // Past the plot, where (13, 5) would draw, the page shows through.
      expect(at(260, 70)).toBeLessThan(20);
      // (10, 10) sits on the top right corner, an 11 px dot: 3 px out and 3 px down it paints.
      expect(at(203, 3)).toBeGreaterThan(60);
      // A control inside the plot: (0, 0) at the bottom left corner paints.
      expect(at(3, 137)).toBeGreaterThan(60);
    } finally {
      clock.restore();
    }
  });
});

describe("the active ring mid-glide", () => {
  const PAIR = {
    a: { label: "A", color: "chart-1" },
    b: { label: "B", color: "chart-2" },
  } as const satisfies ChartConfig;
  type Point = { readonly t: number; readonly v: number; readonly s: string };
  /** B holds the domains at [0, 10] on both axes, from (0, 140) to (200, 0) on the plot. */
  const B: readonly Point[] = [
    { t: 0, v: 0, s: "b" },
    { t: 10, v: 10, s: "b" },
  ];

  function Pair({ data }: { readonly data: readonly Point[] }) {
    return (
      <LocaleProvider locale="nb-NO">
        {/* The margin keeps a ring that leaves the plot inside the viewport, where pixels read. */}
        <div style={{ width: 300, margin: 20 }}>
          <div style={{ width: 200 }}>
            <ScatterChart.Root
              data={data}
              config={PAIR}
              xKey="t"
              yKey="v"
              seriesKey="s"
              data-intro="none"
              aria-label="Glid"
              style={{ "--chart-plot-height": "140px" }}>
              <ScatterChart.Points dataKey="a" size="lg" />
              <ScatterChart.Points dataKey="b" size="lg" />
              <ScatterChart.ActiveDot />
            </ScatterChart.Root>
          </div>
        </div>
      </LocaleProvider>
    );
  }

  /** The strongest chroma in a box of plot pixels, from its left top corner to its right bottom one. */
  async function strongest(host: HTMLElement, x0: number, y0: number, x1: number, y1: number) {
    // DOM audit: the plot box is Root's measured element.
    const plot = host.querySelector('[data-slot="chart-plot"]')?.getBoundingClientRect() ?? new DOMRect();
    const pixels = await pagePixels();
    let most = 0;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        most = Math.max(
          most,
          chromaAt(pixels, (plot.left + x) * pixels.scale, (plot.top + y) * pixels.scale)
        );
      }
    }
    return most;
  }

  /**
   * The strongest chroma in a box, read after each of up to 60 real frames until it passes
   * `least`, since paint outside the plot reaches a screenshot only once a frame has run.
   */
  async function paintsBy(host: HTMLElement, box: readonly [number, number, number, number], least: number) {
    let most = 0;
    for (let frame = 0; frame < 60 && most <= least; frame += 1) {
      await nextFrames();
      most = await strongest(host, ...box);
    }
    return most;
  }

  /** The active ring's centre, or null while none shows. */
  function ring(host: HTMLElement): readonly [string | null, string | null] | null {
    // DOM audit: the active dot is aria-hidden plot output.
    const dot = host.querySelector('[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]');
    return dot === null ? null : [dot.getAttribute("cx"), dot.getAttribute("cy")];
  }

  it("stays inside the plot while the domains glide toward the pinned point", async () => {
    // A's (5, 5) at (100, 70) becomes (15, 5). x widens to [0, 15]: 15 / 10 = 1.5, between √2 and
    // √10, so the step is 2 and the domain [0, 16]. On the glide's first frame the marks still draw
    // under [0, 10], so the carried point and its 8.5 px ring sit at (300, 70), 100 px past the
    // plot's right edge.
    const clock = installFrameClock();
    try {
      const { host, rerender } = renderThemed(<Pair data={[...B, { t: 5, v: 5, s: "a" }]} />);
      await userEvent.click(page.getByRole("listbox"), { position: { x: 100, y: 70 } });
      await expect.poll(() => ring(host)).toEqual(["100.5", "70.5"]);
      // The ring paints left of the point, past its 5.5 px radius.
      await expect.poll(() => strongest(host, 91, 69, 94, 72)).toBeGreaterThan(60);
      rerender(<Pair data={[...B, { t: 15, v: 5, s: "a" }]} />);
      clock.frameAt(clock.now());
      await expect.poll(() => ring(host)?.[0]).toBe("300.5");
      // Past the plot, where the ring would paint, the page shows through.
      expect(await strongest(host, 288, 58, 312, 82)).toBeLessThan(20);
    } finally {
      // The glide runs to its end before the clock goes, so no frame loop waits on a fake frame.
      clock.frameAt(clock.now() + 2000);
      clock.restore();
    }
  });

  it("stays whole around a pinned point on the plot's corner", async () => {
    // A's (10, 10) sits on the top right corner, an 11 px dot with an 8.5 px ring, which reaches
    // 8.5 px past the plot to the right and above. A paints in a chromatic role.
    const { host } = renderThemed(
      <Pair
        data={[
          { t: 0, v: 0, s: "b" },
          { t: 5, v: 5, s: "a" },
          { t: 10, v: 10, s: "a" },
        ]}
      />
    );
    await userEvent.click(page.getByRole("listbox"), { position: { x: 199, y: 1 } });
    await expect.poll(() => ring(host)).toEqual(["200.5", "0.5"]);
    // An earlier test can leave the page scrolled, which would push the ring's top out of view.
    scrollTo(0, 0);
    // The ring's stroke right of the corner, past the point's own 5.5 px radius, and above it.
    expect(await paintsBy(host, [206, -1, 210, 2], 60)).toBeGreaterThan(60);
    expect(await paintsBy(host, [199, -10, 202, -6], 60)).toBeGreaterThan(60);
  });
});

describe("ScatterChart reference segments", () => {
  it("draws nothing for a segment wholly outside the domains, and clips one that crosses an edge", async () => {
    // The domains are [−2, 18] and [20 000, 160 000] on 200 by 140 px. A segment from (−10, 90 000)
    // to (−5, 90 000) lies left of the plot. One from (−12, 90 000) to (2, 90 000) enters at x = −2,
    // the left edge, and ends at x = 2, 40 px in, both 70 px down.
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.ReferenceLine from={[-10, 90_000]} to={[-5, 90_000]} label="Ute" />
        <ScatterChart.ReferenceLine from={[-12, 90_000]} to={[2, 90_000]} label="Inne" />
      </Scatter>
    );
    // DOM audit: reference lines are aria-hidden plot output with a visually hidden sentence.
    const lines = [...host.querySelectorAll('[data-slot="chart-reference-line"]')];
    await expect.poll(() => lines[1]?.querySelector('[data-slot="chart-reference-rule"]')).not.toBeNull();
    expect(lines.map((line) => line.hasAttribute("data-outside"))).toEqual([true, false]);
    expect(lines[0]?.querySelector('[data-slot="chart-reference-rule"]')).toBeNull();
    const rule = lines[1]?.querySelector('[data-slot="chart-reference-rule"]');
    expect(["x1", "y1", "x2", "y2"].map((name) => Number(rule?.getAttribute(name)))).toEqual([0, 70, 40, 70]);
  });

  it("labels a segment at its last end, not at the plot's right edge", async () => {
    // A segment from (−2, 20 000) to (6, 90 000) ends at (6 + 2) / 20 = 40 % of the 200 px plot,
    // 80 px from its left, and 70 px down. Its label ends at the end's x and sits on its y.
    const { host } = renderThemed(
      <Scatter>
        <ScatterChart.ReferenceLine from={[-2, 20_000]} to={[6, 90_000]} label="Mål" />
      </Scatter>
    );
    // DOM audit: the reference line spans the plot, and its label is aria-hidden plot text.
    const line = host.querySelector('[data-slot="chart-reference-line"]');
    await expect.poll(() => line?.querySelector('[data-slot="chart-reference-rule"]')).not.toBeNull();
    const plot = line?.getBoundingClientRect() ?? new DOMRect();
    const label =
      line?.querySelector('[data-slot="chart-reference-label"]')?.getBoundingClientRect() ?? new DOMRect();
    expect(plot.width).toBe(200);
    expect(label.width).toBeGreaterThan(0);
    expect(label.right - plot.left).toBeCloseTo(80, 0);
    expect(label.bottom - plot.top).toBeCloseTo(70, 0);
  });
});
