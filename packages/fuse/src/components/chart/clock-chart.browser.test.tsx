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
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Oklab from "@elmeragroup/color/oklab";
import { getOrThrow } from "@elmeragroup/color/result";
import type { Srgb } from "@elmeragroup/color/srgb";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { computedColor } from "../../../test/assert-invalid-ring";
import { angleOf, clockLayer, clockPath, dotPoints, wedgeRadii } from "../../../test/chart/clock";
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
  now,
  children,
}: {
  readonly data?: readonly Record<string, number>[];
  readonly config?: ChartConfig;
  readonly scale?: "radial" | "linear";
  readonly now?: number;
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
          now={now}
          data-intro="none"
          aria-label="Døgn">
          {children}
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
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
    for (let ring = 0; ring < 3; ring += 1) {
      for (let step = 0; step < 36; step += 1) {
        const angle = step * 10 + 3;
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

  it("glows a value-painted line through a filter that blurs its own pixels", async () => {
    const { host } = renderThemed(
      <Dial config={split}>
        <ClockChart.Glow>
          <ClockChart.Line dataKey="kwh" />
        </ClockChart.Glow>
      </Dial>
    );
    await painted();
    const line = clockLayer(host, "clock-chart-line");
    expect(line.getAttribute("data-paint")).toBe("value");
    // A line's halo is 9.5 px, which the dial's 100 px nominal radius makes 0.095 of its units.
    expect(Number(line.querySelector("feGaussianBlur")?.getAttribute("stdDeviation"))).toBeCloseTo(0.095, 9);
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
    // 1.1 R at 100.8° lies at x = 1.1 sin 100.8°, y = −1.1 cos 100.8°, in a box from −1 to 1.
    const radians = (100.8 * Math.PI) / 180;
    expect(Number.parseFloat(six?.style.getPropertyValue("--_x") ?? "")).toBeCloseTo(
      ((1.1 * Math.sin(radians) + 1) / 2) * 100,
      2
    );
    expect(Number.parseFloat(six?.style.getPropertyValue("--_y") ?? "")).toBeCloseTo(
      ((-1.1 * Math.cos(radians) + 1) / 2) * 100,
      2
    );
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
