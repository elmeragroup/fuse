// One pixel column for the active slot, in Chromium: the focused option, the crosshair band, the
// active bar and the tooltip's anchor. Oracle: the device pixel grid itself and the column's own
// edges. The option and the band cover the same edges, every edge lies a whole number of device
// pixels from the plot's origin, which the browser draws on a device pixel, and the active bar and
// the popup centre on the column, at 1x and at a 4x pixel ratio, which is what 400 % zoom gives a
// page, with the chart starting part of the way into a pixel.
import { afterEach, describe, expect, it } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** The device metrics Chromium emulates, a 4x pixel ratio for 400 % zoom. */
type DeviceMetrics = {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly mobile: boolean;
};

type MetricsCdp = {
  send: ((method: "Emulation.setDeviceMetricsOverride", params: DeviceMetrics) => Promise<void>) &
    ((method: "Emulation.clearDeviceMetricsOverride") => Promise<void>);
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): MetricsCdp => cdp() as MetricsCdp;

afterEach(async () => {
  await session().send("Emulation.clearDeviceMetricsOverride");
});

const ROWS = ["a", "b", "c", "d", "e", "f", "g"].map((name, index) => ({ name, v: 2 + (index % 3) }));

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function rectOf(element: Element | null | undefined): DOMRect {
  if (element === null || element === undefined) throw new Error("no element");
  return element.getBoundingClientRect();
}

/** Whether a distance from the plot's origin is a whole number of device pixels. */
function onGrid(at: number): boolean {
  return Math.abs(at * devicePixelRatio - Math.round(at * devicePixelRatio)) < 0.01;
}

async function column(width: number) {
  const { host } = renderThemed(
    <LocaleProvider locale="nb-NO">
      <div style={{ marginLeft: 13.37, width, paddingTop: 120 }}>
        <button type="button">før</button>
        <Chart.Root
          data-intro="none"
          data={ROWS}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          aria-label="Kolonne">
          <Chart.YAxis />
          <Chart.Crosshair />
          <Chart.Bar dataKey="v" />
          <Chart.Tooltip />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
  host.querySelector("button")?.focus();
  await userEvent.keyboard("{Tab}{ArrowRight}{ArrowRight}");
  await frame();
  await frame();
  // DOM audit: the focused option, the crosshair, the overlay and the popup are the parts under test.
  return {
    plot: rectOf(host.querySelector('[data-slot="chart-plot"]')),
    option: rectOf(document.activeElement),
    band: rectOf(host.querySelector('[data-slot="chart-crosshair"] rect')),
    bar: rectOf(host.querySelector('[data-slot="chart-bar-active"]')),
    popup: rectOf(document.querySelector('[data-slot="chart-tooltip"]')),
  };
}

describe("the active column", () => {
  it.each([
    [1, 333],
    [1, 517.5],
    [4, 333],
    [4, 517.5],
  ])("shares one pixel column at a %sx pixel ratio and %s px wide", async (ratio, width) => {
    if (ratio !== 1) {
      await session().send("Emulation.setDeviceMetricsOverride", {
        width: 1024,
        height: 768,
        deviceScaleFactor: ratio,
        mobile: false,
      });
      await frame();
    }
    expect(devicePixelRatio).toBe(ratio);
    const { plot, option, band, bar, popup } = await column(width);
    expect(band.left).toBeCloseTo(option.left, 2);
    expect(band.right).toBeCloseTo(option.right, 2);
    for (const edge of [band.left, band.right, bar.left, bar.right])
      expect(onGrid(edge - plot.left)).toBe(true);
    const centre = (band.left + band.right) / 2;
    // The bar keeps the band's middle, so each side's gap differs by one device pixel at most.
    expect(Math.abs((bar.left + bar.right) / 2 - centre)).toBeLessThanOrEqual(0.5 / ratio + 0.01);
    // Base UI centres the popup on the anchor and rounds its place to a device pixel.
    expect(Math.abs((popup.left + popup.right) / 2 - centre)).toBeLessThanOrEqual(1);
  });
});
