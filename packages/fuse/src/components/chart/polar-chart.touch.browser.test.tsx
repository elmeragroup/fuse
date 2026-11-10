// A finger on each polar family, in Chromium through CDP touch events. Units under test: PieChart,
// RadialChart, RadarChart and ClockChart Roots with a Tooltip. Oracle: CONTRACT section 9.5's Touch
// rule and SPEC's L8 touch check, as the cartesian touch judge reads it: a scrub moves the active
// option under the finger and its lift pins the option it ended on, a tap pins an option, and a
// second tap on it dismisses the pin and the popup. Each option's place is worked by hand: the
// pie's slices of 50, 30 and 20 centre at 90°, 234° and 324°; the rings' centre lines sit 0.7 / 6,
// 0.7 / 2 and 5 · 0.7 / 6 in from the rim; the radar's four spokes point at 0°, 90°, 180° and 270°;
// and the clock's hour h of 24 centres at 15h + 7.5°. The scrubs turn through vertical moves, which
// a dial keeps as its own: a pan never starts on it.
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { popupOpen } from "../../../test/chart/marks";
import { activeSlice, clientPoint, dialPoint, polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

type TouchPoint = { readonly x: number; readonly y: number };

type TouchCdp = {
  send: (
    method: "Input.dispatchTouchEvent",
    params: { type: "touchStart" | "touchMove" | "touchEnd"; touchPoints: readonly TouchPoint[] }
  ) => Promise<void>;
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): TouchCdp => cdp() as TouchCdp;

/** Whether a finger is down, which a failed test may leave. */
let down = false;

async function touch(type: "touchStart" | "touchMove" | "touchEnd", point?: TouchPoint): Promise<void> {
  down = type !== "touchEnd";
  await session().send("Input.dispatchTouchEvent", { type, touchPoints: point === undefined ? [] : [point] });
  await nextFrames(1);
}

const BILL = [
  { part: "energi", kr: 50 },
  { part: "nettleie", kr: 30 },
  { part: "avgift", kr: 20 },
];

const BILL_CONFIG = {
  energi: { label: "Energi", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgift: { label: "Avgift", color: "chart-3" },
} as const;

/** Midnight in Oslo on 25 October 2025, a 24-hour day. */
const DAY = Date.parse("2025-10-24T22:00:00Z");

/** Each family's chart and where its first three options sit, as an angle and a radius on the dial. */
/** A family's chart, where its first three options sit, as an angle and a radius, and their indexes. */
type Family = {
  readonly family: string;
  readonly chart: ReactNode;
  readonly options: readonly (readonly [number, number])[];
  readonly index: readonly number[];
};

const FAMILIES: readonly Family[] = [
  {
    family: "pie",
    chart: (
      <PieChart.Root
        data={BILL}
        config={BILL_CONFIG}
        nameKey="part"
        valueKey="kr"
        innerRadius={0.5}
        aria-label="Regning">
        <PieChart.Pie />
        <PieChart.Tooltip />
      </PieChart.Root>
    ),
    options: [
      [90, 0.75],
      [234, 0.75],
      [324, 0.75],
    ],
    index: [0, 1, 2],
  },
  {
    family: "radial",
    chart: (
      <RadialChart.Root
        data={BILL}
        config={BILL_CONFIG}
        nameKey="part"
        valueKey="kr"
        max={50}
        aria-label="Ringer">
        <RadialChart.Track />
        <RadialChart.Bar />
        <RadialChart.Tooltip />
      </RadialChart.Root>
    ),
    options: [
      [90, 1 - 0.7 / 6],
      [90, 1 - 0.7 / 2],
      [90, 1 - (5 * 0.7) / 6],
    ],
    index: [0, 1, 2],
  },
  {
    family: "radar",
    chart: (
      <RadarChart.Root
        data={["NO1", "NO2", "NO3", "NO4"].map((area, index) => ({ area, kwh: 2 + index }))}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        nameKey="area"
        aria-label="Radar">
        <RadarChart.Grid />
        <RadarChart.Line dataKey="kwh" />
        <RadarChart.Tooltip />
      </RadarChart.Root>
    ),
    options: [
      [0, 0.6],
      [90, 0.6],
      [180, 0.6],
    ],
    index: [0, 1, 2],
  },
  {
    family: "clock",
    chart: (
      <ClockChart.Root
        data={Array.from({ length: 24 }, (_, hour) => ({
          start: DAY + hour * 3_600_000,
          kwh: 1 + (hour % 5),
        }))}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        aria-label="Døgn">
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Tooltip />
      </ClockChart.Root>
    ),
    options: [
      [7.5, 0.7],
      [97.5, 0.7],
      [187.5, 0.7],
    ],
    index: [0, 6, 12],
  },
];

/** A rendered chart and where each of its first three options sits in client pixels. */
type Rendered = { readonly host: HTMLElement; readonly at: (option: number) => TouchPoint };

function render(chart: ReactNode, options: Family["options"]): Rendered {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>{chart}</div>
    </LocaleProvider>
  );
  // DOM audit: every polar layer is aria-hidden plot output in the dial's units.
  const layer = polarFigure(host).querySelector<SVGSVGElement>("svg[data-polar-layer]");
  if (layer === null) throw new Error("no polar layer");
  return {
    host,
    at: (option) => {
      const [angle = 0, radius = 0] = options[option] ?? [];
      const point = dialPoint(angle, radius);
      const [x, y] = clientPoint(layer, point.x, point.y);
      return { x, y };
    },
  };
}

// A test that fails mid-gesture lifts its finger, so the next one starts with none down.
afterEach(async () => {
  if (down) await touch("touchEnd");
});

function pinned(host: HTMLElement): boolean {
  // DOM audit: Root's figure states the pin on its own data attribute.
  return polarFigure(host).hasAttribute("data-pinned");
}

describe("a finger on a polar chart (SPEC's L8 touch check)", () => {
  it.each(FAMILIES)(
    "scrubs the active option under the finger on a $family chart, and pins it on lift",
    async ({ chart, options, index }) => {
      const { host, at } = render(chart, options);
      await touch("touchStart", at(0));
      await expect.poll(() => activeSlice(host)).toBe(index[0]);
      await touch("touchMove", at(1));
      await expect.poll(() => activeSlice(host)).toBe(index[1]);
      await touch("touchMove", at(2));
      await expect.poll(() => activeSlice(host)).toBe(index[2]);
      await touch("touchEnd");
      await expect.poll(() => pinned(host)).toBe(true);
      expect(activeSlice(host)).toBe(index[2]);
      expect(popupOpen()).toBe(true);
    }
  );

  it.each(FAMILIES)(
    "pins an option with a tap on a $family chart and dismisses it with a second",
    async ({ chart, options, index }) => {
      const { host, at } = render(chart, options);
      await touch("touchStart", at(1));
      await touch("touchEnd");
      await expect.poll(() => pinned(host)).toBe(true);
      expect(activeSlice(host)).toBe(index[1]);
      expect(popupOpen()).toBe(true);
      await touch("touchStart", at(1));
      await touch("touchEnd");
      await expect.poll(() => pinned(host)).toBe(false);
      await expect.poll(popupOpen).toBe(false);
      expect(activeSlice(host)).toBe(null);
    }
  );
});
