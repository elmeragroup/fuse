// WCAG 1.4.13 for the chart tooltip, rows T043 and T044, in Chromium. The
// sequence and its outcomes come from CONTRACT section 9.12, and every expected label is written
// by hand from the committed Elhub rows.
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { S06Chart } from "../../../test/chart/bar-charts";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

afterEach(async () => {
  await page.viewport(1024, 768);
});

/** Wait for two animation frames and the popup's open fade, so Base UI has placed it. */
async function settle(): Promise<void> {
  for (let frame = 0; frame < 2; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  // DOM audit: the popup portals to the theme scope container, outside the render host.
  const open = document.querySelector('[data-slot="chart-tooltip"]');
  await Promise.all(open?.getAnimations({ subtree: true }).map((animation) => animation.finished) ?? []);
}

/** The tooltip popup, which portals out of the chart. */
function popup(): HTMLElement | null {
  // DOM audit: the popup portals to the theme scope container, outside the render host.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
}

/** The popup's slot label. */
function label(): string | null {
  return popup()?.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
}

/** The plot surface's client box. */
function surfaceBox(host: HTMLElement): DOMRect {
  return host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
}

/**
 * Move the pointer to a point in client coordinates, over the element at that point, as a hand
 * does. The move does not wait for that element to be Playwright's hit target, because a popup
 * that follows the slot may move between the hit check and the move.
 */
async function pointerTo(x: number, y: number): Promise<void> {
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof Element)) throw new Error(`nothing at ${String(x)}, ${String(y)}`);
  const box = target.getBoundingClientRect();
  await userEvent.hover(target, { position: { x: x - box.left, y: y - box.top }, force: true });
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
    // Leaving the plot and the popup closes it.
    await pointerTo(4, 4);
    // Base UI keeps the popup until its fade ends.
    await expect.poll(popup).toBeNull();
  });

  it("closes on Escape with the pointer still, and stays closed until the slot changes", async () => {
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("05–06");
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.85);
    expect(popup()).toBeNull();
    await pointerTo(plot.left + slotWidth * 6.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("06–07");
  });

  it("reopens on the dismissed slot after the pointer leaves the plot and comes back", async () => {
    // jc14: after Escape, a pointer that left the plot and returned to the same slot never
    // reopened the popup, which fails 1.4.13's sequence at the 320 px reflow width.
    await page.viewport(width, 768);
    const { host } = chart();
    const plot = surfaceBox(host);
    const slotWidth = plot.width / 24;
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    await userEvent.keyboard("{Escape}");
    await expect.poll(popup).toBeNull();
    await pointerTo(4, 4);
    await pointerTo(plot.left + slotWidth * 5.5, plot.top + plot.height * 0.9);
    expect(label()).toBe("05–06");
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
    // DOM audit: the popup portals out of the host, and its value slot holds the reading.
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
    // DOM audit: bars are aria-hidden plot output.
    const bars = [...host.querySelectorAll('[data-slot="chart-bar"]')];
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

describe.each([
  ["at 1280 px", 1280],
  ["at 320 px", 320],
])("the popup's own column %s", (_, width) => {
  afterEach(async () => {
    await page.viewport(414, 896);
  });

  it.each(["point", "top"] as const)("is never covered with anchor %s", async (anchor) => {
    // js16 and jc9: on a tall column the popup fit neither above nor below inside the root and
    // sat over the bar it read. Every column here reaches the plot top, the hardest case.
    await page.viewport(width, 720);
    const { host } = renderThemed(
      <div style={{ padding: "24px", width: "100%", boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={["a", "b", "c", "d"].map((name) => ({ name, v: 4 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Tall">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip anchor={anchor} />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = surfaceBox(host);
    // DOM audit: bars are aria-hidden plot output.
    const bars = [...host.querySelectorAll('[data-slot="chart-bar"]')];
    for (const [index, bar] of bars.entries()) {
      await pointerTo(box.left + (box.width * (index + 0.5)) / bars.length, box.top + box.height * 0.5);
      const own = bar.getBoundingClientRect();
      const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
      expect(shown.width).toBeGreaterThan(0);
      const covers =
        shown.left < own.right && own.left < shown.right && shown.top < own.bottom && own.top < shown.bottom;
      expect(covers, String(index)).toBe(false);
    }
  });
});

describe("the frosted tooltip", () => {
  it("fills translucent, so the plot shows through its blur", async () => {
    // jc3: the overlay's opaque fill outranked the frosted rule, so the glass had nothing to blur.
    await page.viewport(1024, 768);
    const { host } = renderThemed(
      <div style={{ padding: "160px 24px 24px", width: "min(600px, 100%)", boxSizing: "border-box" }}>
        <S06Chart>
          <Chart.Bar dataKey="household" />
          <Chart.Tooltip variant="frosted" />
        </S06Chart>
      </div>
    );
    const plot = surfaceBox(host);
    await pointerTo(plot.left + (plot.width / 24) * 14.5, plot.top + plot.height * 0.8);
    const fill = getComputedStyle(popup() ?? document.body).backgroundColor;
    const alpha = /\/\s*([\d.]+)\)$/.exec(fill)?.[1] ?? /rgba\([^)]*,\s*([\d.]+)\)$/.exec(fill)?.[1];
    expect(Number(alpha ?? 1)).toBeLessThan(1);
    expect(getComputedStyle(popup() ?? document.body).backdropFilter).toMatch(/blur/);
  });
});

describe("Figma's legend and tooltip metrics", () => {
  it("draws DESIGN-NOTES' 8 px swatch, 4 px gap, rounded-lg corner and SemiBold values", async () => {
    // jc10: ground-truth/design/DESIGN-NOTES.md "Legend" and "Tooltips", from Figma 1509:2165.
    await page.viewport(1024, 768);
    const { host } = renderThemed(
      <div style={{ padding: "160px 24px 24px", width: "min(600px, 100%)", boxSizing: "border-box" }}>
        <S06Chart>
          <Chart.Bar dataKey="household" />
          <Chart.Legend />
          <Chart.Tooltip />
        </S06Chart>
      </div>
    );
    // DOM audit: the legend's swatch and item are aria-hidden presentation inside named text.
    const swatch = host.querySelector('[data-slot="chart-legend-item"] [data-slot="chart-swatch"]');
    const item = host.querySelector('[data-slot="chart-legend-item"]');
    expect(swatch?.getBoundingClientRect().width).toBeCloseTo(8, 1);
    expect(swatch?.getBoundingClientRect().height).toBeCloseTo(8, 1);
    expect(getComputedStyle(item ?? document.body).columnGap).toBe("4px");
    const plot = surfaceBox(host);
    await pointerTo(plot.left + (plot.width / 24) * 14.5, plot.top + plot.height * 0.8);
    const shell = getComputedStyle(popup() ?? document.body);
    // Figma binds the radius to its rounded-lg role, which the theme layer sizes per brand, so the
    // oracle is that role as the theme resolves it, read through a probe.
    const probe = document.createElement("span");
    probe.style.borderRadius = "var(--radius-lg)";
    popup()?.append(probe);
    expect(shell.borderTopLeftRadius).toBe(getComputedStyle(probe).borderTopLeftRadius);
    probe.remove();
    // This theme steps no radius, so md and lg resolve alike, and the role class tells them apart.
    expect(popup()?.classList.contains("rounded-lg")).toBe(true);
    expect(popup()?.classList.contains("rounded-md")).toBe(false);
    expect(shell.paddingTop).toBe("8px");
    // DOM audit: the popup is aria-hidden, so its value's slot is the locator.
    const value = popup()?.querySelector('[data-slot="chart-tooltip-value"]');
    expect(getComputedStyle(value ?? document.body).fontWeight).toBe("600");
  });
});

describe("the tooltip at 400 % zoom, a 320 × 225 viewport, and on a full-height column", () => {
  // The recheck's 1.4.13 regressions: the popup flipped off the viewport, opened beside a
  // horizontal row, and an 8 px gap closed it while the pointer crossed. The oracle is 1.4.13's
  // hoverable and persistent rules and the viewport's own box.
  afterEach(async () => {
    await page.viewport(1024, 768);
  });

  function zoomed(orientation: "vertical" | "horizontal", values: readonly number[]) {
    return renderThemed(
      <div style={{ padding: "8px", width: "100%", boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={values.map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            orientation={orientation}
            style={{ "--chart-plot-height": "150px", "--chart-row-height": "36px" }}
            aria-label="Zoomed">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  it.each([
    ["a column", "vertical", [2, 3, 1, 2], 1, 320, 225],
    ["a full-height column", "vertical", [2, 4, 1, 2], 1, 320, 225],
    ["a horizontal row", "horizontal", [2, 3, 1, 2], 1, 320, 225],
    ["a full-height column at 100 % zoom", "vertical", [2, 4, 1, 2], 1, 1280, 720],
  ] as const)(
    "keeps the popup in view and open from %s onto it and through a dwell",
    async (_, orientation, values, slot, width, height) => {
      await page.viewport(width, height);
      const { host } = zoomed(orientation, values);
      const box = surfaceBox(host);
      const count = values.length;
      // The slot's centre: across a column, or down a row.
      const x =
        orientation === "vertical"
          ? box.left + (box.width * (slot + 0.5)) / count
          : box.left + box.width * 0.2;
      const y =
        orientation === "vertical"
          ? box.top + box.height * 0.9
          : box.top + (box.height * (slot + 0.5)) / count;
      await pointerTo(x, y);
      expect(label()).toBe(`k${String(slot)}`);
      const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
      const side = popup()?.getAttribute("data-side");
      expect(side === "top" || side === "bottom", String(side)).toBe(true);
      expect(shown.top).toBeGreaterThanOrEqual(0);
      expect(shown.bottom).toBeLessThanOrEqual(height);
      expect(shown.left).toBeGreaterThanOrEqual(0);
      expect(shown.right).toBeLessThanOrEqual(width);
      // Straight up or down from the slot onto the popup's near edge, then a dwell inside it.
      const nearY = side === "top" ? shown.bottom - 2 : shown.top + 2;
      const inX = Math.min(Math.max(x, shown.left + 4), shown.right - 4);
      if (orientation === "vertical") {
        await pointerTo(x, side === "top" ? shown.bottom + 1 : shown.top - 1);
        await pointerTo(x, nearY);
      } else {
        await pointerTo(inX, side === "top" ? shown.bottom + 1 : shown.top - 1);
        await pointerTo(inX, nearY);
      }
      // A dwell of about 400 ms, 24 frames at 60 Hz, which outlasts the popup's 150 ms fade.
      for (let frame = 0; frame < 24; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      expect(popup()).not.toBeNull();
      expect(popup()?.hasAttribute("data-ending-style")).toBe(false);
      expect(label()).toBe(`k${String(slot)}`);
    }
  );
});

describe("the tooltip when neither side above nor below the column holds it", () => {
  // The final recheck at 400 % zoom: a column that fills the 225 px viewport left 17 to 38 px above
  // and below, so the popup clipped its rows. CONTRACT section 9.5 now seats it beside the column,
  // and over the plot only when no side holds it. The oracle is the viewport's box, the column's
  // box and the popup's own scroll size.
  afterEach(async () => {
    await page.viewport(1024, 768);
  });

  function tall(names: readonly string[]) {
    return renderThemed(
      <div style={{ padding: "8px", width: "100%", boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={names.map((name) => ({ name, a: 4, b: 1, c: 1 }))}
            config={{
              a: { label: "Heating", color: "chart-1", stack: "use" },
              b: { label: "Hot water", color: "chart-2", stack: "use" },
              c: { label: "Lights", color: "chart-3", stack: "use" },
            }}
            xKey="name"
            style={{ "--chart-plot-height": "205px" }}
            aria-label="Tall">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
            <Chart.Bar dataKey="c" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  /** The popup's box, and whether it shows all of its content inside the 320 × 225 viewport. */
  function shownWhole(): DOMRect {
    const element = popup();
    const shown = element?.getBoundingClientRect() ?? new DOMRect();
    expect(shown.width).toBeGreaterThan(0);
    expect(shown.top).toBeGreaterThanOrEqual(0);
    expect(shown.bottom).toBeLessThanOrEqual(225);
    expect(shown.left).toBeGreaterThanOrEqual(0);
    expect(shown.right).toBeLessThanOrEqual(320);
    expect(element?.scrollHeight ?? 0).toBeLessThanOrEqual((element?.clientHeight ?? 0) + 1);
    return shown;
  }

  it("sits beside the column, on its edge, and stays open as the pointer crosses to it", async () => {
    await page.viewport(320, 225);
    const { host } = tall(["k0", "k1", "k2", "k3", "k4"]);
    const box = surfaceBox(host);
    // Slot 1 of five spans 0.2 to 0.4 of the plot, and the popup anchors on the whole slot, whose
    // edges sit on the device pixel grid like the bar's and the focus ring's.
    const pixel = (at: number): number => Math.round(at * devicePixelRatio) / devicePixelRatio;
    const left = pixel(box.left + box.width * 0.2);
    const right = pixel(box.left + box.width * 0.4);
    const x = (left + right) / 2;
    const y = box.top + box.height * 0.9;
    await pointerTo(x, y);
    expect(label()).toBe("k1");
    const shown = shownWhole();
    const side = popup()?.getAttribute("data-side");
    expect(side === "right" || side === "left", String(side)).toBe(true);
    // The popup meets the column's edge with no gap and reaches at most 1 px over it, which the
    // positioner's whole-pixel rounding leaves of the half pixel it overlaps.
    if (side === "right") {
      expect(shown.left).toBeLessThanOrEqual(right);
      expect(shown.left).toBeGreaterThanOrEqual(right - 1);
    } else {
      expect(shown.right).toBeGreaterThanOrEqual(left);
      expect(shown.right).toBeLessThanOrEqual(left + 1);
    }
    // Straight across from the slot onto the popup's near edge, then a dwell inside it.
    const nearX = side === "right" ? shown.left + 2 : shown.right - 2;
    const inY = Math.min(Math.max(y, shown.top + 4), shown.bottom - 4);
    await pointerTo(x, inY);
    await pointerTo(nearX, inY);
    for (let frame = 0; frame < 24; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    expect(popup()?.hasAttribute("data-ending-style")).toBe(false);
    expect(label()).toBe("k1");
  });

  it("overlays the plot with all of its content in view when no side holds it", async () => {
    await page.viewport(320, 225);
    const { host } = tall(["k0"]);
    const box = surfaceBox(host);
    await pointerTo(box.left + box.width / 2, box.top + box.height * 0.9);
    expect(label()).toBe("k0");
    const shown = shownWhole();
    // The column spans the plot, so an overlaying popup lies inside the plot's box.
    expect(shown.left).toBeGreaterThanOrEqual(box.left);
    expect(shown.right).toBeLessThanOrEqual(box.right);
    expect(shown.top).toBeGreaterThanOrEqual(8);
  });
});

describe.each([
  ["at 1280 px", 1280],
  ["at 320 px", 320],
])("the popup on horizontal bars %s", (_, width) => {
  afterEach(async () => {
    await page.viewport(1024, 768);
  });

  it("meets the drawn bar row within half a pixel, not the padded band", async () => {
    // The final recheck: the popup sat 3.7 to 4 px off the row, on the band's padding. The oracle
    // is the union of the active row's own bar boxes.
    await page.viewport(width, 720);
    const { host } = renderThemed(
      <div style={{ padding: "160px 24px 24px", width: "100%", boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[2, 3, 1, 2].map((v, index) => ({ name: `k${String(index)}`, v, w: v + 1 }))}
            config={{ v: { label: "V", color: "chart-1" }, w: { label: "W", color: "chart-2" } }}
            xKey="name"
            orientation="horizontal"
            style={{ "--chart-row-height": "36px" }}
            aria-label="Rows">
            <Chart.Bar dataKey="v" />
            <Chart.Bar dataKey="w" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = surfaceBox(host);
    // Row 1 of four spans a quarter of the plot from a quarter down.
    const bandTop = box.top + box.height / 4;
    const bandBottom = box.top + box.height / 2;
    await pointerTo(box.left + box.width * 0.2, (bandTop + bandBottom) / 2);
    expect(label()).toBe("k1");
    // DOM audit: bars are aria-hidden plot output, so the row is the bars inside the band.
    const row = [...host.querySelectorAll('[data-slot="chart-bar"]')]
      .map((bar) => bar.getBoundingClientRect())
      .filter((bar) => bar.top >= bandTop - 0.5 && bar.bottom <= bandBottom + 0.5);
    expect(row.length).toBeGreaterThan(0);
    const rowTop = Math.min(...row.map((bar) => bar.top));
    const rowBottom = Math.max(...row.map((bar) => bar.bottom));
    expect(rowTop - bandTop).toBeGreaterThan(1);
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    const side = popup()?.getAttribute("data-side");
    if (side === "top") expect(Math.abs(shown.bottom - rowTop)).toBeLessThanOrEqual(0.5);
    else expect(Math.abs(shown.top - rowBottom), String(side)).toBeLessThanOrEqual(0.5);
  });
});

describe("the tooltip anchor", () => {
  const ROWS = [2, 3, 1, 2].map((v, index) => ({ name: `k${String(index)}`, v }));

  it.each(["vertical", "horizontal"] as const)(
    "stays on the active %s bar inside an ancestor scaled to one half",
    async (orientation) => {
      // T1: the anchor converts plot pixels to the viewport through the plot's scaled client box.
      const { host } = renderThemed(
        <div style={{ padding: "320px 48px 48px" }}>
          <div style={{ width: 600, transform: "scale(0.5)", transformOrigin: "0 0" }}>
            <LocaleProvider locale="en-US">
              <Chart.Root
                data={ROWS}
                config={{ v: { label: "V", color: "chart-1" } }}
                xKey="name"
                orientation={orientation}
                data-intro="none"
                aria-label="Scaled">
                <Chart.Bar dataKey="v" />
                <Chart.Tooltip />
              </Chart.Root>
            </LocaleProvider>
          </div>
        </div>
      );
      // DOM audit: bars are aria-hidden plot output, in slot order.
      const bar = host.querySelectorAll('[data-slot="chart-bar"]')[1]?.getBoundingClientRect();
      if (bar === undefined) throw new Error("no bar");
      await pointerTo((bar.left + bar.right) / 2, (bar.top + bar.bottom) / 2);
      expect(label()).toBe("k1");
      const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
      const side = popup()?.getAttribute("data-side");
      if (orientation === "vertical") {
        // The popup centres on the column above or below it.
        expect(["top", "bottom"]).toContain(side);
        expect(Math.abs((shown.left + shown.right) / 2 - (bar.left + bar.right) / 2)).toBeLessThanOrEqual(1);
      } else if (side === "top") expect(Math.abs(shown.bottom - bar.top)).toBeLessThanOrEqual(1);
      else expect(Math.abs(shown.top - bar.bottom), String(side)).toBeLessThanOrEqual(1);
    }
  );

  it("centres on the point itself under a point scale, at the plot's left edge for the first slot", async () => {
    // T6: four points on the plot's width lie at 0, a third, two thirds and the full width, so
    // the first point sits on the plot's left edge, not in the middle of its clipped cell.
    const { host } = renderThemed(
      <div style={{ padding: "160px 240px 24px", width: 840, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            data-intro="none"
            aria-label="Points">
            <Chart.Grid />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = surfaceBox(host);
    await pointerTo(box.left + 2, box.top + box.height / 2);
    expect(label()).toBe("k0");
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs((shown.left + shown.right) / 2 - box.left)).toBeLessThanOrEqual(1);
  });

  it("anchors on the point itself on a horizontal point scale, at the plot's top for the first slot", async () => {
    // B2-4: four 32 px rows make a 128 px plot. Under a point scale the first point lies on the
    // plot's top edge, not on a bar row 4 to 28 px down.
    const { host } = renderThemed(
      <div style={{ padding: "200px 24px 200px", width: 600, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            orientation="horizontal"
            data-intro="none"
            aria-label="Rows of points">
            <Chart.Grid />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = surfaceBox(host);
    expect(box.height).toBe(128);
    await pointerTo(box.left + box.width / 2, box.top + 2);
    expect(label()).toBe("k0");
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    const side = popup()?.getAttribute("data-side");
    expect(["top", "bottom"]).toContain(side);
    expect(Math.abs((side === "top" ? shown.bottom : shown.top) - box.top), String(side)).toBeLessThanOrEqual(
      1
    );
  });
});
