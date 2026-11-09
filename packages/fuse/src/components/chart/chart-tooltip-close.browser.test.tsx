// A closing tooltip keeps all its content. Units under test: every public part that can sit in a
// tooltip, with its dataKey left off where the part allows: TooltipLabel, TooltipItems with its
// default rows, Swatch, SeriesLabel, SeriesIcon, TooltipValue, TooltipShare, and where the family
// has them ActiveValue and TooltipTotal, and the centre parts, Center, CenterValue, CenterName,
// CenterShare, CenterLabel and CenterMax, in custom tooltips over Chart, ClockChart, RadarChart,
// RadialChart and PieChart, and ScatterChart's own TooltipLabel and TooltipValue. Oracle: DECISIONS.md R2.1–R2.3, a closing tooltip keeps its place, width, lane and
// content until the popup has closed, so the popup's text, each swatch's series and each icon read
// on every frame from Escape until the popup has gone are the ones it showed open. Where the family
// has series, a non-default one has focus, and ActiveValue's fallback reading differs from the
// active one, so a reader that drops the held point shows on the first frame.
import type { ReactElement, ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";
import { ScatterChart } from "./scatter-chart-namespace";

const DAY = Date.parse("2025-10-24T22:00:00Z");
const HOUR = 3_600_000;

/** Two series in one stack, each with an icon, so every series part has something to show. */
const SERIES = {
  heating: { label: "Oppvarming", color: "chart-1", stack: "use", icon: <svg data-icon="heating" /> },
  water: { label: "Varmtvann", color: "chart-2", stack: "use", icon: <svg data-icon="water" /> },
} satisfies ChartConfig;

/** The parts every family's tooltip holds, with no dataKey. */
function SharedParts({
  ns,
}: {
  readonly ns: typeof Chart | typeof ClockChart | typeof RadarChart | typeof PieChart | typeof RadialChart;
}): ReactNode {
  return (
    <>
      <ns.TooltipLabel />
      <ns.TooltipItems />
      <div data-probe="">
        <ns.Swatch />
        <ns.SeriesIcon />
        <ns.SeriesLabel />
        <ns.TooltipValue />
        <ns.TooltipShare />
      </div>
    </>
  );
}

/** The tooltip popup, portalled out of the host. */
function popupNode(): HTMLElement | null {
  // DOM audit: the popup is aria-hidden and portalled, read by its slot.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
}

/** The series label the probe row prints, the focused series'. */
function probeLabel(node: HTMLElement): string | null | undefined {
  // DOM audit: the popup is aria-hidden, so its series label's slot is the only locator.
  return node.querySelector('[data-probe] [data-slot="chart-series-label"]')?.textContent;
}

/** What the popup shows: its text, each swatch's series and each icon. */
function fingerprint(node: HTMLElement): string {
  // DOM audit: swatches and icons are aria-hidden decoration, read by their slots.
  const swatches = [...node.querySelectorAll('[data-slot="chart-swatch"]')].map((swatch) =>
    swatch.getAttribute("data-series")
  );
  const icons = [...node.querySelectorAll('[data-slot="chart-series-icon"]')].map(
    (icon) => icon.querySelector("[data-icon]")?.getAttribute("data-icon") ?? null
  );
  return JSON.stringify({ text: node.textContent, swatches, icons });
}

/**
 * Open the tooltip by keyboard with the given keys, check what it shows, press Escape and read the
 * popup on every frame until it has gone.
 */
async function closeAndRead(keys: string, expectOpen: (node: HTMLElement) => void) {
  await userEvent.tab();
  if (keys !== "") await userEvent.keyboard(keys);
  await expect.poll(() => Number(getComputedStyle(popupNode() ?? document.body).opacity)).toBe(1);
  await nextFrames(4);
  const open = popupNode();
  if (open === null) throw new Error("no popup");
  expectOpen(open);
  const shown = fingerprint(open);
  const visible = () =>
    open.isConnected && open.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  // The frames are recorded in the page from before the key, so a slow round trip for the key
  // command cannot let the exit pass unseen.
  const recorded = recordFrames(
    () => ({
      print: fingerprint(open),
      shown: visible(),
      closing: visible() && !open.hasAttribute("data-open"),
    }),
    () => !visible()
  );
  await userEvent.keyboard("{Escape}");
  const frames = await recorded;
  expect(visible()).toBe(false);
  expect(frames.some(({ closing }) => closing)).toBe(true);
  return {
    shown,
    changed: frames.filter((frame) => frame.shown && frame.print !== shown).map(({ print }) => print),
  };
}

function Locale({ children }: { readonly children: ReactElement }): ReactElement {
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <div style={{ width: 640, padding: 160 }}>{children}</div>
    </LocaleProvider>
  );
}

describe("a closing tooltip keeps all its content", () => {
  it("in Chart, with hot water focused at a slot whose readings differ from the first", async () => {
    // Slot 3 reads heating 4 and hot water 3; the first slot reads heating 1.
    renderThemed(
      <Locale>
        <Chart.Root
          data={["k0", "k1", "k2", "k3", "k4"].map((name, index) => ({
            name,
            heating: index + 1,
            water: index,
          }))}
          config={SERIES}
          xKey="name"
          aria-label="Forbruk">
          <Chart.Bar dataKey="heating" />
          <Chart.Bar dataKey="water" />
          <Chart.Tooltip>
            <SharedParts ns={Chart} />
            <Chart.ActiveValue dataKey="heating" fallback="first" />
            <Chart.TooltipTotal />
          </Chart.Tooltip>
        </Chart.Root>
      </Locale>
    );
    const { changed } = await closeAndRead(
      "{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}",
      (node) => {
        expect(probeLabel(node)).toBe("Varmtvann");
      }
    );
    expect(changed).toEqual([]);
  });

  it("in ClockChart, with hot water focused at hour 5", async () => {
    renderThemed(
      <Locale>
        <ClockChart.Root
          data={Array.from({ length: 24 }, (_, hour) => ({
            start: DAY + hour * HOUR,
            heating: hour + 1,
            water: 1,
          }))}
          config={SERIES}
          xKey="start"
          cycle="day"
          interval="hour"
          data-intro="none"
          aria-label="Døgn">
          <ClockChart.Line dataKey="heating" />
          <ClockChart.Line dataKey="water" />
          <ClockChart.Tooltip>
            <SharedParts ns={ClockChart} />
            <ClockChart.ActiveValue dataKey="heating" fallback="first" />
            <ClockChart.TooltipTotal />
          </ClockChart.Tooltip>
        </ClockChart.Root>
      </Locale>
    );
    const steps = "{ArrowRight}".repeat(5);
    const { changed } = await closeAndRead(`${steps}{ArrowDown}{ArrowDown}`, (node) => {
      expect(probeLabel(node)).toBe("Varmtvann");
    });
    expect(changed).toEqual([]);
  });

  it("in RadarChart, with NO2 focused on a later spoke", async () => {
    renderThemed(
      <Locale>
        <RadarChart.Root
          data={["Jan", "Feb", "Mar", "Apr", "Mai"].map((month, index) => ({
            month,
            NO1: 400 + index * 10,
            NO2: 300 + index * 20,
          }))}
          config={{
            NO1: { label: "NO1", color: "chart-1", icon: <svg data-icon="no1" /> },
            NO2: { label: "NO2", color: "chart-2", icon: <svg data-icon="no2" /> },
          }}
          nameKey="month"
          data-intro="none"
          aria-label="Forbruk per måned">
          <RadarChart.Line dataKey="NO1" />
          <RadarChart.Line dataKey="NO2" />
          <RadarChart.Tooltip>
            <SharedParts ns={RadarChart} />
          </RadarChart.Tooltip>
        </RadarChart.Root>
      </Locale>
    );
    const { changed } = await closeAndRead("{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}", (node) => {
      expect(probeLabel(node)).toBe("NO2");
    });
    expect(changed).toEqual([]);
  });

  it("in ScatterChart, on a later point, with its label and both values", async () => {
    // The walk runs by x: (−2, 20 000), (1, 140 000), (2, 90 000), so two steps reach the 2026 point
    // at 2 °C, 90 000 kWh.
    renderThemed(
      <Locale>
        <ScatterChart.Root
          data={[
            { t: 2, kwh: 90_000, s: "now" },
            { t: -2, kwh: 20_000, s: "now" },
            { t: 1, kwh: 140_000, s: "last" },
          ]}
          config={{
            now: { label: "Forbruk 2026", color: "chart-1" },
            last: { label: "Forbruk 2025", color: "chart-4" },
          }}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          data-intro="none"
          aria-label="Forbruk mot temperatur">
          <ScatterChart.Points dataKey="now" />
          <ScatterChart.Points dataKey="last" />
          <ScatterChart.Tooltip>
            <ScatterChart.TooltipLabel />
            <ScatterChart.TooltipValue axis="x" />
            <ScatterChart.TooltipValue axis="y" />
          </ScatterChart.Tooltip>
        </ScatterChart.Root>
      </Locale>
    );
    const { changed } = await closeAndRead("{ArrowRight}{ArrowRight}", (node) => {
      // DOM audit: the popup is aria-hidden, so its label's slot is the only locator.
      expect(node.querySelector('[data-slot="chart-tooltip-label"]')?.textContent).toBe("Forbruk 2026");
    });
    expect(changed).toEqual([]);
  });

  it("in RadialChart, on its second ring, with every centre part", async () => {
    renderThemed(
      <Locale>
        <RadialChart.Root
          data={[
            { part: "kwh", used: 3.9, budget: 5 },
            { part: "kr", used: 410, budget: 500 },
          ]}
          config={{
            kwh: { label: "Strøm", color: "chart-1", icon: <svg data-icon="kwh" /> },
            kr: { label: "Kostnad", color: "chart-2", icon: <svg data-icon="kr" /> },
          }}
          nameKey="part"
          valueKey="used"
          maxKey="budget"
          data-intro="none"
          aria-label="Budsjett">
          <RadialChart.Track />
          <RadialChart.Bar />
          <RadialChart.Tooltip>
            <SharedParts ns={RadialChart} />
            <RadialChart.Center>
              <RadialChart.CenterValue />
              <RadialChart.CenterName>I alt</RadialChart.CenterName>
              <RadialChart.CenterShare />
              <RadialChart.CenterLabel>av</RadialChart.CenterLabel>
              <RadialChart.CenterMax />
            </RadialChart.Center>
          </RadialChart.Tooltip>
        </RadialChart.Root>
      </Locale>
    );
    const { changed } = await closeAndRead("{ArrowRight}", (node) => {
      expect(probeLabel(node)).toBe("Kostnad");
    });
    expect(changed).toEqual([]);
  });

  it("in PieChart, on its second slice, with every centre part", async () => {
    renderThemed(
      <Locale>
        <PieChart.Root
          data={[
            { part: "energi", kr: 640 },
            { part: "nettleie", kr: 360 },
            { part: "avgift", kr: 120 },
          ]}
          config={{
            energi: { label: "Energi", color: "chart-1", icon: <svg data-icon="energi" /> },
            nettleie: { label: "Nettleie", color: "chart-2", icon: <svg data-icon="nettleie" /> },
            avgift: { label: "Avgifter", color: "chart-3", icon: <svg data-icon="avgift" /> },
          }}
          nameKey="part"
          valueKey="kr"
          innerRadius={0.6}
          data-intro="none"
          aria-label="Regning">
          <PieChart.Pie />
          <PieChart.Tooltip>
            <SharedParts ns={PieChart} />
            <PieChart.Center>
              <PieChart.CenterValue />
              <PieChart.CenterName>Totalt</PieChart.CenterName>
              <PieChart.CenterShare />
              <PieChart.CenterLabel>av</PieChart.CenterLabel>
              <PieChart.CenterMax />
            </PieChart.Center>
          </PieChart.Tooltip>
        </PieChart.Root>
      </Locale>
    );
    const { changed } = await closeAndRead("{ArrowRight}", (node) => {
      expect(probeLabel(node)).toBe("Nettleie");
    });
    expect(changed).toEqual([]);
  });
});
