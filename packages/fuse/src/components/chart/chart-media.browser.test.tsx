// The forced-colours and print judges of ticket 05, after pass 2's critic/media/media.mjs. Under
// forced colours, in Chromium, every bar keeps its series colour, compared by its
// chromatic pixel count with the on-screen render, an estimated bar keeps its dashed outline, and
// text, axes and the focus ring paint system colours. In Chromium a print PDF paints every bar,
// one chromatic fill per bar. WebKit's Playwright build emulates neither. The glow judge, E10,
// reads the halo above the tallest bars.
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, server, userEvent } from "vitest/browser";

import * as Oklab from "@elmeragroup/color/oklab";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import { contrastRatio } from "@elmeragroup/color/wcag";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import {
  chromaAt,
  chromaticPdfFills,
  chromaticPixels,
  emulateMedia,
  pagePixels,
} from "../../../test/chart/media";
import {
  fkasPrivate,
  renderThemed,
  snapshotDocumentTheme,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartBarVariant } from "./chart-types";
import "./chart.css";

const FORCED = server.browser === "chromium" || server.browser === "firefox";

afterEach(async () => {
  if (server.browser !== "webkit") await emulateMedia("screen", "none");
});

function plotRect(host: HTMLElement): DOMRect {
  // DOM audit: the bar series box is the plot box.
  return host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
}

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("forced colours", () => {
  it.runIf(FORCED)("keeps every bar's series colour", async () => {
    const { host } = renderThemed(
      <div style={{ width: 360 }}>
        <S06Chart>
          <Chart.Bar dataKey="household" />
          <Chart.Bar dataKey="cabin" />
        </S06Chart>
      </div>
    );
    await frame();
    const [screen = 0] = await chromaticPixels([plotRect(host)]);
    await emulateMedia("screen", "active");
    expect(window.matchMedia("(forced-colors: active)").matches).toBe(true);
    await frame();
    const [forced = 0] = await chromaticPixels([plotRect(host)]);
    expect(screen).toBeGreaterThan(1000);
    expect(Math.abs(forced - screen) / screen).toBeLessThanOrEqual(0.02);
  });

  it.runIf(FORCED)("keeps an estimated bar's dashed outline", async () => {
    const rows = [1, 2, 3].map((date) => ({
      day: new Date(Date.UTC(2025, 9, date, -2)),
      kwh: 4,
      q: date === 2 ? ("estimated" as const) : undefined,
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{ kwh: { label: "Forbruk", color: "chart-1", qualityKey: "q" } }}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            aria-label="Forbruk per dag">
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await emulateMedia("screen", "active");
    await frame();
    const plot = plotRect(host);
    // The middle band's bar spans 112.5 to 187.5 px. Its 1 px ring is the outline.
    const ring = { x: plot.x + 112, y: plot.y, width: 2, height: plot.height };
    const [left = 0] = await chromaticPixels([ring]);
    expect(left).toBeGreaterThan(20);
  });

  it.runIf(FORCED)("keeps a missing reading's dashed tick", async () => {
    // js1: the tick was a background gradient, which forced colours removes, so a missing day read
    // as an empty gap. The tick repeats 3 px of paint and 3 px of gap, so a 75 px cell holds 12 dashes.
    const rows = [1, 2, 3].map((date) => ({
      day: new Date(Date.UTC(2025, 9, date, -2)),
      kwh: 4,
      q: date === 2 ? ("missing" as const) : undefined,
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{ kwh: { label: "Forbruk", color: "chart-1", qualityKey: "q" } }}
            xKey="day"
            interval="day"
            timeZone="Europe/Oslo"
            aria-label="Forbruk per dag">
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await emulateMedia("screen", "active");
    await frame();
    // DOM audit: the missing tick is aria-hidden plot output.
    const tick =
      host.querySelector('[data-slot="chart-bar-missing"]')?.getBoundingClientRect() ?? new DOMRect();
    expect(tick.width).toBeGreaterThan(30);
    const pixels = await pagePixels();
    const at = (x: number, y: number) => {
      const index = (Math.round(y * pixels.scale) * pixels.width + Math.round(x * pixels.scale)) * 4;
      return [...pixels.data.subarray(index, index + 3)];
    };
    // The canvas colour sits a few pixels above the tick, inside the empty cell.
    const canvas = at(tick.left + tick.width / 2, tick.top - 6);
    const y = tick.top + tick.height / 2;
    let dashes = 0;
    let inside = false;
    for (let x = Math.ceil(tick.left); x < tick.right; x += 0.5) {
      const painted = at(x, y).some((channel, index) => Math.abs(channel - (canvas[index] ?? 0)) > 80);
      if (painted && !inside) dashes += 1;
      inside = painted;
    }
    expect(dashes).toBeGreaterThanOrEqual(Math.floor(tick.width / 6) - 1);
  });

  it.runIf(FORCED)("paints text, axes and the focus ring in system colours", async () => {
    const { host } = renderThemed(
      <div style={{ width: 360 }}>
        <span data-probe="" style={{ color: "CanvasText", outlineColor: "Highlight" }}>
          probe
        </span>
        <S06Chart>
          <Chart.Grid />
          <Chart.XAxis />
          <Chart.Bar dataKey="household" />
        </S06Chart>
      </div>
    );
    await emulateMedia("screen", "active");
    await frame();
    // DOM audit: the probe, ticks and grid lines read their computed colours.
    const probe = getComputedStyle(host.querySelector("[data-probe]") ?? document.body);
    const tick = host.querySelector('[data-slot="chart-x-tick"]') ?? document.body;
    const line = host.querySelector('[data-slot="chart-grid-line"]') ?? document.body;
    expect(getComputedStyle(tick).color).toBe(probe.color);
    expect(getComputedStyle(line).stroke).toBe(probe.color);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    // DOM audit: the within-target ring paints on the plot surface.
    const surface = getComputedStyle(host.querySelector('[data-slot="chart-surface"]') ?? document.body);
    expect(surface.outlineStyle).not.toBe("none");
  });
});

describe("a reference band under forced colours", () => {
  // The final recheck's row 49: forced colours dropped the band's pale fill and its label painted
  // nothing, so the capacity step vanished. The oracle is WCAG's 3:1 for marks against the forced
  // canvas, read from the page's pixels.
  it.runIf(FORCED)("keeps a 1 px border around the band and paints its label", async () => {
    const { host } = renderThemed(
      <div style={{ width: 360, padding: 16, background: "var(--background)" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data-intro="none"
            data={[1, 1, 1, 1].map((kwh, index) => ({ name: `k${String(index)}`, kwh }))}
            config={{ kwh: { label: "Usage", color: "chart-1" } }}
            xKey="name"
            yInclude={[6]}
            aria-label="Band">
            <Chart.ReferenceArea y1={3} y2={5} label="Capacity step" tone="muted" />
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await emulateMedia("screen", "active");
    expect(window.matchMedia("(forced-colors: active)").matches).toBe(true);
    await frame();
    // DOM audit: the band and its label are aria-hidden plot output.
    const area = host.querySelector('[data-slot="chart-reference-area"]')?.getBoundingClientRect();
    const label = host.querySelector('[data-slot="chart-reference-label"]')?.getBoundingClientRect();
    if (area === undefined || label === undefined) throw new Error("no band");
    const pixels = await pagePixels();
    const at = (x: number, y: number): Srgb.Srgb => {
      const index = (Math.round(y * pixels.scale) * pixels.width + Math.round(x * pixels.scale)) * 4;
      const [r = 0, g = 0, b = 0] = pixels.data.subarray(index, index + 3);
      return getOrThrow(Srgb.make({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 }));
    };
    const canvas = at(area.left + 4, area.top + 2);
    const marked = (x: number, y: number): boolean => getOrThrow(contrastRatio(at(x, y), canvas)) >= 3;
    // A domain of 0 to 6 puts the band from a sixth to half of the plot's height. Its top edge
    // reads in a column left of the right-aligned label, inside the band's first 2 px.
    const x = area.left + area.width * 0.25;
    const top = area.top + area.height / 6;
    const bottom = area.top + area.height / 2;
    expect([0, 1, 2].some((step) => marked(x, top - 0.5 + step * 0.5))).toBe(true);
    expect([0, 1, 2].some((step) => marked(x, bottom - 0.5 - step * 0.5))).toBe(true);
    // The band's inside stays clear between its edges.
    expect(marked(x, (top + bottom) / 2)).toBe(false);
    let ink = 0;
    for (let y = Math.ceil(label.top); y < label.bottom; y += 1) {
      for (let column = Math.ceil(label.left); column < label.right; column += 1) {
        if (marked(column, y)) ink += 1;
      }
    }
    expect(ink).toBeGreaterThan(20);
  });
});

describe("the glow halo", () => {
  // Oracle: the half-intensity width of the halo above the four tallest bars of evilcharts' shot
  // ex-glowing-desktop-bar-chart__728-light.png, 4.875 CSS px, which
  // .scratch/charts-v1/tools/l05-oracles/glow_halo.mjs measured from the frozen PNG. That script
  // judges E10 at the shot's device scale factor of 2 within the harness's 0.5 px. This guard runs
  // at a scale factor of 1, where one device pixel adds 0.5 px of reading error, so it allows 1 px.
  const REFERENCE_HALF_WIDTH = 4.875;
  const GUARD = 1;

  it("matches evilcharts' halo within half a pixel", async () => {
    const rows = [
      [342, 184],
      [876, 491],
      [512, 290],
      [629, 391],
      [458, 309],
      [781, 449],
      [394, 234],
      [925, 557],
      [647, 367],
      [532, 357],
      [803, 515],
      [271, 149],
    ].map(([desktop = 0, mobile = 0], index) => ({ month: `m${String(index)}`, desktop, mobile }));
    const { host } = renderThemed(
      <LocaleProvider locale="en-US">
        <div style={{ width: 588, padding: "24px 0" }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{
              desktop: { label: "Desktop", color: "chart-1" },
              mobile: { label: "Mobile", color: "chart-2" },
            }}
            xKey="month"
            style={{ "--chart-plot-height": "256px" }}
            aria-label="Glow">
            <Chart.Glow>
              <Chart.BarGroup series={["desktop", "mobile"]}>
                <Chart.Bar dataKey="desktop" />
                <Chart.Bar dataKey="mobile" />
              </Chart.BarGroup>
            </Chart.Glow>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await frame();
    const pixels = await pagePixels();
    // DOM audit: the desktop bars are aria-hidden plot output, read for their boxes.
    const tallest = [
      ...host.querySelectorAll('[data-slot="chart-bar-series"][data-series="0"] [data-slot="chart-bar"]'),
    ]
      .map((bar) => bar.getBoundingClientRect())
      .sort((a, b) => a.top - b.top)
      .slice(0, 4);
    const widths = tallest.map((box) => {
      const x = (box.left + box.width / 2) * pixels.scale;
      const top = box.top * pixels.scale;
      const edge = chromaAt(pixels, x, top - 1);
      for (let distance = 1; distance < 60 * pixels.scale; distance += 1) {
        const value = chromaAt(pixels, x, top - distance);
        if (value <= edge / 2) {
          const previous = chromaAt(pixels, x, top - distance + 1);
          const fraction = (previous - edge / 2) / Math.max(1, previous - value);
          return (distance - 2 + fraction) / pixels.scale;
        }
      }
      return Number.NaN;
    });
    // The median skips a bar whose top lands on a pixel boundary and reads no edge.
    const median = [...widths].sort((a, b) => a - b)[Math.floor(widths.length / 2)] ?? Number.NaN;
    expect(Math.abs(median - REFERENCE_HALF_WIDTH), JSON.stringify(widths)).toBeLessThanOrEqual(GUARD);
  });

  // Oracle: the line halo's half-intensity width in evilcharts' shot
  // ex-glowing-desktop-line-chart__728-light.png, read by E10's method on the normals at 35, 50 and
  // 65 % of its September to October and October to November segments: 9.75, 9.25, 10, 9.5 and
  // 9.5 CSS px, mean 9.6. A sixth read lands on a band of the PNG's 8-bit halo and reads 0.5, so it
  // is left out. Fuse draws the same rows at twice their size, so each device pixel of the shot has
  // one here. A 9.5 px drop-shadow reads 9.71 there and a 10 px one 10.08, so the 0.25 px guard
  // holds the nearer length.
  const LINE_REFERENCE_HALF_WIDTH = 9.6;
  const LINE_GUARD = 0.25;

  it.runIf(server.browser === "chromium")("matches evilcharts' line halo (F5)", async () => {
    const rows = [342, 876, 512, 629, 458, 781, 394, 925, 647, 532, 803, 271].map((desktop, index) => ({
      month: `m${String(index)}`,
      desktop,
    }));
    await page.viewport(1400, 900);
    try {
      const { host } = renderThemed(
        <LocaleProvider locale="en-US">
          <div style={{ width: 640, padding: 20, transform: "scale(2)", transformOrigin: "0 0" }}>
            <Chart.Root
              data-intro="none"
              data={rows}
              config={{ desktop: { label: "Desktop", color: "chart-1" } }}
              xKey="month"
              xScale="point"
              style={{ "--chart-plot-height": "300px" }}
              aria-label="Glow">
              <Chart.Glow>
                <Chart.Line dataKey="desktop" curve="linear" />
              </Chart.Glow>
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      await frame();
      // DOM audit: the line's path is aria-hidden plot output, read for its vertices.
      const path = host.querySelector('[data-slot="chart-line"][data-part="solid"]');
      const box =
        host.querySelector('[data-slot="chart-line-series"]')?.getBoundingClientRect() ?? new DOMRect();
      const pixels = await pagePixels();
      // Each CSS px of the path is 2 px on the page, and the page's pixels are the shot's.
      const scale = 2 * pixels.scale;
      const vertices = [...(path?.getAttribute("d") ?? "").matchAll(/[ML]\s*([\d.-]+)[ ,]([\d.-]+)/gu)].map(
        ([, x = "0", y = "0"]) => [
          (box.left + 2 * Number(x)) * pixels.scale,
          (box.top + 2 * Number(y)) * pixels.scale,
        ]
      );
      const widths = [
        [8, 9],
        [9, 10],
      ].flatMap(([from = 0, to = 0]) => {
        const [ax = 0, ay = 0] = vertices[from] ?? [];
        const [bx = 0, by = 0] = vertices[to] ?? [];
        const length = Math.hypot(bx - ax, by - ay);
        // The normal that points up, away from the plot below the line.
        const flip = ax > bx ? -1 : 1;
        const [nx, ny] = [(flip * (by - ay)) / length, (flip * (ax - bx)) / length];
        return [0.35, 0.5, 0.65].map((share) => {
          const [px, py] = [ax + (bx - ax) * share, ay + (by - ay) * share];
          // The stroke's centre is its most chromatic point within 8 device px of the vertex line.
          let peak = 0;
          let shift = 0;
          for (let step = -8; step <= 8; step += 0.25) {
            const value = chromaAt(pixels, px + nx * step, py + ny * step);
            if (value > peak) [peak, shift] = [value, step];
          }
          const profile = Array.from({ length: 80 }, (_, step) =>
            chromaAt(pixels, px + nx * (shift + step), py + ny * (shift + step))
          );
          // E10: from one device pixel past the stroke's edge, the distance where chroma halves.
          const start = profile.findIndex((value) => value <= peak / 2) + 1;
          const edge = profile[start] ?? 0;
          const half = profile.findIndex((value, step) => step > start && value <= edge / 2);
          const previous = profile[half - 1] ?? 0;
          const fraction = (previous - edge / 2) / Math.max(1, previous - (profile[half] ?? 0));
          return (half - 1 + fraction - start) / scale;
        });
      });
      const mean = widths.reduce((sum, width) => sum + width, 0) / widths.length;
      expect(Math.abs(mean - LINE_REFERENCE_HALF_WIDTH), JSON.stringify(widths)).toBeLessThanOrEqual(
        LINE_GUARD
      );
    } finally {
      await page.viewport(414, 896);
    }
  });
});

describe("print", () => {
  it.runIf(server.browser === "chromium")("paints every bar into the PDF", async () => {
    const { host } = renderThemed(
      <div style={{ width: 360 }}>
        <S06Chart />
      </div>
    );
    await frame();
    const { fills } = await chromaticPdfFills();
    // DOM audit: bars are aria-hidden plot output.
    expect(fills).toBeGreaterThanOrEqual(host.querySelectorAll('[data-slot="chart-bar"]').length);
    expect(host.querySelectorAll('[data-slot="chart-bar"]')).toHaveLength(24);
  });
});

describe("stack seams", () => {
  it("parts adjacent stack segments by a gap of the surface colour", async () => {
    // Chartability heuristic 1: stack segments that lack 3:1 between them are parted by the
    // surface, as the 1.4.11 Understanding page's figures 46 to 48 ask.
    const rows = ["a", "b", "c"].map((name) => ({ name, low: 4, high: 4 }));
    const { host } = renderThemed(
      <div style={{ width: 360, background: "var(--background)" }} data-surface="">
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{
              low: { label: "Lav", color: "chart-1", stack: "s" },
              high: { label: "Høy", color: "chart-2", stack: "s" },
            }}
            xKey="name"
            aria-label="Stabel">
            <Chart.Bar dataKey="low" />
            <Chart.Bar dataKey="high" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await frame();
    // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
    const lower = host
      .querySelector('[data-slot="chart-bar-series"][data-series="0"] [data-slot="chart-bar"]')
      ?.getBoundingClientRect();
    const upper = host
      .querySelector('[data-slot="chart-bar-series"][data-series="1"] [data-slot="chart-bar"]')
      ?.getBoundingClientRect();
    if (lower === undefined || upper === undefined) throw new Error("no stack");
    // The gap is the 2 px between the upper segment's bottom and the lower segment's top.
    expect(lower.top - upper.bottom).toBeCloseTo(2, 0);
    const pixels = await pagePixels();
    const sample = (x: number, y: number): Srgb.Srgb => {
      const index = (Math.round(y * pixels.scale) * pixels.width + Math.round(x * pixels.scale)) * 4;
      const [r = 0, g = 0, b = 0] = pixels.data.subarray(index, index + 3);
      return getOrThrow(Srgb.make({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 }));
    };
    const x = lower.left + lower.width / 2;
    const seam = sample(x, (lower.top + upper.bottom) / 2);
    const surface = sample(lower.left - 4, upper.top + 1);
    // The seam shows the surface, so the two read as one colour.
    expect(getOrThrow(contrastRatio(seam, surface))).toBeLessThan(1.05);
    const segments = [sample(x, lower.top + 4), sample(x, upper.bottom - 4)];
    for (const segment of segments) {
      expect(getOrThrow(contrastRatio(segment, surface))).toBeGreaterThan(1.5);
    }
  });
});

describe("patterned bars", () => {
  /**
   * How many runs of strongly painted pixels lie along a line. A pixel counts when its distance
   * from the white surface exceeds 60 % of the line's largest, so the full-paint stripes count and
   * the tinted gaps between them do not.
   */
  async function paintedRuns(points: readonly (readonly [number, number])[]): Promise<number> {
    const pixels = await pagePixels();
    const distances = points.map(([x, y]) => {
      const index = (Math.round(y * pixels.scale) * pixels.width + Math.round(x * pixels.scale)) * 4;
      return Math.max(...[...pixels.data.subarray(index, index + 3)].map((channel) => 255 - channel));
    });
    const strongest = Math.max(...distances);
    let runs = 0;
    let inside = false;
    for (const distance of distances) {
      const painted = distance > strongest * 0.6;
      if (painted && !inside) runs += 1;
      inside = painted;
    }
    return runs;
  }

  function oneBar(variant: "default" | "hatched" | "blocks", projected = false) {
    return renderThemed(
      <div style={{ width: 120, background: "#fff" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[{ name: "a", v: 8 }]}
            config={{
              v: { label: "V", color: "chart-1", projectedFrom: projected ? "a" : undefined, variant },
            }}
            xKey="name"
            aria-label="Mønster">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  function barBox(host: HTMLElement): DOMRect {
    // DOM audit: the bar is aria-hidden plot output.
    return host.querySelector('[data-slot="chart-bar"]')?.getBoundingClientRect() ?? new DOMRect();
  }

  it.each([
    ["the hatched variant", false],
    ["the projected hatch", true],
  ] as const)("draws %s as stripes", async (_, projected) => {
    // jp2: Firefox drew lab() stops of a repeating gradient as a line every 50 px. The hatch repeats
    // every 5 px at 45 degrees, so a horizontal line crosses a stripe every 7.07 px, and a 90 px
    // bar holds at least 10 of them.
    const { host } = oneBar(projected ? "default" : "hatched", projected);
    await frame();
    const box = barBox(host);
    const y = box.top + box.height / 2;
    const row = Array.from(
      { length: Math.floor(box.width) - 2 },
      (_, index) => [box.left + 1 + index, y] as const
    );
    expect(box.width).toBeGreaterThan(70);
    expect(await paintedRuns(row)).toBeGreaterThanOrEqual(Math.floor((box.width - 2) / 7.07) - 1);
  });

  it("draws a stacked upper segment as whole blocks from its own base", async () => {
    // B4-4: 4 and 6 stacked on 0–10 over 200 px. The upper segment's squares count from its base at
    // 120 px: [110, 120] up to [2, 12], with 2 px gaps at [108, 110] and [12, 14] and above 2 px.
    // Squares counted from the zero line instead would paint 109 and 13 and leave 117 and 9 bare.
    const { host } = renderThemed(
      <div style={{ width: 120, background: "#fff" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[{ name: "a", low: 4, high: 6 }]}
            config={{
              low: { label: "Lav", color: "chart-1", stack: "s", variant: "blocks" },
              high: { label: "Høy", color: "chart-1", stack: "s", variant: "blocks" },
            }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Blokker">
            <Chart.Bar dataKey="low" />
            <Chart.Bar dataKey="high" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await frame();
    // DOM audit: the bar series layers are aria-hidden plot output.
    const plot =
      host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
    const upper =
      host.querySelectorAll('[data-slot="chart-bar"]')[1]?.getBoundingClientRect() ?? new DOMRect();
    expect(plot.height).toBe(200);
    const pixels = await pagePixels();
    const x = upper.left + upper.width / 2;
    // Chromium draws the layer's origin on the nearest device pixel, a tie rounding up.
    const origin = Math.ceil(plot.top * pixels.scale - 0.5) / pixels.scale;
    const ink = (row: number): number => {
      const index =
        (Math.floor((origin + row + 0.5) * pixels.scale) * pixels.width + Math.floor(x * pixels.scale)) * 4;
      return Math.max(...[...pixels.data.subarray(index, index + 3)].map((channel) => 255 - channel));
    };
    expect([3, 9, 111, 117].map((row) => ink(row) > 60)).toEqual([true, true, true, true]);
    expect([0, 13, 109].map((row) => ink(row) < 12)).toEqual([true, true, true]);
  });

  it("draws blocks as squares 12 px apart", async () => {
    // jp2: Firefox drew the blocks as 1 px dashes. A block is a 10 px square with a 2 px gap, so a
    // vertical line through the bar crosses one block every 12 px.
    const { host } = oneBar("blocks");
    await frame();
    const box = barBox(host);
    const x = box.left + box.width / 2;
    const column = Array.from(
      { length: Math.floor(box.height) - 2 },
      (_, index) => [x, box.top + 1 + index] as const
    );
    expect(await paintedRuns(column)).toBeGreaterThanOrEqual(Math.floor((box.height - 2) / 12) - 1);
  });
});

describe("mark contrast", () => {
  // jp6, js10 and js11: tinted variants and the emphasis dim fell below 1.4.11's 3:1 for marks.
  // The oracle is WCAG's contrast ratio through @elmeragroup/color, read from the page's pixels.
  async function sampler() {
    const pixels = await pagePixels();
    return (x: number, y: number): Srgb.Srgb => {
      const index = (Math.round(y * pixels.scale) * pixels.width + Math.round(x * pixels.scale)) * 4;
      const [r = 0, g = 0, b = 0] = pixels.data.subarray(index, index + 3);
      return getOrThrow(Srgb.make({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 }));
    };
  }

  function plotWith(bar: ReactNode, legend = false, variant: ChartBarVariant = "default") {
    return renderThemed(
      <div style={{ width: 360, padding: 16, background: "var(--background)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[3, 5, 8, 4].map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1", variant } }}
            xKey="name"
            aria-label="Kontrast">
            {bar}
            {legend ? <Chart.Legend /> : null}
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  it("keeps the bars that emphasis greys at 3:1 or more", async () => {
    const { host } = plotWith(<Chart.Bar dataKey="v" emphasis="max" />);
    await frame();
    // DOM audit: bars are aria-hidden plot output.
    const rest = host.querySelector('[data-slot="chart-bar"]:not([data-emphasis])')?.getBoundingClientRect();
    const plot = plotRect(host);
    if (rest === undefined) throw new Error("no bar");
    const at = await sampler();
    const surface = at(plot.left + 2, plot.top + 2);
    expect(
      getOrThrow(contrastRatio(at(rest.left + rest.width / 2, rest.bottom - 4), surface))
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(["hatched", "striped", "gradient", "duotone", "duotone-reverse"] as const)(
    "edges each %s bar in the full paint at 3:1 or more",
    async (variant) => {
      const { host } = plotWith(<Chart.Bar dataKey="v" />, false, variant);
      await frame();
      // DOM audit: bars are aria-hidden plot output.
      const bar = host.querySelectorAll('[data-slot="chart-bar"]')[2]?.getBoundingClientRect();
      const plot = plotRect(host);
      if (bar === undefined) throw new Error("no bar");
      const at = await sampler();
      const surface = at(plot.left + 2, plot.top + 2);
      // The edge is the bar's outermost pixel column, sampled near the base, where the gradient
      // fades. A 1 px edge can straddle two device pixels, so the stronger of the two counts.
      const y = bar.bottom - 6;
      const edge = Math.max(
        ...[Math.floor(bar.left), Math.floor(bar.left) + 1].map((x) =>
          getOrThrow(contrastRatio(at(x + 0.25, y), surface))
        )
      );
      expect(edge).toBeGreaterThanOrEqual(3);
    }
  );

  it("edges a projected bar in the full paint at 3:1 or more", async () => {
    // The recheck's buffer finding: the projection hatch had no edge, at 1.32:1.
    const { host } = renderThemed(
      <div style={{ width: 360, padding: 16, background: "var(--background)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[3, 5, 8, 4].map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1", projectedFrom: "k2" } }}
            xKey="name"
            aria-label="Prognose">
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await frame();
    // DOM audit: bars are aria-hidden plot output.
    const bar = host.querySelector('[data-slot="chart-bar"][data-projected]')?.getBoundingClientRect();
    const plot = plotRect(host);
    if (bar === undefined) throw new Error("no projected bar");
    const at = await sampler();
    const surface = at(plot.left + 2, plot.top + 2);
    const y = bar.bottom - 6;
    const edge = Math.max(
      ...[Math.floor(bar.left), Math.floor(bar.left) + 1].map((x) =>
        getOrThrow(contrastRatio(at(x + 0.25, y), surface))
      )
    );
    expect(edge).toBeGreaterThanOrEqual(3);
  });

  it("keeps two dimmed stacked series 15 or more apart in ΔE", async () => {
    // The recheck's highest-total finding: the grey pulled chart-1 and chart-2 to ΔE 12.29.
    const { host } = renderThemed(
      <div style={{ width: 360, padding: 16, background: "var(--background)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[3, 5, 8, 4].map((v, index) => ({ name: `k${String(index)}`, p: v, q: v }))}
            config={{
              p: { label: "P", color: "chart-1", stack: "s" },
              q: { label: "Q", color: "chart-2", stack: "s" },
            }}
            xKey="name"
            aria-label="Utheving">
            <Chart.Bar dataKey="p" emphasis="max" />
            <Chart.Bar dataKey="q" emphasis="max" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await frame();
    // DOM audit: bars are aria-hidden plot output, and slot 0 is no maximum.
    const lower = host.querySelector('[data-series="0"] [data-slot="chart-bar"]')?.getBoundingClientRect();
    const upper = host.querySelector('[data-series="1"] [data-slot="chart-bar"]')?.getBoundingClientRect();
    if (lower === undefined || upper === undefined) throw new Error("no stack");
    const at = await sampler();
    const x = lower.left + lower.width / 2;
    expect(
      Oklab.deltaE(at(x, lower.top + lower.height / 2), at(x, upper.top + upper.height / 2))
    ).toBeGreaterThanOrEqual(15);
  });

  it.each(["light", "dark"] as const)(
    "marks the emphasised now bar 15 or more apart in ΔE from both neighbours in %s",
    async (scheme) => {
      // The final recheck's row 6: on a diverging role's grey middle, the now bar painted #868686
      // against neighbours of #808080, ΔE 2. The oracle is the dataviz floor of ΔE 15 between
      // two marks, through @elmeragroup/color, read from the page's pixels.
      const restore = snapshotDocumentTheme();
      stampDocumentTheme(fkasPrivate, scheme);
      try {
        const { host } = renderThemed(
          <div style={{ width: 360, padding: 16, background: "var(--background)" }}>
            <LocaleProvider locale="nb-NO">
              <Chart.Root
                data-intro="none"
                data={[0, 1, 2, 3, 4].map((index) => ({
                  start: new Date(Date.UTC(2026, 4, 24, 11, index * 15)),
                  price: 0.5,
                }))}
                config={{ price: { label: "Pris", color: "chart-diverging" } }}
                xKey="start"
                interval="quarter-hour"
                timeZone="UTC"
                now={new Date(Date.UTC(2026, 4, 24, 11, 37))}
                aria-label="Nå">
                <Chart.Bar dataKey="price" emphasis="now" />
              </Chart.Root>
            </LocaleProvider>
          </div>
        );
        await frame();
        // DOM audit: bars are aria-hidden plot output, and 11:37 falls in the third quarter.
        const bars = [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) =>
          bar.getBoundingClientRect()
        );
        const [, before, now, after] = bars;
        if (before === undefined || now === undefined || after === undefined) throw new Error("no bars");
        const at = await sampler();
        const y = now.top + now.height / 2;
        // The mark's own pixel, 1 px inside the bar's edge, against each neighbour's middle.
        const mark = at(now.left + 1, y);
        expect(Oklab.deltaE(mark, at(before.left + before.width / 2, y))).toBeGreaterThanOrEqual(15);
        expect(Oklab.deltaE(mark, at(after.left + after.width / 2, y))).toBeGreaterThanOrEqual(15);
      } finally {
        restore();
      }
    }
  );

  it("draws S03's zero line solid and at 3:1 or more across the plot, under the negative bars too", async () => {
    // The old js3: the zero line under S03's negative quarters read as a gap. The oracle is WCAG's
    // 3:1 for marks against the plot's surface, read from every pixel column along the line.
    const { host } = renderThemed(
      <div style={{ width: 360, padding: 16, background: "var(--background)" }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[0.36, 0.05, -0.08, -0.15, -0.12, 0.09, 0.38, 0.84].map((v, index) => ({
              name: `k${String(index)}`,
              v,
            }))}
            config={{ v: { label: "Pris", color: "chart-1" } }}
            xKey="name"
            aria-label="Null">
            <Chart.Grid />
            <Chart.Bar dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await frame();
    // DOM audit: grid lines are aria-hidden plot output, and the zero line carries data-zero.
    const zero = host.querySelector('[data-slot="chart-grid-line"][data-zero]');
    if (zero === null) throw new Error("no zero line");
    expect(getComputedStyle(zero).strokeDasharray).toBe("none");
    // A line's box holds no stroke, so its top is the 1 px stroke's centre line.
    const line = zero.getBoundingClientRect();
    const plot = plotRect(host);
    const at = await sampler();
    const surface = at(plot.left + 2, plot.top + 2);
    const unmarked: number[] = [];
    for (let x = Math.ceil(plot.left) + 1; x < plot.right - 1; x += 1) {
      const strongest = Math.max(
        ...[line.top - 0.25, line.top + 0.25].map((y) => getOrThrow(contrastRatio(at(x, y), surface)))
      );
      if (strongest < 3) unmarked.push(x);
    }
    expect(unmarked).toEqual([]);
  });

  it("hatches a hatched series' legend swatch", () => {
    const { host } = plotWith(<Chart.Bar dataKey="v" />, true, "hatched");
    // DOM audit: the swatch is aria-hidden presentation inside the legend item.
    const swatch = host.querySelector('[data-slot="chart-legend-item"] [data-slot="chart-swatch"]');
    expect(getComputedStyle(swatch ?? document.body).backgroundImage).toMatch(/repeating-linear-gradient/);
  });
});
