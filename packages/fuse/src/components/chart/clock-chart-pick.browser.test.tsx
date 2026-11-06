// The clock's pick under a resting hand, in Chromium. Unit under test: the polar pick's 2 px dead
// band (MOTION-REVIEW Fix R2.5, R2.13). Oracle, worked by hand: on a 168-hour week dial of radius
// 100 px, 0.35 R is a 35 px circle, where one hour spans 2π · 35 / 168 ≈ 1.31 px of arc. A tremor of
// ±1 px across the ray lands 2 px from where it last picked, within the dead band, so it keeps the
// hour it first took. A 3 px move from an hour's middle lands 2.3 hours away, and even its point 2 px
// back is 1 px from the middle, past the hour's half-width of 0.65 px, so it changes the hour.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { clockLayer } from "../../../test/chart/clock";
import { clientPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";

/** Monday 20 October 2025 in Oslo, the week's first hour. */
const MONDAY = Date.parse("2025-10-19T22:00:00Z");

function Week() {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>
        <ClockChart.Root
          data={Array.from({ length: 168 }, (_, hour) => ({
            start: MONDAY + hour * 3_600_000,
            kwh: 1 + (hour % 5),
          }))}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="start"
          cycle="week"
          interval="hour"
          data-intro="none"
          aria-label="Uke">
          <ClockChart.Column dataKey="kwh" />
        </ClockChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** A client point `across` CSS px off hour `hour`'s middle ray at 0.35 R, across the ray. */
function nearHour(layer: SVGSVGElement, hour: number, across: number): readonly [number, number] {
  const [x0] = clientPoint(layer, 0, 0);
  const [x1] = clientPoint(layer, 1, 0);
  const unit = across / (x1 - x0);
  const radians = (((hour + 0.5) * 360) / 168) * (Math.PI / 180);
  const x = 0.35 * Math.sin(radians) + unit * Math.cos(radians);
  const y = -0.35 * Math.cos(radians) + unit * Math.sin(radians);
  return clientPoint(layer, x, y);
}

const active = (host: HTMLElement) => polarFigure(host).style.getPropertyValue("--chart-active");

describe("the pick's dead band (R2.13)", () => {
  it("keeps the hour a ±1 px tremor near the hole first took", async () => {
    const { host } = renderThemed(<Week />);
    const layer = clockLayer(host, "clock-chart-column");
    await hoverAt(...nearHour(layer, 40, 1));
    const first = active(host);
    expect(first).not.toBe("");
    const seen = new Set<string>();
    for (let move = 0; move < 30; move += 1) {
      await hoverAt(...nearHour(layer, 40, move % 2 === 0 ? -1 : 1));
      seen.add(active(host));
    }
    expect([...seen]).toEqual([first]);
  });

  it("changes the hour on a 3 px move from an hour's middle", async () => {
    const { host } = renderThemed(<Week />);
    const layer = clockLayer(host, "clock-chart-column");
    await hoverAt(...nearHour(layer, 40, 0));
    expect(active(host)).toBe("40");
    await hoverAt(...nearHour(layer, 40, 3));
    expect(active(host)).not.toBe("40");
  });
});
