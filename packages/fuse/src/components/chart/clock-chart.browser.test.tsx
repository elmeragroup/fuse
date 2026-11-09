import interUrl from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
// ClockChart's dial, marks and readouts in Chromium. Units under test: ClockChart.Root with its
// Grid, AngleAxis, Line, Area, Column, Dots, Now, Center and the shared readouts. Oracles, written
// by hand: D11's equal slots, slot i of 24 centred at 15i + 7.5°; D13's radii on a [0, 4] domain
// with a 0.3 hole, √(0.09 + 0.91 · v/4) under "radial" and 0.3 + 0.7 · v/4 under "linear"; the pick
// by the pointer's angle alone, found by brute force; D23's threshold, whose wedges above it paint
// the theme's `above` role and the rest `below`, both resolved through a probe and compared through
// `@elmeragroup/color`, and whose line gradient turns hard at the threshold's own radius; D24's
// pixel floor, one device pixel along the radius, and the stack's floor on its outer segment alone;
// the 25-hour 26 October 2025, where "06" sits at 100.8°; D16's seam; Now at 11:30, 172.5°; and the
// clock key map, where PageDown moves six hours.
import { beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Oklab from "@elmeragroup/color/oklab";
import { getOrThrow } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { recordFrames } from "../../../test/animation-frames";
import { computedColor } from "../../../test/assert-invalid-ring";
import { angleOf, clockLayer, clockPath, dotPoints, labelInk, wedgeRadii } from "../../../test/chart/clock";
import { clientPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { emulatePixelRatio } from "../../../test/page-metrics";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import slots from "./format/fixtures/slots.json" with { type: "json" };

const HOUR = 3_600_000;

/** Midnight in Oslo on 25 October 2025, a 24-hour day. */
const DAY = Date.parse("2025-10-24T22:00:00Z");

/** A day of hourly rows from a list of values, `null` leaving a slot without a row. */
function hours(values: readonly (number | null)[], start = DAY, key = "kwh") {
  return values.flatMap((value, hour) =>
    value === null ? [] : [{ start: start + hour * HOUR, [key]: value }]
  );
}

/** 24 values: 4, 0, 2, 1 and then 1s. */
const VALUES = [4, 0, 2, 1, ...Array.from({ length: 20 }, () => 1)];

function Dial({
  data = hours(VALUES),
  config = { kwh: { label: "kWh", color: "chart-1" } },
  scale,
  inner,
  now,
  size,
  children,
}: {
  readonly data?: readonly Record<string, number | string>[];
  readonly config?: ChartConfig;
  readonly scale?: "radial" | "linear";
  /** The hole's radius as a share of the outer radius, 0.3 by default. */
  readonly inner?: number;
  readonly now?: number;
  /** The dial's `--chart-polar-size`, as a consumer sets it. */
  readonly size?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={data}
          config={config}
          xKey="start"
          cycle="day"
          interval="hour"
          radiusScale={scale}
          innerRadius={inner}
          now={now}
          data-intro="none"
          style={size === undefined ? undefined : { "--chart-polar-size": size }}
          aria-label="Døgn">
          {children}
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** How far a label's centre lies off its ray, across it and along it, in steps of 0.75 px. */
type RayOffsets = { readonly across: number; readonly along: number };

/**
 * How far a label lies off its ray, across it and along it from where the ray rule puts it: its
 * middle at R + 6 px plus its half-extent along the ray, |sin θ| · w/2 + |cos θ| · h/2. A bare label
 * reads its ink, from the font's metrics (`labelInk`), and Now's chip reads its box. Each is rounded
 * down to whole steps of 0.75 px, half a device pixel at 2× and the review's tolerance, so a centred
 * label reads 0 and 0.
 */
function rayOffsets(
  host: HTMLElement,
  label: HTMLElement | undefined,
  angle: number,
  side: "outside" | "inside" = "outside"
): RayOffsets {
  if (label === undefined) throw new Error("no label");
  // DOM audit: every SVG on the dial maps its units to the screen by its viewBox; the first serves.
  const layer = host.querySelector<SVGSVGElement>("svg[viewBox]");
  if (layer === null) throw new Error("no layer");
  const [cx, cy] = clientPoint(layer, 0, 0);
  const [rx] = clientPoint(layer, 1, 0);
  const radius = rx - cx;
  const box = side === "outside" ? labelInk(label) : label.getBoundingClientRect();
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const radians = (angle * Math.PI) / 180;
  const ux = Math.sin(radians);
  const uy = -Math.cos(radians);
  const dx = (box.left + box.right) / 2 - cx;
  const dy = (box.top + box.bottom) / 2 - cy;
  const support = (Math.abs(ux) * width) / 2 + (Math.abs(uy) * height) / 2;
  const expected = side === "outside" ? radius + 6 + support : radius - 6 - support;
  const step = (value: number): number => Math.trunc(value / 0.75) + 0;
  return { across: step(Math.abs(dx * uy - dy * ux)), along: step(Math.abs(dx * ux + dy * uy - expected)) };
}

async function painted(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("the dial's geometry (D11, D13)", () => {
  it.each([
    ["radial", [1, 0.3, Math.sqrt(0.09 + 0.455), Math.sqrt(0.09 + 0.2275)]],
    ["linear", [1, 0.3, 0.65, 0.475]],
  ] as const)("places each reading at its slot's middle and its radius under %s", async (scale, expected) => {
    const { host } = renderThemed(
      <Dial scale={scale}>
        <ClockChart.Dots dataKey="kwh" />
      </Dial>
    );
    await painted();
    const points = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"));
    expect(points).toHaveLength(24);
    points.slice(0, 4).forEach(({ x, y }, slot) => {
      expect(angleOf(x, y)).toBeCloseTo(15 * slot + 7.5, 1);
      expect(Math.hypot(x, y)).toBeCloseTo(expected[slot] ?? 0, 2);
    });
  });

  it("picks the slot under the pointer's angle, whatever its distance from the centre", async () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.Column dataKey="kwh" />
      </Dial>
    );
    await painted();
    const column = clockLayer(host, "clock-chart-column");
    const figure = polarFigure(host);
    let checked = 0;
    // Each probe sits at a slot's middle, past the 2 px dead band a held slot keeps.
    for (let ring = 0; ring < 3; ring += 1) {
      for (let step = 0; step < 36; step += 1) {
        const angle = ((step * 7) % 24) * 15 + 7.5;
        const radius = 0.35 + ring * 0.25;
        const radians = (angle * Math.PI) / 180;
        await hoverAt(...clientPoint(column, radius * Math.sin(radians), -radius * Math.cos(radians)));
        expect(figure.style.getPropertyValue("--chart-active")).toBe(String(Math.floor(angle / 15)));
        checked += 1;
      }
    }
    expect(checked).toBe(108);
  });
});

/** A colour as sRGB through `@elmeragroup/color`. */
const srgb = (value: string): Srgb => CssColor.toSrgb(getOrThrow(CssColor.parse(value)));

describe("a threshold ring (D23)", () => {
  const split = {
    kwh: {
      label: "Forbruk",
      color: {
        threshold: 1.5,
        below: { color: "chart-sentiment-positive", label: "Under snittet" },
        above: { color: "chart-sentiment-negative", label: "Over snittet" },
      },
    },
  } as const satisfies ChartConfig;

  it("paints each wedge in its own value's side and lists both sides in the legend", async () => {
    const { host } = renderThemed(
      <Dial config={split}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Legend />
      </Dial>
    );
    await painted();
    const column = clockLayer(host, "clock-chart-column");
    // Readings 4 and 2 lie above 1.5, and 0 and the 1s at or below it.
    expect(wedgeRadii(clockPath(column, "step-1"))).toHaveLength(2);
    expect(wedgeRadii(clockPath(column, "step-0"))).toHaveLength(21);
    // DOM audit: each wedge group is aria-hidden plot output, read by its group.
    const fill = (group: string) =>
      srgb(getComputedStyle(column.querySelector(`[data-group="${group}"]`) ?? column).fill);
    const role = (name: string) => srgb(computedColor(host, `var(--${name})`));
    expect(Oklab.deltaE(fill("step-1"), role("chart-sentiment-negative"))).toBeLessThanOrEqual(3);
    expect(Oklab.deltaE(fill("step-0"), role("chart-sentiment-positive"))).toBeLessThanOrEqual(3);
    expect(page.getByText("Over snittet").elements()).toHaveLength(1);
    expect(page.getByText("Under snittet").elements()).toHaveLength(1);
  });

  it("keeps an estimated wedge in its own side's paint, hatched, and in the past where it lies (Q4)", async () => {
    // The 4 at 00:00 is estimated, above 1.5, and before Now at 11:30, so it lies in the past.
    const rows = hours(VALUES).map((row, hour) => (hour === 0 ? { ...row, q: "estimated" } : row));
    const { host } = renderThemed(
      <Dial data={rows} config={{ kwh: { ...split.kwh, qualityKey: "q" } }} now={DAY + 11.5 * HOUR}>
        <ClockChart.Column dataKey="kwh" />
      </Dial>
    );
    await painted();
    const column = clockLayer(host, "clock-chart-column");
    // DOM audit: each wedge group is aria-hidden plot output, read by its group.
    const marked = column.querySelector('[data-group="step-1-past-marked"]');
    expect(wedgeRadii(marked?.getAttribute("d") ?? "")).toHaveLength(1);
    expect(marked?.getAttribute("data-time")).toBe("past");
    expect(marked?.getAttribute("data-part")).toBe("marked");
    // Its hatch is drawn in the above side's colour, the negative sentiment role.
    const [, id = ""] = /url\("?#([^")]+)"?\)/u.exec(getComputedStyle(marked ?? column).fill) ?? [];
    const hatch = column.querySelector(`[id="${id}"] stop`);
    const role = srgb(computedColor(host, "var(--chart-sentiment-negative)"));
    expect(Oklab.deltaE(srgb(getComputedStyle(hatch ?? column).stopColor), role)).toBeLessThanOrEqual(3);
  });

  it("hatches an estimated stretch of an Area over the area's own value paint", async () => {
    // The 4 at 06:00 is estimated and above 1.5. Its hatched stretch must paint through the same
    // threshold gradient as the solid area, so it reads red above the threshold, with the hatch as a
    // texture over that paint.
    const rows = hours(VALUES.map((value, hour) => (hour === 6 ? 4 : value))).map((row, hour) =>
      hour === 6 ? { ...row, q: "estimated" } : row
    );
    const { host } = renderThemed(
      <Dial data={rows} config={{ kwh: { ...split.kwh, qualityKey: "q" } }}>
        <ClockChart.Area dataKey="kwh" variant="solid" />
      </Dial>
    );
    await painted();
    const area = clockLayer(host, "clock-chart-area");
    // DOM audit: the area's paths are aria-hidden plot output, read by their part.
    const solid = area.querySelector('[data-part="solid"]');
    const marked = area.querySelector('[data-part="marked"]');
    expect(marked?.getAttribute("d")).not.toBe("");
    expect(getComputedStyle(marked ?? area).fill).toBe(getComputedStyle(solid ?? area).fill);
    expect(getComputedStyle(solid ?? area).fill).toMatch(/steps/u);
    expect(getComputedStyle(marked ?? area).mask).toMatch(/^url\(/u);
  });

  /** A series of its own, its hour 6 estimated. */
  const ALONE: ChartConfig = { kwh: { label: "kWh", color: "chart-1", qualityKey: "q" } };
  /** The same series stacked on a base load. */
  const STACKED: ChartConfig = {
    base: { label: "Grunnlast", color: "chart-2", stack: "a" },
    kwh: { label: "kWh", color: "chart-1", qualityKey: "q", stack: "a" },
  };

  it.each(
    (["step-after", "step-before", "step"] as const).flatMap((curve) => [
      // Hour 5 reads 100 kWh beside 10 everywhere else, on a [0, 100] domain: under "linear" with
      // no hole a reading's radius is v / 100, so hour 6's band runs from 0 to 0.1.
      [curve, "100 kWh, then 10 kWh", { kwh: 10 }, { kwh: 100 }, ALONE, 0, 0.1] as const,
      // A stack of 35 kWh, 60 at hour 5, under 10 kWh, on a [0, 70] domain: hour 6's band runs
      // from 35 / 70 = 0.5 to 45 / 70.
      [
        curve,
        "a stack's stepping base",
        { base: 35, kwh: 10 },
        { base: 60, kwh: 10 },
        STACKED,
        0.5,
        45 / 70,
      ] as const,
    ])
  )(
    "keeps a %s Area's hatch over %s inside hour 6 and inside the fill",
    async (curve, _, usual, hour5, config, low, high) => {
      const rows = Array.from({ length: 24 }, (_, hour) => ({
        start: DAY + hour * HOUR,
        ...(hour === 5 ? hour5 : usual),
        q: hour === 6 ? "estimated" : "measured",
      }));
      const { host } = renderThemed(
        <Dial data={rows} config={config} scale="linear" inner={0}>
          <ClockChart.Area dataKey="kwh" curve={curve} variant="solid" />
        </Dial>
      );
      await painted();
      const area = clockLayer(host, "clock-chart-area");
      // DOM audit: the area's paths are aria-hidden plot output, read by their part.
      const solid = area.querySelector<SVGPathElement>('[data-part="solid"]');
      const marked = area.querySelector<SVGPathElement>('[data-part="marked"]');
      if (solid === null || marked === null) throw new Error("no area paths");
      const at = (angle: number, radius: number): DOMPoint =>
        new DOMPoint(radius * Math.sin((angle * Math.PI) / 180), -radius * Math.cos((angle * Math.PI) / 180));
      const middle = (low + high) / 2;
      // Just inside each edge of hour 6, from 90° to 105°, its band is hatched, and nothing above
      // its top or below its base is; just outside, nothing is.
      for (const angle of [90.5, 104.5]) {
        expect(
          [middle, high + 0.05, low - 0.03]
            .filter((radius) => radius > 0)
            .map((radius) => marked.isPointInFill(at(angle, radius))),
          `${String(angle)}°`
        ).toEqual(low > 0 ? [true, false, false] : [true, false]);
      }
      for (const angle of [89.5, 105.5]) {
        expect(
          [middle, 0.9].map((radius) => marked.isPointInFill(at(angle, radius))),
          `${String(angle)}°`
        ).toEqual([false, false]);
      }
      // Every point the hatch covers lies inside the fill.
      const strays: string[] = [];
      for (let angle = 85; angle <= 110; angle += 0.5) {
        for (let radius = 0.02; radius <= 1; radius += 0.02) {
          if (marked.isPointInFill(at(angle, radius)) && !solid.isPointInFill(at(angle, radius))) {
            strays.push(`${String(angle)}° at ${radius.toFixed(2)}`);
          }
        }
      }
      expect(strays).toEqual([]);
    }
  );

  it("glows a value-painted line through a filter that blurs its own pixels at the drawn radius", async () => {
    const { host } = renderThemed(
      <Dial config={split} size="15rem">
        <ClockChart.Glow>
          <ClockChart.Line dataKey="kwh" />
        </ClockChart.Glow>
      </Dial>
    );
    await painted();
    const line = clockLayer(host, "clock-chart-line");
    expect(line.getAttribute("data-paint")).toBe("value");
    // A line's halo is 9.5 px. The dial draws 240 px across, a 120 px radius, so 9.5 / 120 of its units.
    expect(line.getBoundingClientRect().width).toBe(240);
    expect(Number(line.querySelector("feGaussianBlur")?.getAttribute("stdDeviation"))).toBeCloseTo(
      9.5 / 120,
      9
    );
    expect(getComputedStyle(line.querySelector("g") ?? line).filter).toMatch(/^url\("?#/u);
  });

  it("strokes the line through a radial gradient that turns hard at the threshold's radius", async () => {
    const { host } = renderThemed(
      <Dial config={split}>
        <ClockChart.Line dataKey="kwh" />
      </Dial>
    );
    await painted();
    const line = clockLayer(host, "clock-chart-line");
    // DOM audit: the steps gradient is the line's paint server, read by its marker attribute.
    const stops = [...line.querySelectorAll("[data-steps] stop")].map((stop) =>
      Number(stop.getAttribute("offset"))
    );
    // 1.5 of [0, 4] under "radial": √(0.09 + 0.91 · 0.375) = √0.43125.
    const radius = Math.sqrt(0.09 + 0.91 * 0.375);
    expect(stops).toHaveLength(4);
    expect(stops[0]).toBe(0);
    expect(stops[1]).toBeCloseTo(radius, 9);
    expect(stops[2]).toBeCloseTo(radius, 9);
    expect(stops[3]).toBe(1);
  });
});

describe("the pixel floor (D24)", () => {
  it.each([1, 2])("keeps a column a thousandth of the domain one device pixel deep at %ix", async (dpr) => {
    await emulatePixelRatio(dpr);
    const { host } = renderThemed(
      <Dial data={hours([4, 0.004, ...Array.from({ length: 22 }, () => 1)])}>
        <ClockChart.Column dataKey="kwh" />
      </Dial>
    );
    await painted();
    const column = clockLayer(host, "clock-chart-column");
    const scale = column.getBoundingClientRect().width / 2;
    const tiny = wedgeRadii(clockPath(column, "step-0"))[1] ?? [0, 0];
    expect((tiny[1] - tiny[0]) * scale).toBeGreaterThanOrEqual(1 / dpr - 0.01);
  });

  it("floors a stack of two slivers on its outer segment alone", async () => {
    const rows = hours([4, ...Array.from({ length: 23 }, () => 0.002)]).map((row) => ({
      ...row,
      top: (row.kwh ?? 0) === 4 ? 0 : 0.002,
    }));
    const { host } = renderThemed(
      <Dial
        data={rows}
        config={{
          kwh: { label: "Inner", color: "chart-1", stack: "s" },
          top: { label: "Outer", color: "chart-2", stack: "s" },
        }}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Column dataKey="top" />
      </Dial>
    );
    await painted();
    await painted();
    const inner = wedgeRadii(clockPath(clockLayer(host, "clock-chart-column", 0), "step-0"));
    const outer = wedgeRadii(clockPath(clockLayer(host, "clock-chart-column", 1), "step-0"));
    const scale = clockLayer(host, "clock-chart-column").getBoundingClientRect().width / 2;
    // The inner segments snap to nothing, and every outer one keeps a device pixel past them.
    expect(inner).toHaveLength(1);
    expect(outer).toHaveLength(23);
    for (const [from, to] of outer) expect((to - from) * scale).toBeGreaterThanOrEqual(0.99);
  });
});

describe("the 25-hour day", () => {
  it("draws an hourly series on a quarter-hour dial as one wedge per hour, each across its four slots", async () => {
    const quarters = slots["quarter-hour"]["Europe/Oslo"]["2025-10-25"].utc_start.map((start) =>
      Date.parse(start)
    );
    // The hourly series sits on the :00 rows alone, as a coarse series does.
    const rows = quarters.map((start, slot) =>
      slot % 4 === 0 ? { start, price: 1, kwh: 2 } : { start, price: 1 }
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={rows}
            config={{
              price: { label: "kr", color: "chart-2" },
              kwh: { label: "kWh", color: "chart-1", interval: "hour" },
            }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            yInclude={[0, 4]}
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Column dataKey="kwh" />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await painted();
    const layer = clockLayer(host, "clock-chart-column");
    // DOM audit: each wedge is a subpath of its group's path, read by their part or group.
    const wedges = [...layer.querySelectorAll("path")]
      .flatMap((path) => (path.getAttribute("d") ?? "").split("M").filter((part) => part !== ""))
      .map((wedge) => {
        // Its outer arc runs from its first point to the first arc's end, clockwise.
        const [x0 = 0, y0 = 0] = wedge.split(/[AL]/u)[0]?.split(",").map(Number) ?? [];
        const arc = /A[^A]*?(-?[\d.]+),(-?[\d.]+)(?=[LAZ]|$)/u.exec(wedge);
        const from = angleOf(x0, y0);
        const to = angleOf(Number(arc?.[1]), Number(arc?.[2]));
        // The last hour ends on 12 o'clock, a full turn past its start.
        return { from, to: to < from ? to + 360 : to };
      })
      .toSorted((a, b) => a.from - b.from);
    // 96 quarter-hours of 3.75°: hour h spans 15h° to 15(h + 1)°, less any pad, read back from a path
    // rounded to 3 decimals of the radius, a few hundredths of a degree.
    expect(wedges).toHaveLength(24);
    wedges.forEach(({ from, to }, hour) => {
      expect(from).toBeGreaterThan(15 * hour - 0.1);
      expect(from).toBeLessThan(15 * hour + 1);
      expect(to).toBeGreaterThan(15 * (hour + 1) - 1);
      expect(to).toBeLessThan(15 * (hour + 1) + 0.1);
    });
  });

  it("decimates an hourly year to four wedges per pixel column of the dial it draws", async () => {
    // 8,760 hours of 2025 in Oslo, each a scrambled 0 to 100, so each column's first, last, lowest
    // and highest hours differ.
    const year = Array.from({ length: 8760 }, (_, hour) => ({
      start: Date.parse("2024-12-31T23:00:00Z") + hour * HOUR,
      kwh: (hour * 7919) % 101,
    }));
    const wedgesAt = async (size: string): Promise<number> => {
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <div style={{ width: 320 }}>
            <ClockChart.Root
              data={year}
              config={{ kwh: { label: "kWh", color: "chart-1" } }}
              xKey="start"
              cycle="year"
              interval="hour"
              data-intro="none"
              style={{ "--chart-polar-size": size }}
              aria-label="År">
              <ClockChart.Column dataKey="kwh" />
            </ClockChart.Root>
          </div>
        </LocaleProvider>
      );
      await painted();
      const layer = clockLayer(host, "clock-chart-column");
      return [...layer.querySelectorAll("path")].reduce(
        (count, path) => count + ((path.getAttribute("d") ?? "").match(/M/gu) ?? []).length,
        0
      );
    };
    // A 200 px dial's rim runs round(2π · 100) = 628 columns, and a 240 px dial's 754: M4 keeps at
    // most four hours of each, so the small dial draws at most 2,512 and the large one more.
    const small = await wedgesAt("12.5rem");
    const large = await wedgesAt("15rem");
    expect(small).toBeLessThanOrEqual(4 * 628);
    expect(small).toBeGreaterThan(3 * 628);
    expect(large).toBeGreaterThan(4 * 628);
    expect(large).toBeLessThanOrEqual(4 * 754);
  });

  it("draws 25 equal slots and puts 06 at 100.8°, where its slot starts", async () => {
    const starts = slots.hour["Europe/Oslo"]["2025-10-26"].utc_start.map((start) => Date.parse(start));
    const { host } = renderThemed(
      <Dial data={starts.map((start) => ({ start, kwh: 1 }))}>
        <ClockChart.Dots dataKey="kwh" />
        <ClockChart.AngleAxis />
      </Dial>
    );
    await painted();
    const points = dotPoints(clockPath(clockLayer(host, "clock-chart-dots"), "step-0"));
    expect(points).toHaveLength(25);
    // Slot 7's middle is 7.5 · 14.4 = 108°.
    expect(angleOf(points[7]?.x ?? 0, points[7]?.y ?? 0)).toBeCloseTo(108, 1);
    // DOM audit: the cycle's labels are aria-hidden plot text, read by their slot.
    const six = [...host.querySelectorAll<HTMLElement>('[data-slot="clock-chart-angle-label"]')].find(
      (label) => label.textContent === "06"
    );
    // The label's ink sits with its middle on the ray at 100.8°, its nearest edge 6 px past the rim.
    expect(rayOffsets(host, six, 100.8)).toEqual({ across: 0, along: 0 });
  });
});

describe("the seam (D16), Now and the keys", () => {
  it("closes a full day's line and leaves a live day's open", async () => {
    const { host, rerender } = renderThemed(
      <Dial>
        <ClockChart.Line dataKey="kwh" />
      </Dial>
    );
    await painted();
    expect(clockPath(clockLayer(host, "clock-chart-line"), "solid").endsWith("Z")).toBe(true);
    // Readings until 11:00, and Now at 11:30, so the rest of the day is still to come.
    rerender(
      <Dial data={hours(VALUES.slice(0, 12))} now={DAY + 11.5 * HOUR}>
        <ClockChart.Line dataKey="kwh" />
        <ClockChart.Now label="Nå" />
      </Dial>
    );
    await painted();
    expect(clockPath(clockLayer(host, "clock-chart-line"), "solid").endsWith("Z")).toBe(false);
    // DOM audit: Now's hand is aria-hidden plot output, read by its part.
    const hand =
      host.querySelector('[data-slot="clock-chart-now"] [data-part="hand"]')?.getAttribute("d") ?? "";
    const [, x = "0", y = "0"] = /L(-?[\d.]+),(-?[\d.]+)$/u.exec(hand) ?? [];
    expect(angleOf(Number(x), Number(y))).toBeCloseTo(172.5, 1);
  });

  it("shows Now's label on its hand inside the rim only where it clears the hole", async () => {
    // DOM audit: Now's label is aria-hidden plot text, read by its part.
    const nowLabel = (host: HTMLElement) =>
      host.querySelector<HTMLElement>('[data-slot="clock-chart-now"] > [data-part="label"]');
    // At 11:30, 172.5°, the label sits on the hand by 6 o'clock, about R − 20 px from the centre at
    // its nearest edge. A hole of 0.9 R leaves it no room on this dial, so only the hand and its dot
    // show; the default 0.3 R hole leaves it room, and it sits inside the rim, clear of "12 PM".
    const tight = renderThemed(
      <Dial now={DAY + 11.5 * HOUR} inner={0.9}>
        <ClockChart.AngleAxis />
        <ClockChart.Now label="Nå" />
      </Dial>
    );
    await painted();
    expect(nowLabel(tight.host)?.checkVisibility()).toBe(false);
    expect(tight.host.querySelector('[data-slot="clock-chart-now"] [data-part="hand"]')).not.toBeNull();
    tight.unmount();
    const day = renderThemed(
      <Dial now={DAY + 11.5 * HOUR}>
        <ClockChart.AngleAxis />
        <ClockChart.Now label="Nå" />
      </Dial>
    );
    await painted();
    expect(nowLabel(day.host)?.checkVisibility()).toBe(true);
    const near = nowLabel(day.host)?.getBoundingClientRect() ?? new DOMRect();
    // DOM audit: the hour labels are aria-hidden plot text, read by their slot.
    for (const hour of day.host.querySelectorAll('[data-slot="clock-chart-angle-label"]')) {
      if (!hour.checkVisibility()) continue;
      const other = hour.getBoundingClientRect();
      expect(
        near.left < other.right &&
          near.right > other.left &&
          near.top < other.bottom &&
          near.bottom > other.top
      ).toBe(false);
    }
    day.unmount();
    // A week from Monday 20 October 2025. At Thursday 00:30, 154.4°, the label clears Thursday's
    // label and Wednesday's, so it shows.
    const monday = Date.parse("2025-10-19T22:00:00Z");
    const week = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={Array.from({ length: 168 }, (_, hour) => ({ start: monday + hour * HOUR, kwh: 1 }))}
            config={{ kwh: { label: "kWh", color: "chart-1" } }}
            xKey="start"
            cycle="week"
            interval="hour"
            now={monday + 72.5 * HOUR}
            data-intro="none"
            aria-label="Uke">
            <ClockChart.AngleAxis />
            <ClockChart.Now label="Nå" />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await painted();
    const label = nowLabel(week.host);
    expect(label?.checkVisibility()).toBe(true);
    const box = label?.getBoundingClientRect() ?? new DOMRect();
    // The week holds the 25-hour Sunday of 26 October, 169 equal hours, so Now's hand lies at
    // 72.5 / 169 of a turn. The label's centre sits on it, its nearest edge 6 px inside the rim
    // , and it meets no weekday label.
    expect(rayOffsets(week.host, label ?? undefined, (72.5 / 169) * 360, "inside")).toEqual({
      across: 0,
      along: 0,
    });
    // DOM audit: the weekday labels are aria-hidden plot text, read by their slot.
    for (const weekday of week.host.querySelectorAll('[data-slot="clock-chart-angle-label"]')) {
      const other = weekday.getBoundingClientRect();
      const meets =
        box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
      expect(meets).toBe(false);
    }
  });

  it("steps one slot with the arrows, wrapping, and six hours with PageDown and PageUp", async () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.Line dataKey="kwh" />
      </Dial>
    );
    const figure = polarFigure(host);
    const active = () => figure.style.getPropertyValue("--chart-active");
    await userEvent.tab();
    expect(active()).toBe("0");
    await userEvent.keyboard("{PageDown}");
    expect(active()).toBe("6");
    await userEvent.keyboard("{PageUp}{PageUp}");
    expect(active()).toBe("18");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(active()).toBe("0");
    expect(page.getByRole("listbox").element().getAttribute("aria-orientation")).toBe("horizontal");
  });
});

describe("an Area's gradients on every sign mix (B5)", () => {
  // Under "linear" the zero sits at its own radius: at the hole's 0.3 for readings 0 to 4, at the
  // rim for −2 to 0, and at 0.3 + 0.7 · 2/6 ≈ 0.533 for −2 to 4. "gradient" fades from the value
  // toward zero, so it is more solid at each reading's extreme than at zero; "gradient-reverse" is
  // the other way round. The opacity at a radius interpolates the ramp's stops, as SVG paints it.
  const mixes = [
    ["positive-only", Array.from({ length: 24 }, (_, hour) => 1 + (hour % 4)), [0.98], 0.32],
    ["negative-only", Array.from({ length: 24 }, (_, hour) => (hour % 2 === 0 ? -1 : -2)), [0.32], 0.98],
    ["mixed", Array.from({ length: 24 }, (_, hour) => (hour < 12 ? 4 : -2)), [0.32, 0.98], 0.533],
  ] as const;
  it.each(
    mixes.flatMap(([name, values, extremes, zero]) =>
      (["gradient", "gradient-reverse"] as const).map(
        (variant) => [variant, name, values, extremes, zero] as const
      )
    )
  )(
    "fades the %s look in its documented direction on %s readings",
    async (variant, _, values, extremes, zero) => {
      const { host } = renderThemed(
        <Dial data={hours(values)} scale="linear">
          <ClockChart.Area dataKey="kwh" variant={variant} />
        </Dial>
      );
      await painted();
      const area = clockLayer(host, "clock-chart-area");
      // DOM audit: the look's ramp is aria-hidden paint, read by its stops.
      const stops = [...area.querySelectorAll("mask radialGradient stop")].map((stop) => ({
        offset: Number(stop.getAttribute("offset")),
        opacity: Number(getComputedStyle(stop).stopOpacity),
      }));
      const opacityAt = (radius: number): number => {
        const after = stops.findIndex((stop) => stop.offset >= radius);
        if (after <= 0) return (after === -1 ? stops.at(-1) : stops[0])?.opacity ?? 0;
        const a = stops[after - 1] ?? { offset: 0, opacity: 0 };
        const b = stops[after] ?? a;
        return b.offset === a.offset
          ? b.opacity
          : a.opacity + ((b.opacity - a.opacity) * (radius - a.offset)) / (b.offset - a.offset);
      };
      for (const extreme of extremes) {
        if (variant === "gradient") expect(opacityAt(extreme)).toBeGreaterThan(opacityAt(zero) + 0.1);
        else expect(opacityAt(zero)).toBeGreaterThan(opacityAt(extreme) + 0.1);
      }
    }
  );
});

describe("a datum on a coarse reading", () => {
  it("marks and emphasises an hourly reading from any quarter of its hour", async () => {
    // A quarter-hour dial with an hourly reading of 3 on each :00 row and Now at 00:15, the second
    // quarter, which the 00:00 reading covers. The Marker's dot sits at that reading's vertex, its
    // ValueLabel prints 3, and the Column's emphasis on "now" outlines its one wedge.
    const quarters = slots["quarter-hour"]["Europe/Oslo"]["2025-10-25"].utc_start.map((start) =>
      Date.parse(start)
    );
    const rows = quarters.map((start, slot) =>
      slot % 4 === 0 ? { start, kwh: 3, price: 1 } : { start, price: 1 }
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={rows}
            config={{
              kwh: { label: "kWh", color: "chart-1", interval: "hour" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            yInclude={[0, 4]}
            now={quarters[1]}
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Column dataKey="kwh" emphasis="now" />
            <ClockChart.Marker dataKey="kwh" at="now">
              <ClockChart.ValueLabel />
            </ClockChart.Marker>
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await painted();
    // DOM audit: the marker's dots, its pill and the emphasis are aria-hidden plot output.
    const marker = clockLayer(host, "clock-chart-marker");
    expect(dotPoints(clockPath(marker, "dots"))).toHaveLength(1);
    expect(host.querySelector('[data-slot="clock-chart-value-label"]')?.textContent).toBe("3");
    const emphasis = clockLayer(host, "clock-chart-column").querySelector('[data-part="emphasis"]');
    expect(wedgeRadii(emphasis?.getAttribute("d") ?? "")).toHaveLength(1);
  });
});

describe("a ReferenceArea's label (B10)", () => {
  it("prints a time sector's range in Root's locale and zone through the label's {value}", async () => {
    // The sector holds the hours from 17:00 to 19:00 in Oslo, so it runs from 17:00 to 20:00, which
    // nb-NO writes 24-hour, its ends joined by an en dash as the value annulus joins its values.
    const { host } = renderThemed(
      <Dial>
        <ClockChart.ReferenceArea
          x1={DAY + 17 * HOUR}
          x2={DAY + 19 * HOUR}
          label="Topp {value}"
          format="time"
        />
      </Dial>
    );
    await painted();
    // DOM audit: the area's label is aria-hidden plot text, read by its part.
    const text = host.querySelector(
      '[data-slot="clock-chart-reference-area"] > [data-part="label"]'
    )?.textContent;
    expect(text).toBe("Topp 17:00\u201320:00");
  });
});

describe("a reference inside the dial's bounds (B5)", () => {
  // A linear dial of readings 100 and 200 with the zero baseline: the domain runs from 0 to 200, so
  // a value v sits at 0.3 + 0.7 · v / 200, from the 0.3 hole to the rim. A line outside that range
  // draws nothing and shows no label, a band clips to it or draws nothing, as the cartesian
  // references do in the plot, and an instant outside the cycle draws nothing either.
  const rows = hours(Array.from({ length: 24 }, (_, hour) => (hour % 2 === 0 ? 100 : 200)));

  /** The smallest and largest radius a reference path visits: its M and L points and its arcs' ends. */
  function radiusSpan(d: string): readonly [number, number] | null {
    const ends = [
      ...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)|A[\d.]+,[\d.]+,[\d.]+,[01],[01],(-?[\d.]+),(-?[\d.]+)/gu),
    ].map((match) => Math.hypot(Number(match[1] ?? match[3]), Number(match[2] ?? match[4])));
    return ends.length === 0 ? null : [Math.min(...ends), Math.max(...ends)];
  }

  it.each([
    [
      "a line inside the range, its ring at 0.65",
      <ClockChart.ReferenceLine key="r" y={100} label="Mål" />,
      [0.65, 0.65],
      "Mål",
    ],
    ["a line past the rim", <ClockChart.ReferenceLine key="r" y={300} label="Mål" />, null, null],
    ["a line inside the hole", <ClockChart.ReferenceLine key="r" y={-50} label="Mål" />, null, null],
    [
      "a band reaching into the hole, clipped to it",
      <ClockChart.ReferenceArea key="r" y1={-100} y2={100} label="Lav" />,
      [0.3, 0.65],
      "Lav",
    ],
    ["a band past the rim", <ClockChart.ReferenceArea key="r" y1={250} y2={300} label="Høy" />, null, null],
    [
      "a line at an instant outside the cycle",
      <ClockChart.ReferenceLine key="r" x={DAY + 30 * HOUR} label="Nå" />,
      null,
      null,
    ],
    [
      "a band between instants outside the cycle",
      <ClockChart.ReferenceArea key="r" x1={DAY + 30 * HOUR} x2={DAY + 32 * HOUR} label="Topp" />,
      null,
      null,
    ],
  ] as const)("draws %s", async (_, reference, span, label) => {
    const { host } = renderThemed(
      <Dial data={rows} scale="linear">
        {reference}
      </Dial>
    );
    await painted();
    // DOM audit: a reference's path and label are aria-hidden plot output, read by their slot and part.
    const d = host.querySelector('[data-slot="clock-chart-reference-path"]')?.getAttribute("d") ?? "";
    const drawn = radiusSpan(d);
    if (span === null) expect(drawn).toBeNull();
    else {
      expect(drawn?.[0]).toBeCloseTo(span[0], 3);
      expect(drawn?.[1]).toBeCloseTo(span[1], 3);
    }
    const text =
      host.querySelector('[data-slot^="clock-chart-reference"] > [data-part="label"]')?.textContent ?? null;
    expect(text).toBe(label);
  });

  // With no hole the area-true scale clamps a value below the domain to the centre, so the
  // bounds come from the value domain, 0 to 200, never from the radius. A value v sits at √(v / 200):
  // 50 at 0.5 and 100 at about 0.7071. A band clipped to the centre is a full disc, which d3 writes
  // as two half arcs with no centre point.
  it.each([
    [
      "a line inside the range, its ring at 0.5",
      <ClockChart.ReferenceLine key="r" y={50} label="Mål {value}" />,
      [0.5, 0.5],
      "Mål 50",
    ],
    [
      "a line below the domain",
      <ClockChart.ReferenceLine key="r" y={-100} label="Mål {value}" />,
      null,
      null,
    ],
    [
      "a band reaching below the domain, clipped to the centre",
      <ClockChart.ReferenceArea key="r" y1={-100} y2={50} label="Lav" />,
      [0.5, 0.5],
      "Lav",
    ],
    [
      "a band below the domain",
      <ClockChart.ReferenceArea key="r" y1={-200} y2={-100} label="Lav" />,
      null,
      null,
    ],
  ] as const)("draws %s on a dial with no hole", async (_, reference, span, label) => {
    const { host } = renderThemed(
      <Dial data={rows} inner={0}>
        {reference}
      </Dial>
    );
    await painted();
    // DOM audit: a reference's path and label are aria-hidden plot output, read by their slot and part.
    const d = host.querySelector('[data-slot="clock-chart-reference-path"]')?.getAttribute("d") ?? "";
    const drawn = radiusSpan(d);
    if (span === null) expect(drawn).toBeNull();
    else {
      expect(drawn?.[0]).toBeCloseTo(span[0], 3);
      expect(drawn?.[1]).toBeCloseTo(span[1], 3);
    }
    const text =
      host.querySelector('[data-slot^="clock-chart-reference"] > [data-part="label"]')?.textContent ?? null;
    expect(text).toBe(label);
  });
});

describe("the ActiveDot over a connected gap (A1-04)", () => {
  it("shows no dot at a missing slot that its Line bridges, and one at a slot with a reading", async () => {
    // Hour 2 has no reading, and missing: "connect" bridges it from 01:00 to 03:00. ActiveDot's JSDoc:
    // a missing reading at the active slot shows no dot, though the bridge draws a curve there.
    const { host } = renderThemed(
      <Dial
        data={hours([4, 2, null, 2, ...Array.from({ length: 20 }, () => 1)])}
        config={{ kwh: { label: "kWh", color: "chart-1", missing: "connect" } }}>
        <ClockChart.Line dataKey="kwh" />
        <ClockChart.ActiveDot dataKey="kwh" />
      </Dial>
    );
    await painted();
    const layer = clockLayer(host, "clock-chart-line");
    // DOM audit: the dot is aria-hidden plot output; its group states a drawn dot on data-value.
    const group = clockLayer(host, "clock-chart-active-dot").querySelector("[data-follow]");
    /** Hover the middle of an hour's slot, 15° wide, halfway out. */
    const hoverHour = (hour: number) => {
      const radians = ((hour + 0.5) * 15 * Math.PI) / 180;
      return hoverAt(...clientPoint(layer, 0.6 * Math.sin(radians), -0.6 * Math.cos(radians)));
    };
    await hoverHour(1);
    await expect.poll(() => group?.hasAttribute("data-value")).toBe(true);
    await hoverHour(2);
    // The hand glides from 01:00 to 02:00, so the dot has had every frame of it to leave.
    const start = performance.now();
    while (performance.now() - start < 600) await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(group?.hasAttribute("data-value")).toBe(false);
  });
});

describe("a reference's sentence (A1-02)", () => {
  // The cartesian references' contract: the drawing and the label are hidden from readers, and one
  // visually hidden sentence, outside any aria-hidden subtree, always carries the value or the range,
  // in the dictionary's pattern without a label and as "label: value" with one. nb-NO's patterns are
  // "Referanselinje: …", "Område: …" and "… til …", and it speaks a clock time as "kl. 06:00",
  // joined by a no-break space. A reference that draws nothing keeps its sentence.
  const rows = hours(Array.from({ length: 24 }, (_, hour) => (hour % 2 === 0 ? 100 : 200)));

  it.each([
    ["a value line with a label", <ClockChart.ReferenceLine key="r" y={150} label="Mål" />, "Mål: 150"],
    ["a value line past the rim", <ClockChart.ReferenceLine key="r" y={300} label="Mål" />, "Mål: 300"],
    ["a value line with no label", <ClockChart.ReferenceLine key="r" y={150} />, "Referanselinje: 150"],
    [
      "a spoke at 06:00",
      <ClockChart.ReferenceLine key="r" x={DAY + 6 * HOUR} label="Start" />,
      "Start: kl.\u00a006:00",
    ],
    [
      "a value band with no label",
      <ClockChart.ReferenceArea key="r" y1={200} y2={100} />,
      "Område: 100 til 200",
    ],
    [
      "a sector from 17:00 to 20:00",
      <ClockChart.ReferenceArea
        key="r"
        x1={DAY + 17 * HOUR}
        x2={DAY + 19 * HOUR}
        label="Topp"
        format="time"
      />,
      "Topp: kl.\u00a017:00 til kl.\u00a020:00",
    ],
  ] as const)("speaks %s", async (_, reference, spoken) => {
    const { host } = renderThemed(
      <Dial data={rows} scale="linear">
        {reference}
      </Dial>
    );
    await painted();
    // DOM audit: the sentence is visually hidden text on its slot, the cartesian references' own.
    const sentence = host.querySelector('[data-slot="chart-reference-text"]');
    expect(sentence?.textContent).toBe(spoken);
    expect(sentence?.closest('[aria-hidden="true"]')).toBeNull();
    // The visible drawing stays hidden from readers.
    const drawing = host.querySelector('[data-slot^="clock-chart-reference"]');
    expect(drawing?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("the default tooltip over a stack (B11)", () => {
  it("adds one total row for a stack of two series, as the table and the option do", async () => {
    // Household 2 and cabin 1 at 00:00 stack to 3, which the total row prints.
    const rows = hours(Array.from({ length: 24 }, () => 2)).map((row) => ({ ...row, cabin: 1 }));
    renderThemed(
      <Dial
        data={rows}
        config={{
          kwh: { label: "Husholdning", color: "chart-1", stack: "home" },
          cabin: { label: "Hytte", color: "chart-2", stack: "home" },
        }}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Column dataKey="cabin" />
        <ClockChart.Tooltip />
      </Dial>
    );
    await userEvent.tab();
    // DOM audit: the popup portals out of the host, and its total row carries its slot.
    await expect.poll(() => document.querySelectorAll('[data-slot="chart-tooltip-total"]').length).toBe(1);
    expect(document.querySelector('[data-slot="chart-tooltip-total"]')?.textContent).toContain("3");
  });
});

describe("a Column's gradient on every sign mix (B5's class)", () => {
  // The gradient look fades each wedge toward zero: more solid at the reading's extreme than at
  // the zero ring, on positive-only, negative-only and mixed readings alike.
  it.each([
    ["positive-only", Array.from({ length: 24 }, (_, hour) => 1 + (hour % 4)), [0.98], 0.32],
    ["negative-only", Array.from({ length: 24 }, (_, hour) => (hour % 2 === 0 ? -1 : -2)), [0.32], 0.98],
    ["mixed", Array.from({ length: 24 }, (_, hour) => (hour < 12 ? 4 : -2)), [0.32, 0.98], 0.533],
  ] as const)("fades toward zero on %s readings", async (_, values, extremes, zero) => {
    const { host } = renderThemed(
      <Dial
        data={hours(values)}
        config={{ kwh: { label: "kWh", color: "chart-1", barVariant: "gradient" } }}
        scale="linear">
        <ClockChart.Column dataKey="kwh" />
      </Dial>
    );
    await painted();
    const column = clockLayer(host, "clock-chart-column");
    // DOM audit: the fade's ramp is aria-hidden paint, read by its stops.
    const stops = [...column.querySelectorAll("mask radialGradient stop")].map((stop) => ({
      offset: Number(stop.getAttribute("offset")),
      opacity: Number(getComputedStyle(stop).stopOpacity),
    }));
    const opacityAt = (radius: number): number => {
      const after = stops.findIndex((stop) => stop.offset >= radius);
      if (after <= 0) return (after === -1 ? stops.at(-1) : stops[0])?.opacity ?? 0;
      const a = stops[after - 1] ?? { offset: 0, opacity: 0 };
      const b = stops[after] ?? a;
      return b.offset === a.offset
        ? b.opacity
        : a.opacity + ((b.opacity - a.opacity) * (radius - a.offset)) / (b.offset - a.offset);
    };
    for (const extreme of extremes) expect(opacityAt(extreme)).toBeGreaterThan(opacityAt(zero) + 0.1);
  });
});

describe("a coarse series under the pointer (Q3, B5)", () => {
  it("picks and selects the hourly series anywhere in its hour, not only at its first quarter", async () => {
    // A quarter-hour dial with prices at 1 every quarter and an hourly reading of 3 on each :00 row.
    // On [0, 4] under "radial" the hourly tip sits at √(0.09 + 0.91 · 3/4) ≈ 0.879 and the price's
    // at √(0.09 + 0.91 · 1/4) ≈ 0.563. The second quarter, slot 1 of 96, centres at 5.625°.
    const quarters = slots["quarter-hour"]["Europe/Oslo"]["2025-10-25"].utc_start.map((start) =>
      Date.parse(start)
    );
    const rows = quarters.map((start, slot) =>
      slot % 4 === 0 ? { start, kwh: 3, price: 1 } : { start, price: 1 }
    );
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <div style={{ width: 320 }}>
          <ClockChart.Root
            data={rows}
            config={{
              kwh: { label: "Forbruk", color: "chart-1", interval: "hour" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="start"
            cycle="day"
            interval="quarter-hour"
            yInclude={[0, 4]}
            data-intro="none"
            aria-label="Døgn">
            <ClockChart.Column dataKey="kwh" />
            <ClockChart.Line dataKey="price" />
            <ClockChart.LegendToggleGroup />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await painted();
    const layer = clockLayer(host, "clock-chart-column");
    const at = {
      x: 0.879 * Math.sin((5.625 * Math.PI) / 180),
      y: -0.879 * Math.cos((5.625 * Math.PI) / 180),
    };
    await hoverAt(...clientPoint(layer, at.x, at.y));
    // The hourly series, the first in config order, is the nearest.
    expect(polarFigure(host).getAttribute("data-near")).toBe("0");
    await userEvent.click(page.getByRole("listbox"), {
      position: {
        x:
          clientPoint(layer, at.x, at.y)[0] -
          page.getByRole("listbox").element().getBoundingClientRect().left,
        y:
          clientPoint(layer, at.x, at.y)[1] - page.getByRole("listbox").element().getBoundingClientRect().top,
      },
    });
    expect(page.getByRole("button", { name: "Forbruk" }).element().getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the readouts", () => {
  it("prints the value at Now in the centre with nothing active, and the active slot's on hover", async () => {
    const { host } = renderThemed(
      <Dial now={DAY + 2.5 * HOUR}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Center />
      </Dial>
    );
    await painted();
    // DOM audit: the centre is aria-hidden plot text, read by its slot.
    const value = () => host.querySelector('[data-slot="clock-chart-active-value"]')?.textContent;
    expect(value()).toBe("2");
    const column = clockLayer(host, "clock-chart-column");
    await hoverAt(
      ...clientPoint(column, 0.5 * Math.sin((7.5 * Math.PI) / 180), -0.5 * Math.cos((7.5 * Math.PI) / 180))
    );
    expect(value()).toBe("4");
  });

  it("opens its description with the family word and lists every hour in its table", () => {
    const { host } = renderThemed(
      <Dial>
        <ClockChart.Line dataKey="kwh" />
        <ClockChart.Table />
      </Dial>
    );
    // DOM audit: the generated description is the figure's visually hidden text, read by its slot.
    expect(host.querySelector('[data-slot="chart-description"]')?.textContent).toMatch(
      /^Klokkediagram med 1 serie\. /u
    );
    expect(host.querySelectorAll("tbody tr")).toHaveLength(24);
  });
});

describe("the centre's text floor and fit guard", () => {
  // A 200 px dial, R = 100 px, holds a hole square of side √2 · inner · 100: inner radii of 0.2121,
  // 0.3394 and 0.5657 give squares of 30, 48 and 80 px. The value, 18 370 kWh, needs about 38 px for
  // its number at the 12 px floor. The line "Totalt hittil i år" wraps onto two 16 px lines in a 48 px
  // hole, under the value's two 14.4 px lines, 60.8 px in all, and fits on one line in an 80 px hole.
  function Total({ inner }: { readonly inner: number }) {
    return (
      <Dial
        data={hours(Array.from({ length: 24 }, () => 18_370))}
        config={{ kwh: { label: "kWh", color: "chart-1", format: { preset: "energy", unit: "kWh" } } }}
        inner={inner}>
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Center>
          <ClockChart.ActiveValue dataKey="kwh" fallback="first" />
          <span data-slot="test-centre-line">Totalt hittil i år</span>
        </ClockChart.Center>
      </Dial>
    );
  }

  function parts(host: HTMLElement) {
    // DOM audit: the centre is aria-hidden plot text, read by its slot and part.
    const hole = host.querySelector<HTMLElement>('[data-slot="clock-chart-center"] > [data-part="hole"]');
    const value = host.querySelector<HTMLElement>('[data-slot="clock-chart-active-value"]');
    const line = host.querySelector<HTMLElement>('[data-slot="test-centre-line"]');
    if (hole === null || value === null || line === null) throw new Error("no centre");
    return { hole, value, line };
  }

  it("drops the whole centre in a 30 px hole, where the number alone overflows", async () => {
    const { host } = renderThemed(<Total inner={0.2121} />);
    await painted();
    const { hole, value } = parts(host);
    expect(hole.getBoundingClientRect().width).toBeCloseTo(30, 0);
    expect(hole.getAttribute("data-fit")).toBe("none");
    expect(getComputedStyle(value).display).toBe("none");
  });

  it("keeps the value alone in a 48 px hole, at the 12 px floor and on two lines", async () => {
    const { host } = renderThemed(<Total inner={0.3394} />);
    await painted();
    const { hole, value, line } = parts(host);
    expect(hole.getBoundingClientRect().width).toBeCloseTo(48, 0);
    expect(hole.getAttribute("data-fit")).toBe("value");
    expect(getComputedStyle(line).display).toBe("none");
    expect(getComputedStyle(value).fontSize).toBe("12px");
    expect(value.getBoundingClientRect().height).toBeGreaterThanOrEqual(2 * 12 * 1.2 - 0.5);
  });

  it("shows the value and the line in an 80 px hole", async () => {
    const { host } = renderThemed(<Total inner={0.5657} />);
    await painted();
    const { hole, value, line } = parts(host);
    expect(hole.getBoundingClientRect().width).toBeCloseTo(80, 0);
    expect(hole.hasAttribute("data-fit")).toBe(false);
    expect(getComputedStyle(value).display).not.toBe("none");
    expect(getComputedStyle(line).display).not.toBe("none");
  });
});

describe("the ring values beside the angle labels", () => {
  // Unit under test: ClockChart.RadiusAxis's fit of its ring values against the AngleAxis's month
  // labels, on dials of 160 to 400 px. Oracle: ring-labels.ts's rule that a value shows only where
  // its chip keeps 2 px from every angle label the dial shows, checked on the boxes the page draws.
  // The dial draws in Inter, the internal themes' face, whose tabular figures set "1,500 kWh" 13%
  // wider than Roboto's, so the fit holds only if its widths bound the font the page renders. NO1
  // household consumption per metering point and month in 2025, from Elhub's
  // CONSUMPTION_PER_GROUP_MBA_HOUR (CC BY 4.0), as the docs' heating-year demo draws it: its ring
  // values run 0 to 2,000 kWh, and "1,500 kWh" sits level with "May".
  const KWH = [
    1837.12, 1603.55, 1398.42, 1004.97, 863.99, 715.08, 592.65, 683.19, 781.47, 1125.71, 1413.92, 1582.73,
  ];
  const YEAR = KWH.map((kwh, month) => ({
    // Each month's first midnight in Oslo: CEST from April to October, CET otherwise.
    start: Date.parse(
      `2025-${String(month + 1).padStart(2, "0")}-01T00:00:00${month >= 3 && month <= 9 ? "+02:00" : "+01:00"}`
    ),
    kwh,
  }));

  beforeAll(async () => {
    const inter = new FontFace("Fuse Test Inter", `url(${interUrl})`);
    document.fonts.add(await inter.load());
  });

  /** A year dial of the given size in Inter, and the ring values and month labels it shows. */
  async function yearDial(size: string) {
    const { host } = renderThemed(
      <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
        <div style={{ width: 728, fontFamily: '"Fuse Test Inter"' }}>
          <ClockChart.Root
            data={YEAR}
            config={{
              kwh: {
                label: "Household",
                color: "chart-1",
                format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
              },
            }}
            xKey="start"
            cycle="year"
            interval="month"
            data-intro="none"
            style={{ "--chart-polar-size": size }}
            aria-label="Year">
            <ClockChart.Grid />
            <ClockChart.AngleAxis />
            <ClockChart.RadiusAxis />
            <ClockChart.Column dataKey="kwh" />
          </ClockChart.Root>
        </div>
      </LocaleProvider>
    );
    await document.fonts.ready;
    await painted();
    await painted();
    const shown = (slot: string) =>
      // DOM audit: the ring values and month labels are aria-hidden plot text, read by their slot.
      [...host.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)]
        .filter((label) => label.checkVisibility() && label.textContent.trim() !== "")
        .map((label) => ({ text: label.textContent.trim(), box: label.getBoundingClientRect() }));
    return { values: shown("clock-chart-radius-label"), months: shown("clock-chart-angle-label") };
  }

  it.each(["160px", "200px", "240px", "280px", "320px", "400px"])(
    "keeps every ring value it shows 2 px from every month label on a %s dial",
    async (size) => {
      const { values, months } = await yearDial(size);
      expect(months.length).toBeGreaterThan(0);
      const crowded = values.flatMap((value) =>
        months.flatMap((month) => {
          const across = Math.max(month.box.left - value.box.right, value.box.left - month.box.right);
          const along = Math.max(month.box.top - value.box.bottom, value.box.top - month.box.bottom);
          return across < 2 && along < 2
            ? [
                `"${value.text}" ${across.toFixed(2)} px across and ${along.toFixed(2)} px along from "${month.text}"`,
              ]
            : [];
        })
      );
      expect(crowded).toEqual([]);
    }
  );

  // A1-03. Unit under test: the AngleAxis's thinning under a format of its own. Oracle: the axis's
  // JSDoc, labels that thin as the dial narrows so they never collide, checked on the boxes the page
  // draws. "September 2025" is several times as wide as "Sep", so on a narrow dial the long labels
  // must thin further than the cycle's own would.
  it.each(["160px", "200px", "240px", "320px", "400px"])(
    "keeps every month label a custom format prints clear of the next on a %s dial",
    async (size) => {
      const { host } = renderThemed(
        <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
          <div style={{ width: 728, fontFamily: '"Fuse Test Inter"' }}>
            <ClockChart.Root
              data={YEAR}
              config={{ kwh: { label: "Household", color: "chart-1" } }}
              xKey="start"
              cycle="year"
              interval="month"
              data-intro="none"
              style={{ "--chart-polar-size": size }}
              aria-label="Year">
              <ClockChart.AngleAxis format={{ month: "long", year: "numeric" }} />
              <ClockChart.Column dataKey="kwh" />
            </ClockChart.Root>
          </div>
        </LocaleProvider>
      );
      await document.fonts.ready;
      await painted();
      // DOM audit: the month labels are aria-hidden plot text, read by their slot.
      const months = [...host.querySelectorAll<HTMLElement>('[data-slot="clock-chart-angle-label"]')]
        .filter((label) => label.checkVisibility() && label.textContent.trim() !== "")
        .map((label) => ({ text: label.textContent.trim(), box: label.getBoundingClientRect() }));
      expect(months.length).toBeGreaterThan(0);
      const collisions = months.flatMap((a, index) =>
        months.slice(index + 1).flatMap((b) => {
          const across = Math.max(a.box.left - b.box.right, b.box.left - a.box.right);
          const along = Math.max(a.box.top - b.box.bottom, b.box.top - a.box.bottom);
          return across < 0 && along < 0 ? [`"${a.text}" over "${b.text}"`] : [];
        })
      );
      expect(collisions).toEqual([]);
    }
  );

  it("shows both ring values beside the spoke on a 400 px dial, where they keep their room", async () => {
    // On a 400 px dial, R = 200 px, the area-true scale with its 0.3 hole puts "1,000 kWh" and
    // "1,500 kWh" at √(0.09 + 0.91 · v/2000) R, 148 and 176 px below the centre. Their chips end
    // about 71 px right of the spoke, and "May", the nearest month label, starts about 142 px right.
    const { values } = await yearDial("400px");
    expect(values.map(({ text }) => text)).toEqual(["1,000\u00a0kWh", "1,500\u00a0kWh"]);
  });
});

describe("two connected readings at the ends of the day (D16)", () => {
  it("draws the solid arc across midnight, and the ActiveDot rides it through 12 o'clock", async () => {
    // 6 kWh at 00:00 and at 23:00, nothing between, and missing: "connect". Both end slots hold
    // readings, so the seam closes (D16): the solid line runs from slot 23's vertex at 352.5° through
    // 12 o'clock to slot 0's at 7.5°, an arc, since both readings draw at one radius, and the dashed
    // bridge runs the other way over the missing hours. The ActiveDot lies on that curve, so as the
    // hand glides from 23:00 to 00:00 it shows at the arc's radius through 12 o'clock.
    const { host } = renderThemed(
      <Dial
        data={hours([6, ...Array.from({ length: 22 }, () => null), 6])}
        config={{ kwh: { label: "kWh", color: "chart-1", missing: "connect" } }}>
        <ClockChart.Line dataKey="kwh" curve="linear" />
        <ClockChart.ActiveDot dataKey="kwh" />
      </Dial>
    );
    await painted();
    const layer = clockLayer(host, "clock-chart-line");
    const pointsOf = (d: string) =>
      [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/gu)].map((match) => ({
        angle: angleOf(Number(match[1]), Number(match[2])),
        radius: Math.hypot(Number(match[1]), Number(match[2])),
      }));
    const solid = pointsOf(clockPath(layer, "solid"));
    const marked = pointsOf(clockPath(layer, "marked"));
    // Path coordinates round to 3 decimals, about 0.1° at the rim.
    const across = (angle: number) => angle >= 352.3 || angle <= 7.7;
    expect(solid.length).toBeGreaterThan(2);
    expect(solid.filter(({ angle }) => !across(angle))).toEqual([]);
    expect(solid.some(({ angle }) => angle < 1 || angle > 359)).toBe(true);
    expect(marked.filter(({ angle }) => angle < 7.3 || angle > 352.7)).toEqual([]);
    const rim = solid[0]?.radius ?? 0;
    for (const { radius } of solid) expect(radius).toBeCloseTo(rim, 2);
    // DOM audit: the dot is aria-hidden plot output; its group states a drawn dot on data-value.
    const group = clockLayer(host, "clock-chart-active-dot").querySelector("[data-follow]");
    const dot = () => {
      const d = group?.querySelector("path")?.getAttribute("d") ?? "";
      const [point] = pointsOf(d);
      return group?.hasAttribute("data-value") === true ? point : undefined;
    };
    /** Hover the middle of an hour's slot, 15° wide, halfway out. */
    const hoverHour = (hour: number) => {
      const radians = ((hour + 0.5) * 15 * Math.PI) / 180;
      return hoverAt(...clientPoint(layer, 0.6 * Math.sin(radians), -0.6 * Math.cos(radians)));
    };
    // The glide's frames are recorded in the page from before each hover, and a frame mid-glide,
    // strictly between the two rest angles, 352.5° and 7.5°, lies on the arc through 12 o'clock.
    // A starved runner paints few frames per glide, so the crossing repeats until one lands there.
    const crossing = (point: { readonly angle: number } | undefined) =>
      point !== undefined && (point.angle > 353 || point.angle < 7);
    const seen: { readonly angle: number; readonly radius: number }[] = [];
    for (let attempt = 0; attempt < 5 && seen.length === 0; attempt += 1) {
      await hoverHour(23);
      await expect.poll(() => dot()?.angle ?? 0).toBeCloseTo(352.5, 0);
      const start = performance.now();
      const recorded = recordFrames(dot, () => performance.now() - start > 600);
      await hoverHour(0);
      for (const point of await recorded) if (point !== undefined && crossing(point)) seen.push(point);
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const { radius } of seen) expect(radius).toBeCloseTo(rim, 2);
  });
});

describe("a closing tooltip's stack total", () => {
  // DECISIONS.md M, R2.1–R2.3: a closing tooltip keeps its place and content until the popup has
  // closed. Unit under test: ClockChart.TooltipTotal in the default Tooltip over a stack of
  // household 2 kWh and cabin 1 kWh. Oracle: the stack's total, 2 + 1 = 3, read on every frame the
  // popup is on screen from Escape until its exit ends.
  it("reads 3 on every frame of the exit after Escape", async () => {
    const { host } = renderThemed(
      <Dial
        data={Array.from({ length: 24 }, (_, hour) => ({ start: DAY + hour * HOUR, household: 2, cabin: 1 }))}
        config={{
          household: { label: "Hus", color: "chart-1", stack: "home" },
          cabin: { label: "Hytte", color: "chart-2", stack: "home" },
        }}>
        <ClockChart.Line dataKey="household" />
        <ClockChart.Line dataKey="cabin" />
        <ClockChart.Tooltip />
      </Dial>
    );
    await painted();
    const layer = clockLayer(host, "clock-chart-line");
    const radians = (3.5 * 15 * Math.PI) / 180;
    await hoverAt(...clientPoint(layer, 0.6 * Math.sin(radians), -0.6 * Math.cos(radians)));
    // DOM audit: the popup is aria-hidden and portalled, read by its slot.
    const popupNode = () => document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    const total = () =>
      popupNode()?.querySelector('[data-slot="chart-tooltip-total"] > span:last-child')?.textContent;
    await expect.poll(() => total()).toBe("3");
    await expect.poll(() => Number(getComputedStyle(popupNode() ?? document.body).opacity)).toBe(1);
    const open = popupNode();
    if (open === null) throw new Error("no popup");
    const shown = () =>
      open.isConnected && open.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    // The frames are recorded in the page from before the key, so a slow round trip for the key
    // command cannot let the exit pass unseen.
    const recorded = recordFrames(
      () => ({ total: total(), shown: shown(), closing: shown() && !open.hasAttribute("data-open") }),
      () => !shown()
    );
    await userEvent.keyboard("{Escape}");
    const frames = await recorded;
    expect(shown()).toBe(false);
    expect(frames.some(({ closing }) => closing)).toBe(true);
    expect(frames.filter((frame) => frame.shown && frame.total !== "3")).toEqual([]);
  });
});
