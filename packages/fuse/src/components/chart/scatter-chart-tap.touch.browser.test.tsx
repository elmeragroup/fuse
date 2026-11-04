// Real taps through Playwright's touchscreen in Chromium, after the scatter pointer rules: a tap pins
// the nearest point within the coarse hit radius, a second tap on it dismisses the tooltip, a third
// opens it again, and a tap on empty plot dismisses a pinned tooltip. Oracle: points placed by hand
// on a 200 by 140 px plot over x [−2, 18] and y [20 000, 160 000], where now(2, 90 000) sits at
// (40, 70) and normal(18, 160 000) at (200, 0).
import { describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { popupOpen, surfaceBox } from "../../../test/chart/marks";
import "../../../test/pointer-press";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  normal: { label: "Normalforbruk", color: "chart-2" },
} as const satisfies ChartConfig;

const ROWS = [
  { t: -2, kwh: 20_000, s: "now" },
  { t: 2, kwh: 90_000, s: "now" },
  { t: 18, kwh: 160_000, s: "normal" },
];

function TapChart() {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 200, marginTop: 200 }}>
        <ScatterChart.Root
          data={ROWS}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          aria-label="Forbruk mot temperatur"
          style={{ "--chart-plot-height": "140px" }}>
          <ScatterChart.Points dataKey="now" />
          <ScatterChart.Points dataKey="normal" />
          <ScatterChart.Tooltip />
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** A point on the plot, in plot pixels from its top left, as client pixels. */
function at(host: HTMLElement, x: number, y: number): readonly [number, number] {
  const box = surfaceBox(host);
  return [box.left + x, box.top + y];
}

async function tap(point: readonly [number, number]): Promise<void> {
  await commands.tap(point[0], point[1]);
  await nextFrames(2);
}

function label(): string | null {
  // DOM audit: the tooltip portals out of the host, and its label slot names the active series.
  return document.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
}

describe("taps", () => {
  it("pin the nearest point, dismiss on a second tap and open again on a third", async () => {
    const { host } = renderThemed(<TapChart />);
    // 28 px left of now(2, 90 000): past the 24 px mouse radius, inside the 32 px touch radius.
    const point = at(host, 12, 70);
    await tap(point);
    await expect.poll(label).toBe("Forbruk 2026");
    await tap(point);
    await expect.poll(popupOpen).toBe(false);
    await tap(point);
    await expect.poll(popupOpen).toBe(true);
  });

  it("move a pin to another point, and dismiss it on empty plot", async () => {
    const { host } = renderThemed(<TapChart />);
    await tap(at(host, 40, 70));
    await expect.poll(label).toBe("Forbruk 2026");
    await tap(at(host, 196, 4));
    await expect.poll(label).toBe("Normalforbruk");
    // (120, 70) lies more than 32 px from every point.
    await tap(at(host, 120, 70));
    await expect.poll(popupOpen).toBe(false);
  });
});

describe("a tap over a pinned popup", () => {
  // now(2, 90 000) sits at (40, 70) and normal(2, 140 000) at (40, 20), 50 px above it, past the
  // 32 px touch radius. A's popup rests above A, over B.
  const rows = [...ROWS, { t: 2, kwh: 140_000, s: "normal" }];

  function TwoPoints() {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200, marginTop: 200 }}>
          <ScatterChart.Root
            data={rows}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Forbruk mot temperatur"
            style={{ "--chart-plot-height": "140px" }}>
            <ScatterChart.Points dataKey="now" />
            <ScatterChart.Points dataKey="normal" />
            <ScatterChart.Tooltip />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** Whether B's client point lies inside A's popup, so a tap there meets the popup first. */
  function popupCovers(point: readonly [number, number]): boolean {
    // DOM audit: the popup portals out of the host, so its slot locates it.
    const popup =
      document.querySelector('[data-slot="chart-tooltip"]')?.getBoundingClientRect() ?? new DOMRect();
    return point[0] > popup.left && point[0] < popup.right && point[1] > popup.top && point[1] < popup.bottom;
  }

  it("reaches the point under the popup, which the tap pins in its place", async () => {
    const { host } = renderThemed(<TwoPoints />);
    await tap(at(host, 40, 70));
    await expect.poll(label).toBe("Forbruk 2026");
    expect(popupCovers(at(host, 40, 20))).toBe(true);
    await tap(at(host, 40, 20));
    await expect.poll(label).toBe("Normalforbruk");
  });

  it("reaches the point under the popup after a mouse click pinned the first", async () => {
    const { host } = renderThemed(<TwoPoints />);
    await userEvent.click(page.getByRole("listbox"), { position: { x: 40, y: 70 } });
    await expect.poll(label).toBe("Forbruk 2026");
    expect(popupCovers(at(host, 40, 20))).toBe(true);
    await tap(at(host, 40, 20));
    await expect.poll(label).toBe("Normalforbruk");
  });

  it("reaches the point under the popup after a mouse hover and a tap on the first", async () => {
    // The hover makes A active under the mouse, and the tap on A keeps the same point active.
    const { host } = renderThemed(<TwoPoints />);
    await userEvent.hover(page.getByRole("listbox"), { position: { x: 40, y: 70 } });
    await expect.poll(label).toBe("Forbruk 2026");
    await tap(at(host, 40, 70));
    await expect.poll(label).toBe("Forbruk 2026");
    await expect.poll(() => popupCovers(at(host, 40, 20))).toBe(true);
    await tap(at(host, 40, 20));
    await expect.poll(label).toBe("Normalforbruk");
  });
});

describe("a touch held across a data update", () => {
  type Row = { readonly t: number; readonly kwh: number; readonly s: string };

  /** A chart of the rows on a 200 by 140 px plot, which a test renders again with new rows. */
  function Held({ data }: { readonly data: readonly Row[] }) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200, marginTop: 200 }}>
          <ScatterChart.Root
            data={data}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Forbruk mot temperatur"
            style={{ "--chart-plot-height": "140px" }}>
            <ScatterChart.Points dataKey="now" />
            <ScatterChart.Points dataKey="normal" />
            <ScatterChart.Tooltip />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  async function frames(): Promise<void> {
    await nextFrames(2);
  }

  it("lifts on the pinned point after a row before it is removed, and the chart stays", async () => {
    // now(−2, 20 000) at (0, 140), now(8, 90 000) at (100, 70) and now(18, 160 000) at (200, 0).
    // Removing the middle row keeps both domains, so the last point stays at (200, 0), id 1.
    const first = { t: -2, kwh: 20_000, s: "now" };
    const last = { t: 18, kwh: 160_000, s: "now" };
    const { host, rerender } = renderThemed(<Held data={[first, { t: 8, kwh: 90_000, s: "now" }, last]} />);
    await tap(at(host, 199, 1));
    await expect.poll(label).toBe("Forbruk 2026");
    const [x, y] = at(host, 199, 1);
    await commands.touchStart(x, y);
    rerender(<Held data={[first, last]} />);
    await commands.touchEnd();
    await frames();
    // The lift lands on the pinned point, which takes the one dismissal, and the chart is still there.
    expect(host.querySelector('[role="listbox"]')).not.toBeNull();
    await expect.poll(popupOpen).toBe(false);
  });

  it("lifts where another series' point was before its row was removed, and the chart stays", async () => {
    // A is now(−2, 20 000) at (0, 140) and now(8, 90 000) at (100, 70), B is normal(18, 160 000)
    // at (200, 0). Removing B leaves no point under the finger.
    const rows = [
      { t: -2, kwh: 20_000, s: "now" },
      { t: 8, kwh: 90_000, s: "now" },
      { t: 18, kwh: 160_000, s: "normal" },
    ];
    const { host, rerender } = renderThemed(<Held data={rows} />);
    await tap(at(host, 100, 70));
    await expect.poll(label).toBe("Forbruk 2026");
    const [x, y] = at(host, 199, 1);
    await commands.touchStart(x, y);
    rerender(<Held data={rows.slice(0, 2)} />);
    await commands.touchEnd();
    await frames();
    expect(host.querySelector('[role="listbox"]')).not.toBeNull();
    await expect.poll(popupOpen).toBe(false);
  });

  it("lifts on empty plot after the point under an unpinned finger moved away, and pins nothing", async () => {
    // now(8, 90 000) sits under the finger at (100, 70). Replacing it with now(16, 34 000), at
    // (180, 126), keeps both domains, and the active point carries to it, about 98 px from the
    // finger, past the 32 px touch radius.
    const first = { t: -2, kwh: 20_000, s: "now" };
    const last = { t: 18, kwh: 160_000, s: "now" };
    const { host, rerender } = renderThemed(<Held data={[first, { t: 8, kwh: 90_000, s: "now" }, last]} />);
    const [x, y] = at(host, 100, 70);
    await commands.touchStart(x, y);
    await frames();
    await expect.poll(label).toBe("Forbruk 2026");
    rerender(<Held data={[first, { t: 16, kwh: 34_000, s: "now" }, last]} />);
    await commands.touchEnd();
    await frames();
    await expect.poll(popupOpen).toBe(false);
    // DOM audit: the surface carries the pin state, which no role exposes.
    expect(host.querySelector('[data-slot="chart-surface"]')?.hasAttribute("data-pinned")).toBe(false);
  });
});

describe("a mouse after a touch", () => {
  it("hovers a point's popup as a mouse does once the mouse moves", async () => {
    // Tap A, dismiss with a tap on empty plot, then hover B with the mouse: B's popup takes the
    // pointer again, so it can be hovered.
    const rows = [...ROWS, { t: 2, kwh: 140_000, s: "normal" }];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200, marginTop: 200 }}>
          <ScatterChart.Root
            data={rows}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Forbruk mot temperatur"
            style={{ "--chart-plot-height": "140px" }}>
            <ScatterChart.Points dataKey="now" />
            <ScatterChart.Points dataKey="normal" />
            <ScatterChart.Tooltip />
          </ScatterChart.Root>
        </div>
      </LocaleProvider>
    );
    await tap(at(host, 40, 70));
    await expect.poll(label).toBe("Forbruk 2026");
    await tap(at(host, 120, 70));
    await expect.poll(popupOpen).toBe(false);
    // A closing popup may still cover the plot, so the hover skips Playwright's visibility wait.
    await userEvent.hover(page.getByRole("listbox"), { position: { x: 199, y: 1 }, force: true });
    await expect.poll(label).toBe("Normalforbruk");
    // DOM audit: the popup portals out of the host, so its slot locates it.
    const popup = document.querySelector('[data-slot="chart-tooltip"]');
    expect(popup?.getAttribute("data-input")).toBeNull();
    expect(popup === null ? null : getComputedStyle(popup).pointerEvents).toBe("auto");
  });
});

describe("focus after a tap", () => {
  it("leaves with Tab and enters again with Shift+Tab as a keyboard does", async () => {
    // now(−2, 20 000), at (0, 140), is the walk's first point, where the plot's option lies, so
    // the tap focuses the option and pins the point.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 200, marginTop: 200 }}>
          <ScatterChart.Root
            data={ROWS}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Forbruk mot temperatur"
            style={{ "--chart-plot-height": "140px" }}>
            <ScatterChart.Points dataKey="now" />
            <ScatterChart.Points dataKey="normal" />
            <ScatterChart.Tooltip />
          </ScatterChart.Root>
        </div>
        <button type="button">etter</button>
      </LocaleProvider>
    );
    await tap(at(host, 1, 139));
    await expect.poll(label).toBe("Forbruk 2026");
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.textContent).toBe("etter");
    await expect.poll(popupOpen).toBe(false);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    await expect.poll(label).toBe("Forbruk 2026");
  });
});

describe("focus after a gesture with no click", () => {
  type Row = { readonly t: number; readonly kwh: number; readonly s: string };

  /** A chart between two buttons, on a 200 by 140 px plot, which a test renders again with new rows. */
  function Between({ data }: { readonly data: readonly Row[] }) {
    return (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 200, marginTop: 200 }}>
          <ScatterChart.Root
            data={data}
            config={CONFIG}
            xKey="t"
            yKey="kwh"
            seriesKey="s"
            aria-label="Forbruk mot temperatur"
            style={{ "--chart-plot-height": "140px" }}>
            <ScatterChart.Points dataKey="now" />
            <ScatterChart.Points dataKey="normal" />
            <ScatterChart.Tooltip />
          </ScatterChart.Root>
        </div>
        <button type="button">etter</button>
      </LocaleProvider>
    );
  }

  async function frames(): Promise<void> {
    await nextFrames(2);
  }

  /** Tab in from the button before the chart, onto the plot's option. */
  async function tabIn(): Promise<void> {
    page.getByRole("button", { name: "før" }).element().focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("role")).toBe("option");
  }

  it("leaves with Tab and enters with Shift+Tab as a keyboard does after a scrub", async () => {
    // now(−2, 20 000) at (0, 140), now(8, 20 000) at (100, 140) and normal(18, 160 000) at
    // (200, 0). The finger lands on the first, scrubs along the bottom to the second and lifts
    // there, which pins it, and a scrub that far sends no click.
    const { host } = renderThemed(
      <Between
        data={[
          { t: -2, kwh: 20_000, s: "now" },
          { t: 8, kwh: 20_000, s: "now" },
          { t: 18, kwh: 160_000, s: "normal" },
        ]}
      />
    );
    await tabIn();
    const [x, y] = at(host, 2, 138);
    await commands.touchStart(x, y);
    for (const step of [25, 50, 75, 98]) await commands.touchMove(...at(host, step, 138));
    await commands.touchEnd();
    await frames();
    // DOM audit: the surface carries the pin state, which no role exposes.
    const surface = () => host.querySelector('[data-slot="chart-surface"]');
    await expect.poll(() => surface()?.hasAttribute("data-pinned")).toBe(true);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.textContent).toBe("etter");
    await expect.poll(popupOpen).toBe(false);
    expect(surface()?.hasAttribute("data-pinned")).toBe(false);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    await expect.poll(popupOpen).toBe(true);
  });

  it("enters with Tab as a keyboard does after the data emptied under a held finger and came back", async () => {
    const { host, rerender } = renderThemed(<Between data={ROWS} />);
    // now(2, 90 000) sits at (40, 70).
    const [x, y] = at(host, 40, 70);
    await commands.touchStart(x, y);
    await frames();
    await expect.poll(label).toBe("Forbruk 2026");
    rerender(<Between data={[]} />);
    await commands.touchEnd();
    await frames();
    rerender(<Between data={ROWS} />);
    await frames();
    await tabIn();
    await expect.poll(popupOpen).toBe(true);
  });
});
