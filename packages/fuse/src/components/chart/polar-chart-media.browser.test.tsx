// The polar families under forced colours and in print, in Chromium. Units under test: PieChart,
// RadialChart, RadarChart and ClockChart with their marks. Oracles: under forced colours, every
// mark layer computes `forced-color-adjust: none`, as ScatterChart's points do, and the figure
// paints as many chromatic pixels as on screen, within 2 %, so each series keeps its colour. In
// print, a chart caught mid-entrance draws every mark at rest: each mark's geometry equals the same
// chart drawn with no entrance, and every mark layer is visible under the print media.
import type { ReactElement } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { server } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { installFrameClock } from "../../../test/chart/frame-clock";
import { chromaticPixels, emulateMedia } from "../../../test/chart/media";
import { polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

const FORCED = server.browser === "chromium";

afterEach(async () => {
  if (FORCED) await emulateMedia("screen", "none");
});

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

/** Each family's chart, with its entrance on or off, and the slots of its mark layers. */
const FAMILIES: readonly {
  readonly family: string;
  readonly chart: (intro: "none" | undefined) => ReactElement;
  readonly marks: readonly string[];
}[] = [
  {
    family: "pie",
    chart: (intro) => (
      <PieChart.Root
        data={BILL}
        config={BILL_CONFIG}
        nameKey="part"
        valueKey="kr"
        data-intro={intro}
        aria-label="Regning">
        <PieChart.Glow dataKey="energi" />
        <PieChart.Pie />
      </PieChart.Root>
    ),
    marks: ["pie-chart-pie", "pie-chart-glow"],
  },
  {
    family: "radial",
    chart: (intro) => (
      <RadialChart.Root
        data={BILL}
        config={BILL_CONFIG}
        nameKey="part"
        valueKey="kr"
        max={60}
        data-intro={intro}
        aria-label="Ringer">
        <RadialChart.Track />
        <RadialChart.Bar />
      </RadialChart.Root>
    ),
    marks: ["radial-chart-bar"],
  },
  {
    family: "radar",
    chart: (intro) => (
      <RadarChart.Root
        data={["NO1", "NO2", "NO3", "NO4"].map((area, index) => ({ area, kwh: 2 + index, last: 4 - index }))}
        config={{ kwh: { label: "I år", color: "chart-1" }, last: { label: "I fjor", color: "chart-4" } }}
        nameKey="area"
        data-intro={intro}
        aria-label="Radar">
        <RadarChart.Area dataKey="kwh" />
        <RadarChart.Line dataKey="last" />
      </RadarChart.Root>
    ),
    marks: ["radar-chart-area", "radar-chart-line"],
  },
  {
    family: "clock",
    chart: (intro) => (
      <ClockChart.Root
        data={Array.from({ length: 24 }, (_, hour) => ({
          start: DAY + hour * 3_600_000,
          kwh: 1 + (hour % 5),
        }))}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        data-intro={intro}
        aria-label="Døgn">
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Line dataKey="kwh" />
      </ClockChart.Root>
    ),
    marks: ["clock-chart-column", "clock-chart-line"],
  },
];

function render(chart: ReactElement): HTMLElement {
  return renderThemed(
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 320 }}>{chart}</div>
    </LocaleProvider>
  ).host;
}

/** Every mark path's geometry under the layers of the given slots: its d and its dash. */
function geometry(host: HTMLElement, slots: readonly string[]): string[] {
  // DOM audit: polar mark layers are aria-hidden plot output, read by their slot.
  return slots.flatMap((slot) =>
    [...host.querySelectorAll(`[data-slot="${slot}"] path:not([data-ghost])`)].map(
      (path) =>
        `${path.getAttribute("d") ?? ""}|${path.getAttribute("stroke-dasharray") ?? ""}|${path.getAttribute("stroke-dashoffset") ?? ""}`
    )
  );
}

/** Let the frames that paint in a microtask, as the pie's and the rings' do, write what was placed. */
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });
}

describe("forced colours", () => {
  it.runIf(FORCED).each(FAMILIES)("keeps the $family chart's series colours", async ({ chart, marks }) => {
    const host = render(chart("none"));
    await nextFrames(1);
    const box = polarFigure(host).getBoundingClientRect();
    const [screen = 0] = await chromaticPixels([box]);
    await emulateMedia("screen", "active");
    expect(window.matchMedia("(forced-colors: active)").matches).toBe(true);
    await nextFrames(1);
    for (const slot of marks) {
      // DOM audit: each mark layer's computed forced-color-adjust.
      const layer = host.querySelector(`[data-slot="${slot}"]`);
      expect(layer === null ? null : getComputedStyle(layer).forcedColorAdjust, slot).toBe("none");
    }
    const [forced = 0] = await chromaticPixels([box]);
    // Enough colour to compare: a radar's lines and its 10 % fill paint the fewest, about 600 pixels.
    expect(screen).toBeGreaterThan(300);
    expect(Math.abs(forced - screen) / screen).toBeLessThanOrEqual(0.02);
  });
});

describe("print", () => {
  it.runIf(FORCED).each(FAMILIES)(
    "draws every mark of a $family chart at rest when a print starts mid-entrance",
    async ({ chart, marks }) => {
      const rest = render(chart("none"));
      await nextFrames(1);
      await settle();
      const resting = geometry(rest, marks);
      const clock = installFrameClock();
      try {
        const host = render(chart(undefined));
        const start = clock.now();
        await expect
          .poll(() => {
            clock.frameAt(start);
            return polarFigure(host).hasAttribute("data-entering");
          })
          .toBe(true);
        // 300 ms in, every family's marks are still on their way.
        clock.frameAt(start + 300);
        await settle();
        expect(geometry(host, marks)).not.toEqual(resting);
        dispatchEvent(new Event("beforeprint"));
        await emulateMedia("print", "none");
        await settle();
        expect(geometry(host, marks)).toEqual(resting);
        for (const slot of marks) {
          // DOM audit: each mark layer's computed visibility under the print media.
          const layer = host.querySelector(`[data-slot="${slot}"]`);
          expect(layer === null ? null : getComputedStyle(layer).visibility, slot).toBe("visible");
        }
      } finally {
        clock.restore();
      }
    }
  );
});
