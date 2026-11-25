// WCAG 1.4.13 for the chart tooltip, in Chromium. Every expected label is written by hand from the
// committed Elhub rows.
import type { ReactElement } from "react";

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, recordFrames } from "../../../test/animation-frames";
import { S06Chart } from "../../../test/chart/bar-charts";
import {
  bars as drawnBars,
  framesThroughReport,
  label,
  mountedPopup,
  pointerAt,
  popup,
  popupFrame,
  popupPaints,
  shownFrames,
  surface,
  surfaceBox,
  visible,
} from "../../../test/chart/marks";
import {
  adoptPageStyles,
  CROSS_ORIGIN,
  SAME_ORIGIN,
  frameRoot,
  navigableFrame,
} from "../../../test/navigable-frame";
import { renderIn, restoreDocumentThemeAroundEach, srgb, surfaceAt } from "../../../test/surface-paint";
import { fkasBranded, fkasPrivate } from "../../../test/theme-fixtures";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { Chart } from "./chart-namespace";
import { createTooltipGlider } from "./chart-tooltip-glide";
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
    // After Escape, a pointer that leaves the plot and returns to the same slot must reopen the
    // popup, as 1.4.13's sequence asks at the 320 px reflow width.
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
    // From the button before the chart, Tab and five steps reach 05 to 06, and Escape closes it. The
    // dismissal lasts only while the reader stays, so after Tab moves on to the button after the
    // chart, a pointer that moves over 05 to 06 opens it.
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

describe("the tooltip under touch after a mouse", () => {
  it("lets taps through to the plot from a touch on the slot the mouse showed", async () => {
    // CONTRACT section 9.5: under touch the popup passes taps through to the plot. A touch on the
    // slot the mouse already shows moves no active slot, so only the input kind changes.
    const { host } = chart();
    const plot = surfaceBox(host);
    const x = plot.left + (plot.width / 24) * 14.5;
    const y = plot.top + plot.height * 0.8;
    await pointerTo(x, y);
    const open = openPopup();
    expect(getComputedStyle(open).pointerEvents).toBe("auto");
    // A synthetic touch press is the only way to give Chromium a touch pointer type without
    // emulating a touch device for the whole file.
    page
      .getByRole("listbox")
      .element()
      .dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerType: "touch" })
      );
    await expect.poll(() => getComputedStyle(open).pointerEvents).toBe("none");
    expect(label()).toBe("14–15");
  });
});

describe("tooltip readings", () => {
  it("adds the projection word after a projected value, as the option and the table do", async () => {
    // B is projected, and en-US spells the word "projected".
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
    // The popup opens once the plot's first in-view report lands. It portals out of the host, and its
    // value slot holds the reading.
    await expect
      .poll(() => document.querySelector('[data-slot="chart-tooltip-value"]')?.textContent)
      .toBe("2 (projected)");
  });
});

describe("the default item's popup while its plot is out of view", () => {
  it("paints no popup under display: none, and paints its first frame over the default bar once it shows", async () => {
    // B is active by default, and the chart starts under display: none. The oracle is the rule that
    // a default item's popup shows only while the plot is in view, and `anchor="point"`'s documented
    // rest: centered on the active slot, 8 px above its bar. The top padding leaves room above, and
    // the bars skip their entrance, so they stand at their full height on the first frame.
    let host: HTMLElement = document.body;
    const mounted = await framesThroughReport(popupFrame, () => {
      ({ host } = renderThemed(
        <div data-testid="hidden" style={{ display: "none", width: 400, paddingTop: 160 }}>
          <LocaleProvider locale="en-US">
            <Chart.Root
              data={[
                { name: "a", v: 1 },
                { name: "b", v: 2 },
              ]}
              config={{ v: { label: "V", color: "chart-1" } }}
              xKey="name"
              defaultActiveX="b"
              data-intro="none"
              aria-label="Hidden">
              <Chart.Bar dataKey="v" />
              <Chart.Tooltip />
            </Chart.Root>
          </LocaleProvider>
        </div>
      ));
      expect(popup()).toBeNull();
      return surface(host);
    });
    expect(shownFrames(mounted)).toEqual([]);
    const hidden = host.querySelector<HTMLElement>('[data-testid="hidden"]');
    if (hidden === null) throw new Error("no hidden wrapper");
    /** The popup's positioner box and bar B's box, on the first frame the popup paints. */
    const first = recordFrames(() => {
      const positioner = mountedPopup()?.parentElement;
      const bar = drawnBars(host)[1];
      return popupPaints() && positioner != null && bar !== undefined
        ? { placed: positioner.getBoundingClientRect(), bar: bar.getBoundingClientRect() }
        : null;
    }, popupPaints);
    hidden.style.display = "";
    const frame = (await first).at(-1);
    if (frame == null) throw new Error("no painted frame");
    expect(frame.placed.bottom).toBeCloseTo(frame.bar.top - 8, 0);
    expect((frame.placed.left + frame.placed.right) / 2).toBeCloseTo(
      (frame.bar.left + frame.bar.right) / 2,
      0
    );
    expect(label()).toBe("b");
  });

  it("opens the popup of a plot wider than twice a phone viewport once half the viewport's width of it shows", async () => {
    // A 950 px chart sits 800 px into a horizontal scroller at a 390 px viewport, so at most 41% of
    // its plot is ever in view. The oracle is the rule that a plot larger than the viewport on an
    // axis is in view once half the viewport's extent on that axis shows it: 195 px across here,
    // with the whole plot's height in view. The scroll positions come from the plot's box: 120 px
    // of it in view, then 300 px, then 120 px again.
    await page.viewport(390, 844);
    let host: HTMLElement = document.body;
    const mounted = await framesThroughReport(popupFrame, () => {
      ({ host } = renderThemed(
        <div data-testid="scroller" style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", width: 1750 }}>
            <div style={{ flex: "0 0 800px" }} />
            <div style={{ flex: "0 0 950px" }}>
              <LocaleProvider locale="en-US">
                <Chart.Root
                  data={["a", "b", "c", "d", "e", "f"].map((name, index) => ({ name, v: index + 1 }))}
                  config={{ v: { label: "V", color: "chart-1" } }}
                  xKey="name"
                  defaultActiveX="a"
                  aria-label="Wide">
                  <Chart.Bar dataKey="v" />
                  <Chart.Tooltip />
                </Chart.Root>
              </LocaleProvider>
            </div>
          </div>
        </div>
      ));
      expect(popup()).toBeNull();
      return surface(host);
    });
    expect(shownFrames(mounted)).toEqual([]);
    const scroller = host.querySelector<HTMLElement>('[data-testid="scroller"]');
    if (scroller === null) throw new Error("no scroller");
    const plot = surface(host);
    const { width, height } = plot.getBoundingClientRect();
    expect(width).toBeGreaterThan(2 * window.innerWidth);
    expect(height).toBeLessThan(window.innerHeight);
    /** Scrolls the scroller so `shown` px of the plot's left edge show at its right edge. */
    const reveal = (shown: number): void => {
      scroller.scrollLeft +=
        plot.getBoundingClientRect().left - (scroller.getBoundingClientRect().right - shown);
    };
    const revealed = await framesThroughReport(popupFrame, () => {
      reveal(120);
      return plot;
    });
    expect(shownFrames(revealed)).toEqual([]);
    reveal(300);
    await expect.poll(label).toBe("a");
    await expect.poll(popupPaints).toBe(true);
    // Back at 120 px the popup closes, so a cutoff under 120 px fails here even when its wrong open
    // is still transparent. A close because the plot left view paints no exit, so the popup stops
    // painting on the frame it closes.
    const closing = recordFrames(popupFrame, () => !popupFrame().open);
    reveal(120);
    expect((await closing).at(-1)).toEqual({ open: false, painted: false });
  });

  /** A chart 1,500 px down the page, with `b` active by default. */
  function BelowFold({ data }: { readonly data: readonly { readonly name: string; readonly v: number }[] }) {
    return (
      <>
        <div style={{ height: 1500 }} />
        <div style={{ width: 400 }}>
          <LocaleProvider locale="en-US">
            <Chart.Root
              data={data}
              config={{ v: { label: "V", color: "chart-1" } }}
              xKey="name"
              defaultActiveX="b"
              data-intro="none"
              aria-label="Below">
              <Chart.Bar dataKey="v" />
              <Chart.Tooltip />
            </Chart.Root>
          </LocaleProvider>
        </div>
        <div style={{ height: 1500 }} />
      </>
    );
  }

  it("keeps the popup of a default whose rows arrive below the fold closed, and opens it once the plot scrolls into view", async () => {
    // The chart mounts with no rows below a 700 px viewport, and rows that hold b arrive there. The
    // oracle is the rule that a default applies when its rows first arrive, and that its popup
    // shows only while the plot is in view.
    await page.viewport(800, 700);
    onTestFinished(() => {
      window.scrollTo(0, 0);
    });
    const { host, rerender } = renderThemed(<BelowFold data={[]} />);
    // Each frame records whether the popup is open, so one that opens and has not faded in yet counts.
    const arrived = await framesThroughReport(
      () => popup() !== null,
      () => {
        rerender(
          <BelowFold
            data={[
              { name: "a", v: 1 },
              { name: "b", v: 2 },
            ]}
          />
        );
        return surface(host);
      }
    );
    // Root writes the active source on data-active, "default" for the default slot.
    expect(host.querySelector('[data-slot="chart"]')?.getAttribute("data-active")).toBe("default");
    expect(arrived.filter(Boolean)).toEqual([]);
    surface(host).scrollIntoView({ block: "center" });
    await expect.poll(popupPaints).toBe(true);
    expect(label()).toBe("b");
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
    // The popup sits off the pointer's path, so a sweep never names an older slot. The oracle is
    // the slot under the pointer, by x alone.
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
// has them ActiveValue and TooltipTotal, and the center parts, Center, CenterValue, CenterName,
// CenterShare, CenterLabel and CenterMax, in custom tooltips over Chart, ClockChart, RadarChart,
// RadialChart and PieChart, and ScatterChart's own TooltipLabel and TooltipValue. Oracle: a
// closing tooltip keeps its place, width, lane and content until the popup has closed, so the popup's
// text, each swatch's series and each icon read on every frame from Escape until the popup has gone
// are the ones it showed open. Where the family has series, a non-default one has focus, and
// ActiveValue's fallback reading differs from the active one, so a reader that drops the held point
// shows on the first frame.
describe("a shut tooltip lets go of its point", () => {
  /** Two series in one stack, each with an icon, so every series part has something to show. */
  const SERIES = {
    heating: { label: "Oppvarming", color: "chart-1", stack: "use", icon: <svg data-icon="heating" /> },
    water: { label: "Varmtvann", color: "chart-2", stack: "use", icon: <svg data-icon="water" /> },
  } satisfies ChartConfig;

  /** The tooltip popup, portaled out of the host. */
  function popupNode(): HTMLElement | null {
    // The popup is aria-hidden and portaled, read by its slot.
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
    const recorded = recordFrames(
      () => ({
        print: fingerprint(open),
        shown: visible(open),
        closing: visible(open) && !open.hasAttribute("data-open"),
      }),
      () => !visible(open)
    );
    await userEvent.keyboard("{Escape}");
    const frames = await recorded;
    expect(visible(open)).toBe(false);
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

// Unit under test: the `--surface` the frosted popup states. Oracle: #553's rule that a translucent
// fill keeps the surface beneath it, here the surface of the element the popup portals into.
// Branded light paints its page in a tint and its popover white, so the two read apart.
describe("the frosted tooltip", () => {
  restoreDocumentThemeAroundEach();

  it("keeps the surface beneath its translucent fill", async () => {
    renderIn(
      fkasBranded,
      "light",
      <div style={{ width: 400 }}>
        <Chart.Root
          data={[
            { name: "a", v: 1 },
            { name: "b", v: 2 },
          ]}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          defaultActiveX="b"
          aria-label="Frosted">
          <Chart.Bar dataKey="v" />
          <Chart.Tooltip variant="frosted" />
        </Chart.Root>
      </div>
    );
    // The popup opens once the plot's first in-view report lands.
    await expect.poll(popup).not.toBeNull();
    await settle();
    const open = openPopup();
    const beneath = open.parentElement;
    if (beneath === null) throw new Error("expected the popup's portal container");
    expect(srgb(surfaceAt(beneath))).not.toEqual(srgb(cssVarColor(open, "--popover")));
    expect(srgb(surfaceAt(open))).toEqual(srgb(surfaceAt(beneath)));
  });
});

describe("the tooltip in a frame that navigates", () => {
  it("unmounts without an error after the frame that showed a chart with a default item navigates to another origin", async () => {
    const navigate = navigableFrame();
    const first = await navigate(SAME_ORIGIN);
    // The frame's document takes the page's stylesheets, so the plot has the box the chart lays out.
    await adoptPageStyles(first);
    const chart = frameRoot(first);
    // The plot sits below the frame's fold, so the default item's popup stays shut while the chart
    // watches whether the plot comes into view. The scope is the frame's, so the popup would portal
    // into the frame's document.
    const popupMounted = await framesThroughReport(
      () => first.document.querySelector('[data-slot="chart-tooltip"]') !== null,
      () => {
        chart.render(
          <ThemeScope theme={fkasPrivate} style={{ width: 280, paddingTop: 1000 }}>
            <LocaleProvider locale="en-US">
              <Chart.Root
                data={[
                  { name: "a", v: 1 },
                  { name: "b", v: 2 },
                ]}
                config={{ v: { label: "V", color: "chart-1" } }}
                xKey="name"
                defaultActiveX="b"
                aria-label="Framed">
                <Chart.Bar dataKey="v" />
                <Chart.Tooltip />
              </Chart.Root>
            </LocaleProvider>
          </ThemeScope>
        );
        const plot = first.document.querySelector('[role="listbox"]');
        if (plot === null) throw new Error("expected the plot in the frame");
        const box = plot.getBoundingClientRect();
        expect(box.width * box.height, "the plot's area").toBeGreaterThan(0);
        expect(box.top, "the plot's top, against the frame's height").toBeGreaterThanOrEqual(
          first.innerHeight
        );
        return plot;
      }
    );
    // The Root writes the active source on data-active, "default" for the default slot.
    expect(first.document.querySelector('[data-slot="chart"]')?.getAttribute("data-active")).toBe("default");
    expect(popupMounted, "frames with the popup mounted, through the plot's in-view report").not.toContain(
      true
    );
    // As the document leaves its frame, a resize requests the frame that observes the plot again.
    // The leaving document never runs that frame, so the watch still holds its id at the unmount.
    const requestAnimationFrame = vi.spyOn(first, "requestAnimationFrame");
    first.addEventListener(
      "pagehide",
      () => {
        requestAnimationFrame.mockClear();
        first.dispatchEvent(new Event("resize"));
      },
      { once: true }
    );
    await navigate(CROSS_ORIGIN);
    expect(requestAnimationFrame, "frames the resize requested").toHaveBeenCalledOnce();
    chart.unmount();
    expect(chart.uncaught, "errors thrown by the chart's cleanup").toEqual([]);
  });

  it("cancels a glide still running when the glider stops watching after the frame that showed the popup navigates to another origin", async () => {
    // Base UI's positioner runs cleanup of its own that throws after a cross-origin navigation
    // (#1134), so the glider runs on a positioner of the test's own, which only the glider's
    // cleanup touches.
    const navigate = navigableFrame();
    const first = await navigate(SAME_ORIGIN);
    const positioner = first.document.createElement("div");
    positioner.style.setProperty("--_glide", "1000ms");
    positioner.style.transform = "translate(0px, 0px)";
    first.document.body.append(positioner);
    const glider = createTooltipGlider(positioner, null);
    glider.arm(() => ({ kind: "straight" }));
    // Observers hear a mutation in the order they were created, so this one, created after the
    // glider's, hears the write once the glider has started the glide.
    const heard = new Promise<void>((resolve) => {
      new MutationObserver((_, observer) => {
        observer.disconnect();
        resolve();
      }).observe(positioner, { attributes: true, attributeFilter: ["style"] });
    });
    // The next place written after an arming glides there.
    positioner.style.transform = "translate(100px, 0px)";
    await heard;
    const [glide, ...others] = positioner.getAnimations();
    if (glide === undefined || others.length > 0) throw new Error("expected the positioner's glide");
    // Paused before anything renders, the glide stays unfinished however long the navigation takes.
    glide.pause();
    await navigate(CROSS_ORIGIN);
    expect(() => glider.dispose(), "the glider's dispose").not.toThrow();
    expect(glide.playState, "the glide after the dispose").toBe("idle");
  });
});
