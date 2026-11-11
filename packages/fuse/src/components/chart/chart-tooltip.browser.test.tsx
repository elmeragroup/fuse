import type { ReactElement } from "react";

// WCAG 1.4.13 for the chart tooltip, rows T043 and T044, in Chromium. The
// sequence and its outcomes come from CONTRACT section 9.12, and every expected label is written
// by hand from the committed Elhub rows.
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { S06Chart } from "../../../test/chart/bar-charts";
import { label, pointerAt, popup, surfaceBox } from "../../../test/chart/marks";
import { bars as drawnBars } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { useChartPoint } from "./use-chart-point";

afterEach(async () => {
  await page.viewport(1024, 768);
});

/** Wait for two animation frames and the popup's open fade, so Base UI has placed it. */
async function settle(): Promise<void> {
  await nextFrames(2);
  // The popup portals to the theme scope container, outside the render host.
  const open = document.querySelector('[data-slot="chart-tooltip"]');
  await Promise.all(open?.getAnimations({ subtree: true }).map((animation) => animation.finished) ?? []);
}

/**
 * Whether a popup shows on screen: rendered, not hidden and not faded out. A closed popup stays
 * mounted once it has opened, so closing must take it out of view, not out of the document.
 */
function visible(element: HTMLElement): boolean {
  return element.checkVisibility({ opacityProperty: true, visibilityProperty: true });
}

/** The open popup, which the test keeps to follow through its close and its reopening. */
function openPopup(): HTMLElement {
  const open = popup();
  if (open === null) throw new Error("no open popup");
  return open;
}

/** Move the pointer to a point in client coordinates, as `pointerAt` does, and let the popup settle. */
async function pointerTo(x: number, y: number): Promise<void> {
  await pointerAt(x, y);
  await settle();
}

function chart() {
  return renderThemed(
    <div style={{ padding: "160px 24px 24px", width: "min(600px, 100%)", boxSizing: "border-box" }}>
      <S06Chart>
        <Chart.Bar dataKey="household" />
        <Chart.Tooltip />
      </S06Chart>
    </div>
  );
}

describe.each([
  ["at the desktop width", 1024],
  ["in a 320 px viewport, WCAG 1.4.10's reflow width", 320],
])("the tooltip %s", (_, width) => {
  it("is hoverable, persistent and dismissible", async () => {
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    // Slot 14 is 14:00 to 15:00.
    const x = plot.left + slotWidth * 14.5;
    await pointerTo(x, plot.top + plot.height * 0.8);
    expect(label()).toBe("14–15");
    const open = openPopup();
    expect(visible(open)).toBe(true);
    // The popup sits above the column, or beside it when the root has no room above. Straight
    // up or down the column stays on the slot, so the pointer reaches the popup's height and then
    // the popup itself without the content changing.
    const box = popup()?.getBoundingClientRect() ?? new DOMRect();
    const side = popup()?.getAttribute("data-side");
    const middle = box.top + box.height / 2;
    // A popup beside the column touches it on its near edge, the right edge of a popup on the left.
    const near = side === "left" ? box.right - 4 : box.left + 4;
    await pointerTo(x, side === "top" ? box.bottom + 2 : middle);
    expect(label()).toBe("14–15");
    await pointerTo(side === "top" ? x : near, side === "top" ? box.bottom - 4 : middle);
    expect(label()).toBe("14–15");
    // Sideways inside the popup keeps it, over whatever slots lie beneath.
    await pointerTo(box.right - 4, middle);
    expect(label()).toBe("14–15");
    await pointerTo(box.left + 4, middle);
    expect(label()).toBe("14–15");
    // Back onto another slot updates it in place.
    await pointerTo(plot.left + slotWidth * 3.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("03–04");
    // Leaving the plot and the popup closes it, out of view once its exit ends.
    await pointerTo(4, 4);
    await expect.poll(() => visible(open)).toBe(false);
    expect(popup()).toBeNull();
    // Coming back opens the same popup into view.
    await pointerTo(plot.left + slotWidth * 3.5, plot.top + plot.height * 0.9);
    expect(popup()).toBe(open);
    await expect.poll(() => visible(open)).toBe(true);
  });

  it("closes on Escape with the pointer still, and stays closed until the slot changes", async () => {
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("05–06");
    const open = openPopup();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => visible(open)).toBe(false);
    expect(popup()).toBeNull();
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.85);
    expect(popup()).toBeNull();
    expect(visible(open)).toBe(false);
    await pointerTo(plot.left + slotWidth * 6.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("06–07");
    expect(popup()).toBe(open);
    await expect.poll(() => visible(open)).toBe(true);
  });

  it("reopens on the dismissed slot after the pointer leaves the plot and comes back", async () => {
    // jc14: after Escape, a pointer that left the plot and returned to the same slot never
    // reopened the popup, which fails 1.4.13's sequence at the 320 px reflow width.
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    const open = openPopup();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => visible(open)).toBe(false);
    expect(popup()).toBeNull();
    await pointerTo(4, 4);
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("05–06");
    expect(popup()).toBe(open);
    await expect.poll(() => visible(open)).toBe(true);
  });
});

describe("the tooltip after Escape and a blur", () => {
  it("opens on the slot Escape closed once focus has left the chart", async () => {
    // From the button before the chart, Tab and five steps reach 05–06, and Escape closes it. The
    // dismissal lasts only while the reader stays, so after Tab moves on to the button after the
    // chart, a pointer that moves over 05–06 opens it.
    const { host } = chart();
    page.getByRole("button", { name: "før" }).element().focus();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await expect.poll(label).toBe("05–06");
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe("etter");
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.4, plot.top + plot.height * 0.9);
    await pointerTo(plot.left + slotWidth * 5.6, plot.top + plot.height * 0.85);
    await expect.poll(label).toBe("05–06");
  });
});

describe("tooltip readings", () => {
  it("adds the projection word after a projected value, as the option and the table do", async () => {
    // q17 and s13: b is projected, and en-US spells the word "projected".
    renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[
              { name: "a", v: 1 },
              { name: "b", v: 2 },
            ]}
            config={{ v: { label: "V", color: "chart-1", projectedFrom: "b" } }}
            xKey="name"
            defaultActiveX="b"
            aria-label="Projection">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await settle();
    // The popup portals out of the host, and its value slot holds the reading.
    expect(document.querySelector('[data-slot="chart-tooltip-value"]')?.textContent).toBe("2 (projected)");
  });
});

describe.each([
  ["at 1280 px", 1280],
  ["at 320 px", 320],
])("a pointer sweep %s", (_, width) => {
  afterEach(async () => {
    await page.viewport(414, 896);
  });

  it.each([
    ["above the bars", (box: DOMRect) => box.top + box.height * 0.04],
    ["3 px under the plot top, where the tallest columns end", (box: DOMRect) => box.top + 3],
    ["across the bars", (box: DOMRect) => box.top + box.height * 0.6],
  ])("names the slot under the pointer %s at every step", async (__, depth) => {
    // jc2: the popup sat on the pointer's path, so a sweep over it kept naming an older slot. The
    // oracle is the slot under the pointer, by x alone, as CONTRACT section 9.5 picks it.
    await page.viewport(width, 720);
    const { host } = renderThemed(
      <div style={{ padding: "24px", width: "100%", boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={["a", "b", "c", "d", "e", "f", "g", "h"].map((name, index) => ({
              name,
              v: 2 + (index % 3),
            }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Sweep">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = surfaceBox(host);
    const slots = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const seen: (string | null)[] = [];
    const bars = drawnBars(host);
    for (const [index] of slots.entries()) {
      await pointerTo(box.left + (box.width * (index + 0.5)) / slots.length, depth(box));
      seen.push(label());
      // The popup sits on its column's edge and never covers the column it reads.
      const own = bars[index]?.getBoundingClientRect() ?? new DOMRect();
      const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
      const covers =
        shown.left < own.right &&
        own.left < shown.right &&
        shown.top < own.bottom - 0.5 &&
        own.top + 0.5 < shown.bottom;
      expect(covers, `${slots[index] ?? ""} at ${JSON.stringify(shown)} over ${JSON.stringify(own)}`).toBe(
        false
      );
    }
    expect(seen).toEqual(slots);
  });
});

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
describe("closing tooltip", () => {
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
});
