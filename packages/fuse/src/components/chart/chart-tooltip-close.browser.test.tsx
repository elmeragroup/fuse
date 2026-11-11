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
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { useChartPoint } from "./use-chart-point";

/** Two series in one stack, each with an icon, so every series part has something to show. */
const SERIES = {
  heating: { label: "Oppvarming", color: "chart-1", stack: "use", icon: <svg data-icon="heating" /> },
  water: { label: "Varmtvann", color: "chart-2", stack: "use", icon: <svg data-icon="water" /> },
} satisfies ChartConfig;

/** The tooltip popup, portalled out of the host. */
function popupNode(): HTMLElement | null {
  // The popup is aria-hidden and portalled, read by its slot.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
}

/** What the popup shows: its text, each swatch's series and each icon. */
function fingerprint(node: HTMLElement): string {
  // Swatches and icons are aria-hidden decoration, read by their slots.
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

describe("a shut tooltip lets go of its point", () => {
  /** Prints whether the enclosing chart has a point, as a custom tooltip child reads it. */
  function PointProbe(): ReactElement {
    const point = useChartPoint();
    return <span data-point-probe="">{point === null ? "none" : "point"}</span>;
  }

  it("so useChartPoint() in a custom child reads null once the popup has closed", async () => {
    renderThemed(
      <Locale>
        <Chart.Root
          data={["k0", "k1", "k2"].map((name, index) => ({ name, heating: index + 1, water: index }))}
          config={SERIES}
          xKey="name"
          aria-label="Forbruk">
          <Chart.Bar dataKey="heating" />
          <Chart.Tooltip>
            <PointProbe />
          </Chart.Tooltip>
        </Chart.Root>
      </Locale>
    );
    // The popup is aria-hidden and stays mounted once open, so the probe is read by its attribute.
    const probe = () => document.querySelector("[data-point-probe]")?.textContent;
    const { changed } = await closeAndRead("{ArrowRight}", () => {
      expect(probe()).toBe("point");
    });
    // The fade keeps the point it showed; the shut popup holds none.
    expect(changed).toEqual([]);
    await expect.poll(probe).toBe("none");
  });
});
