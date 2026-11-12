// LiveLineChart in Chromium. Unit under test: the whole path from Root's readings to the drawn
// line, the live dot, the badge, the keyboard walk, the pointer pick, the crosshair, the tooltip,
// the table, pausing and reduced motion. The server HTML is apps/docs' RSC fixture's. Oracles: pixels worked out by hand on a 300 by 124 px plot whose
// 30 s window ends at the latest of three readings, 0 at 14:00:00, 50 at 14:00:10 and 100 at
// 14:00:20 Oslo time, which sit at 100, 200 and 300 px across, and whose domain [−12, 112] puts a
// value v at 112 − v px from the top; and names, sentences and rows written by hand.
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { pointerAt } from "../../../test/chart/marks";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { LiveLineChart } from "./live-line-chart-namespace";
import type { LiveLineChartPoint, LiveLineChartRootProps } from "./live-line-chart-root";

/** 14:00:00 in Oslo on 16 October 2026, under summer time. */
const NOON = Date.UTC(2026, 9, 16, 12);
const SECOND = 1_000;

const READINGS: readonly LiveLineChartPoint[] = [
  { time: NOON, value: 0 },
  { time: new Date(NOON + 10 * SECOND), value: 50 },
  { time: NOON + 20 * SECOND, value: 100 },
];

/** A chart with no axes, so its plot is the whole 300 by 124 px frame. */
function Live({
  data = READINGS,
  value,
  paused = true,
  children,
}: {
  readonly data?: readonly LiveLineChartPoint[];
  readonly value?: number;
  readonly paused?: boolean;
  readonly children?: ReactNode;
}): ReactNode {
  // Root's value is left out unless the case passes one.
  const latest: Pick<LiveLineChartRootProps, "value"> = {};
  if (value !== undefined) latest.value = value;
  return (
    <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
      <button type="button">før</button>
      <div style={{ width: 300 }}>
        <LiveLineChart.Root
          data={data}
          {...latest}
          windowMs={30 * SECOND}
          label="Pris"
          valueFormat={{ maximumFractionDigits: 0 }}
          paused={paused}
          aria-label="Spotpris nå"
          style={{ "--chart-plot-height": "124px" }}>
          {children ?? (
            <>
              <LiveLineChart.Line curve="linear" />
              <LiveLineChart.LiveDot />
              <LiveLineChart.Crosshair />
              <LiveLineChart.Tooltip />
              <LiveLineChart.Table />
            </>
          )}
        </LiveLineChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The line's `d`. The line is aria-hidden plot output, so its slot is the only locator. */
function lineD(host: HTMLElement): string | null {
  return host.querySelector('[data-slot="live-line-chart-line-path"]')?.getAttribute("d") ?? null;
}

/** The live dot's place. The dot is aria-hidden plot output, so its slot is the only locator. */
function dotAt(host: HTMLElement): string | null {
  return host.querySelector('[data-slot="live-line-chart-live-dot"] > g')?.getAttribute("transform") ?? null;
}

/** The crosshair's place, or null while it hides. It is aria-hidden plot output, so its slot locates it. */
function crosshairAt(host: HTMLElement): string | null {
  const group = host.querySelector('[data-slot="live-line-chart-crosshair"] > g');
  return group === null || group.hasAttribute("data-hidden") ? null : group.getAttribute("transform");
}

/** The tooltip's text, or null while it is closed. The popup is aria-hidden, so its slot locates it. */
function tooltipText(host: HTMLElement): string | null {
  return (
    host.querySelector('[data-slot="live-line-chart-tooltip"] [data-slot="chart-tooltip"]')?.textContent ??
    null
  );
}

/** The focused option's name, position and set size. */
function focused(): readonly [string | null, string | null, string | null] {
  const element = document.activeElement;
  return [
    element?.getAttribute("aria-label") ?? null,
    element?.getAttribute("aria-posinset") ?? null,
    element?.getAttribute("aria-setsize") ?? null,
  ];
}

afterEach(async () => {
  await emulateReducedMotion("no-preference");
});

describe("LiveLineChart Root", () => {
  it("draws the window's readings and puts the live dot on the right edge at the latest value", async () => {
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).toBe("M100,112L200,62L300,12");
    expect(dotAt(host)).toBe("translate(300 12)");
  });

  it("throws a composition error for a chart with no zone", () => {
    renderThemed(
      <CaughtError>
        <LocaleProvider locale="nb-NO">
          <LiveLineChart.Root data={READINGS} aria-label="Spotpris nå" />
        </LocaleProvider>
      </CaughtError>
    );
    expect(caughtError().message).toContain("time zone");
  });

  it("throws a composition error for a window that is not a positive length", () => {
    renderThemed(
      <CaughtError>
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <LiveLineChart.Root data={READINGS} windowMs={0} aria-label="Spotpris nå" />
        </LocaleProvider>
      </CaughtError>
    );
    expect(caughtError().message).toContain("received windowMs 0");
  });
});

describe("the line", () => {
  /** The device rows the screenshot paints in one column, as an opaque-ish mark paints them. */
  async function paintedRows(host: HTMLElement, column: number): Promise<number> {
    const shot = await page.screenshot({ element: host, save: false });
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${shot}`)).blob());
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    if (context === null) return Number.NaN;
    context.drawImage(image, 0, 0);
    const scale = image.width / host.offsetWidth;
    const { data } = context.getImageData(Math.round(column * scale), 0, 1, image.height);
    let rows = 0;
    // A row the line paints is far from the white page: its red channel drops below half.
    for (let row = 0; row < image.height; row += 1) if ((data[row * 4] ?? 255) < 128) rows += 1;
    return rows / scale;
  }

  it("keeps a line along the plot's top edge whole, its stroke half above the edge", async () => {
    // The clock widens the domain to a value at once, so for a frame the line can run along the
    // edge. Draw that frame: a 2 px stroke centred on y = 0 paints 2 px, not the 1 px inside.
    const { host } = renderThemed(
      <Live>
        <LiveLineChart.Line curve="linear" />
      </Live>
    );
    await expect.poll(() => lineD(host)).not.toBeNull();
    host.querySelector('[data-slot="live-line-chart-line-path"]')?.setAttribute("d", "M0,0L300,0");
    expect(await paintedRows(host, 150)).toBe(2);
  });
});

describe("the readout", () => {
  async function enterChart(): Promise<void> {
    await userEvent.click(page.getByRole("button", { name: "før" }));
    await userEvent.keyboard("{Tab}");
  }

  it("walks the window's readings from the latest, with the tooltip on the walked one", async () => {
    const { host } = renderThemed(<Live />);
    await enterChart();
    expect(roleNamed("listbox", "Spotpris nå, datapunkter")).not.toBeNull();
    expect(focused()).toEqual(["kl. 14:00:20, Pris: 100", "3", "3"]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toEqual(["kl. 14:00:10, Pris: 50", "2", "3"]);
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    // The paused chart runs no frame, and the step still draws the crosshair on the reading.
    expect(crosshairAt(host)).toBe("translate(200 62)");
    await userEvent.keyboard("{Home}");
    expect(focused()[1]).toBe("1");
    // The walk stops at its ends.
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()[1]).toBe("1");
    await userEvent.keyboard("{End}");
    expect(focused()[1]).toBe("3");
    expect(page.getByRole("option").all()).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => tooltipText(host)).toBeNull();
  });

  it("puts the latest reading's crosshair and option where the line ends, on Root's value", async () => {
    // A paused chart ends at the latest reading, which draws at Root's 200: the domain fits [0, 200]
    // as [−24, 224], so 200 sits (224 − 200) / 2 = 12 px down, at the right edge.
    const { host } = renderThemed(<Live value={200} />);
    await enterChart();
    expect(focused()[1]).toBe("3");
    await userEvent.keyboard("{End}");
    expect(crosshairAt(host)).toBe("translate(300 12)");
    expect(dotAt(host)).toBe("translate(300 12)");
    const option = page.getByRole("option").element();
    const optionY = option instanceof HTMLElement ? option.style.getPropertyValue("--chart-option-y") : "";
    expect(Number.parseFloat(optionY)).toBeCloseTo(12, 6);
  });

  it("stops the crosshair's glide on its reading once reduced motion turns on mid-glide", async () => {
    const { host } = renderThemed(<Live />);
    await enterChart();
    await userEvent.keyboard("{ArrowLeft}");
    const group = host.querySelector('[data-slot="live-line-chart-crosshair"] > g');
    // The step glides from 300 px to the reading at 200 px; hold it mid-way so it outlives the switch.
    const glides = group?.getAnimations() ?? [];
    expect(glides.length).toBeGreaterThan(0);
    for (const glide of glides) glide.pause();
    await emulateReducedMotion("reduce");
    await expect.poll(() => group?.getAnimations().length).toBe(0);
    // With no glide left, the crosshair shows its resting place: 50 sits 112 − 50 = 62 px down.
    expect(crosshairAt(host)).toBe("translate(200 62)");
    expect(group === null ? null : getComputedStyle(group).translate).toBe("none");
  });

  it("names what a paused plot shows while the feed moves on and drops the shown readings", async () => {
    const { host, rerender } = renderThemed(
      <Live>
        <LiveLineChart.Line curve="linear" />
        <LiveLineChart.Badge />
        <LiveLineChart.Tooltip />
      </Live>
    );
    await enterChart();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    const held = lineD(host);
    expect(held).not.toBeNull();
    // The feed moves a minute on, and no reading the paused plot shows is left in it.
    rerender(
      <Live data={[{ time: NOON + 80 * SECOND, value: 7 }]}>
        <LiveLineChart.Line curve="linear" />
        <LiveLineChart.Badge />
        <LiveLineChart.Tooltip />
      </Live>
    );
    expect(lineD(host)).toBe(held);
    expect(tooltipText(host)).toBe("14:00:10Pris50");
    expect(focused()).toEqual(["kl.\u00a014:00:10, Pris: 50", "2", "3"]);
    const badge = host.querySelector('[data-slot="live-line-chart-badge"] [data-slot="chart-axis-sizer"]');
    expect(badge?.textContent).toBe("100");
  });

  it("picks the reading nearest the pointer and lets go when the pointer leaves", async () => {
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = roleNamed("listbox", "Spotpris nå, datapunkter").getBoundingClientRect();
    // 190 px across sits nearest the reading at 200 px.
    await pointerAt(box.left + 190, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    await pointerAt(box.left + 110, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:00Pris0");
    await userEvent.hover(page.getByRole("button", { name: "før" }));
    await expect.poll(() => tooltipText(host)).toBeNull();
  });

  it("lists the window's readings newest first in the table", async () => {
    renderThemed(<Live />);
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    const table = roleNamed("table", "Spotpris nå, 3 punkter");
    const rows = [...table.querySelectorAll("tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent)
    );
    // Each time cell shows the clock and speaks it with "kl.".
    expect(rows).toEqual([
      ["14:00:20kl. 14:00:20", "100"],
      ["14:00:10kl. 14:00:10", "50"],
      ["14:00:00kl. 14:00:00", "0"],
    ]);
  });
});

describe("live motion", () => {
  /** Three readings that end now, so the window that ends at the clock shows them. */
  function recentReadings(): LiveLineChartPoint[] {
    const now = Date.now();
    return [
      { time: now - 20 * SECOND, value: 0 },
      { time: now - 10 * SECOND, value: 50 },
      { time: now, value: 100 },
    ];
  }

  it("scrolls the window with the clock, every frame, under StrictMode's remount too", async () => {
    const { host } = renderThemed(<Live data={recentReadings()} paused={false} />, { strictMode: true });
    await expect.poll(() => lineD(host)).not.toBeNull();
    const first = lineD(host);
    // A 30 s window over 300 px moves a pixel every 100 ms.
    await expect.poll(() => lineD(host)).not.toBe(first);
  });

  it("badges the latest value, and Root's value wins over the latest reading", async () => {
    const readings = recentReadings();
    const { host, rerender } = renderThemed(
      <Live data={readings} paused={false}>
        <LiveLineChart.Badge />
      </Live>
    );
    // The badge is aria-hidden; its sizer holds the plain text the rolling digits show.
    const badge = () =>
      host.querySelector('[data-slot="live-line-chart-badge"] [data-slot="chart-axis-sizer"]')?.textContent;
    await expect.poll(badge).toBe("100");
    rerender(
      <Live data={readings} value={87} paused={false}>
        <LiveLineChart.Badge />
      </Live>
    );
    await expect.poll(badge).toBe("87");
  });

  it("moves nothing under reduced motion: a new reading redraws once, at rest, and the ping stops", async () => {
    await emulateReducedMotion("reduce");
    const readings = recentReadings();
    const { host, rerender } = renderThemed(<Live data={readings} paused={false} />);
    await expect.poll(() => dotAt(host)).toBe("translate(300 12)");
    const still = lineD(host);
    await nextFrames(10);
    expect(lineD(host)).toBe(still);
    const ping = host.querySelector('[data-slot="live-line-chart-live-dot"] [data-part="ping"]');
    expect(ping === null ? null : getComputedStyle(ping).animationName).toBe("none");
    // A reading of 50 a moment later keeps the domain [−12, 112], and the dot lands at once.
    const latest = readings.at(-1);
    rerender(
      <Live data={[...readings, { time: Number(latest?.time ?? 0) + 1, value: 50 }]} paused={false} />
    );
    expect(dotAt(host)).toBe("translate(300 62)");
  });

  it("glides the live dot to a new value with motion on, from where it showed", async () => {
    const readings = recentReadings();
    const { host, rerender } = renderThemed(<Live data={readings} paused={false} />);
    await expect.poll(() => dotAt(host)).toBe("translate(300 12)");
    const latest = readings.at(-1);
    rerender(
      <Live data={[...readings, { time: Number(latest?.time ?? 0) + 1, value: 50 }]} paused={false} />
    );
    // The commit that brings the reading draws nothing new: the glide starts in the next frame.
    expect(dotAt(host)).toBe("translate(300 12)");
    await expect.poll(() => dotAt(host)).toBe("translate(300 62)");
  });
});
