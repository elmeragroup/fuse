// Guides and followers under both orientations, in Chromium, after layer 05's review findings
// q13, q19, s11 and s21. Oracle: positions written by hand from the linear value scale over a
// niced domain of [0, 10] and from the band of each category, read from each guide's SVG shape.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { intersects } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** Five categories whose largest value, 10, nices the domain to [0, 10]. */
const ROWS = [2, 4, 6, 8, 10].map((v, index) => ({ name: `k${String(index)}`, v }));

/** A guide's drawn box in pixels from its own element's top left. */
type DrawnBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** An element's rendered size in pixels. */
type Size = { readonly width: number; readonly height: number };

/** An SVG attribute as a number. */
function attribute(mark: Element, name: string): number {
  return Number(mark.getAttribute(name));
}

/**
 * A guide's drawn box, from its SVG mark's attributes in the guide's own pixels. A line is a
 * 1 px rule whose near edge sits half a pixel before its centre line.
 */
function drawn(element: Element | null): DrawnBox {
  const mark = element?.querySelector("line, rect");
  if (mark === null || mark === undefined) throw new Error("no guide");
  if (mark.tagName === "rect") {
    return {
      left: attribute(mark, "x"),
      top: attribute(mark, "y"),
      width: attribute(mark, "width"),
      height: attribute(mark, "height"),
    };
  }
  const [x1, x2, y1, y2] = ["x1", "x2", "y1", "y2"].map((name) => attribute(mark, name));
  return x1 === x2
    ? {
        left: (x1 ?? 0) - 0.5,
        top: Math.min(y1 ?? 0, y2 ?? 0),
        width: 1,
        height: Math.abs((y2 ?? 0) - (y1 ?? 0)),
      }
    : {
        left: Math.min(x1 ?? 0, x2 ?? 0),
        top: (y1 ?? 0) - 0.5,
        width: Math.abs((x2 ?? 0) - (x1 ?? 0)),
        height: 1,
      };
}

function size(element: Element | null): Size {
  const rect = element?.getBoundingClientRect() ?? new DOMRect();
  return { width: rect.width, height: rect.height };
}

describe("horizontal guides", () => {
  it("draw value guides across the value axis and the band along its category", async () => {
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <button type="button">før</button>
          <Chart.Root
            data-intro="none"
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            orientation="horizontal"
            aria-label="Liggende">
            <Chart.Crosshair />
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine y={5} />
            <Chart.ReferenceArea y1={2} y2={4} />
            <Chart.ActiveValueLine dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowDown}");
    // DOM audit: the guides are aria-hidden plot output, so their slots are the locators.
    const line = host.querySelector('[data-slot="chart-reference-line"]');
    const area = host.querySelector('[data-slot="chart-reference-area"]');
    const valueLine = host.querySelector('[data-slot="chart-active-value-line"]');
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    const { width, height } = size(line);
    // 5 of [0, 10] sits halfway across, and the band from 2 to 4 spans 20 % to 40 %.
    // A rule starts within half a pixel of its value, on the nearest device pixel.
    expect(Math.abs(drawn(line).left - width * 0.5)).toBeLessThanOrEqual(0.5);
    expect(drawn(line).height).toBeCloseTo(height, 0);
    expect(drawn(area).left).toBeCloseTo(width * 0.2, 0);
    expect(drawn(area).width).toBeCloseTo(width * 0.2, 0);
    // ArrowDown moves to the second category, whose value 4 sits 40 % across.
    expect(Math.abs(drawn(valueLine).left - size(valueLine).width * 0.4)).toBeLessThanOrEqual(0.5);
    // The band of the second of five rows starts a fifth of the way down and is a fifth tall.
    expect(drawn(crosshair).top).toBeCloseTo(size(crosshair).height / 5, 0);
    expect(drawn(crosshair).height).toBeCloseTo(size(crosshair).height / 5, 0);
  });
});

describe("the ActiveValueLine across an orientation change", () => {
  function valueLine(orientation: "vertical" | "horizontal") {
    return (
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            orientation={orientation}
            aria-label="Snu">
            <Chart.Bar dataKey="v" />
            <Chart.ActiveValueLine dataKey="v" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  it("redraws all four endpoints, so the rule runs the plot's full height once it turns", async () => {
    // T7: the turned rule kept the y of its horizontal self at one end. On 400 px the second
    // category's 4 of [0, 10] sits 40 % across, from the top of the plot to its bottom.
    const { host, rerender } = renderThemed(valueLine("vertical"));
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}");
    rerender(valueLine("horizontal"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    // DOM audit: the value line is aria-hidden plot output.
    const wrapper = host.querySelector('[data-slot="chart-active-value-line"]');
    const line = wrapper?.querySelector("line");
    if (line === null || line === undefined) throw new Error("no line");
    const { width, height } = size(wrapper ?? null);
    expect(attribute(line, "x1")).toBe(attribute(line, "x2"));
    expect(Math.abs(attribute(line, "x1") - 0.5 - width * 0.4)).toBeLessThanOrEqual(0.5);
    expect([attribute(line, "y1"), attribute(line, "y2")]).toEqual([0, height]);
  });
});

describe("a label enabled after its reference draws", () => {
  it("stacks under the label already on the same value", () => {
    // Q4-1: two lines at 10 on 0–10, the second unlabelled at first. Labelling it changes no data
    // and no guide, and its label still stacks a line under the first one, at the plot's top.
    const lines = (second: string | undefined) => (
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Merket senere">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine y={10} label="Tak" />
            <Chart.ReferenceLine y={10} label={second} />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const { host, rerender } = renderThemed(lines(undefined));
    rerender(lines("Mål"));
    // DOM audit: reference labels are aria-hidden plot output, so their slot is the only locator.
    const [first, second] = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-reference-label"]')];
    if (first === undefined || second === undefined) throw new Error("no labels");
    const line = Number.parseFloat(getComputedStyle(second).lineHeight);
    const top = first.getBoundingClientRect().bottom;
    expect(Math.abs(second.getBoundingClientRect().bottom - top - line)).toBeLessThanOrEqual(0.5);
  });
});

describe("label boxes of their own sizes", () => {
  function twenty(children: ReactNode) {
    return (
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={[{ name: "a", v: 20 }]}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Størrelser">
            <Chart.Bar dataKey="v" />
            {children}
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  /** Every reference label's box, top to bottom. */
  function boxes(host: HTMLElement) {
    // DOM audit: reference labels are aria-hidden plot output, so their slot is the only locator.
    return [...host.querySelectorAll('[data-slot="chart-reference-label"]')]
      .map((label) => label.getBoundingClientRect())
      .toSorted((a, b) => a.top - b.top);
  }

  it("stacks a 32 px label at 9.5 under a 16 px label at 10 with no overlap", () => {
    // Q4-2: 10 of 0–20 lies 100 px down and 9.5 lies 105 px down, so the 32 px label ends 32 px
    // below the 16 px one.
    const { host } = renderThemed(
      twenty(
        <>
          <Chart.ReferenceLine y={9.5} label="Høy" style={{ lineHeight: "32px" }} />
          <Chart.ReferenceLine y={10} label="Lav" style={{ lineHeight: "16px" }} />
        </>
      )
    );
    const [upper, lower] = boxes(host);
    if (upper === undefined || lower === undefined) throw new Error("no labels");
    expect(upper.height).toBe(16);
    expect(lower.height).toBe(32);
    expect(lower.top).toBeGreaterThanOrEqual(upper.bottom - 0.5);
  });

  it("keeps a line's label and a cut area's label a line apart under an 18 px root font", () => {
    // Q4-3: a line at pixel 23 of the 200 px plot is 17.7 of 0–20, and an area from 5 to 24 runs
    // from 40 px above the plot to 150 px. The area's inset, 0.25rem and a line, is fractional.
    const root = document.documentElement;
    const size = root.style.fontSize;
    root.style.fontSize = "18px";
    try {
      const { host } = renderThemed(
        twenty(
          <>
            <Chart.ReferenceLine y={17.7} label="Linje" />
            <Chart.ReferenceArea y1={5} y2={24} label="Bånd" />
          </>
        )
      );
      const [upper, lower] = boxes(host);
      if (upper === undefined || lower === undefined) throw new Error("no labels");
      expect(lower.top).toBeGreaterThanOrEqual(upper.bottom - 0.5);
    } finally {
      root.style.fontSize = size;
    }
  });
});

describe("interaction bands denser than the device pixels", () => {
  it("draws the first of 400 bands on 200 px one pixel wide, for the crosshair and the focused option", async () => {
    // B4-1 at DPR 1: the first band [0, 0.5] keeps the pixel [0, 1], as its bar does.
    expect(devicePixelRatio).toBe(1);
    const rows = Array.from({ length: 400 }, (_, index) => ({ name: `c${String(index)}`, v: 1 }));
    const { host } = renderThemed(
      <div style={{ width: 200 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Tett">
            <Chart.Bar dataKey="v" />
            <Chart.Crosshair variant="band" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{Home}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("1");
    // DOM audit: the crosshair is aria-hidden plot output.
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    const band = drawn(crosshair);
    expect([band.left, band.left + band.width]).toEqual([0, 1]);
    const plot = crosshair?.getBoundingClientRect() ?? new DOMRect();
    const focused = document.activeElement?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(focused.left - plot.left)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(focused.width - 1)).toBeLessThanOrEqual(0.5);
  });
});

describe("slot guides denser than the device pixels", () => {
  /** 400 categories on 200 px at DPR 1, so each band is half a pixel wide. */
  const DENSE = Array.from({ length: 400 }, (_, index) => ({ name: `c${String(index)}`, v: 1 }));

  it("draws the line crosshair on the last of 400 bands inside its pixel, 199 to 200 px", async () => {
    // B7-4: the last band [199.5, 200] covers the pixel [199, 200]. Its centre, 199.75, rounds to
    // 200, the plot's end, so the line moves back inside the band's pixel.
    expect(devicePixelRatio).toBe(1);
    const { host } = renderThemed(
      <div style={{ width: 200 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={DENSE}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Tett">
            <Chart.Bar dataKey="v" />
            <Chart.Crosshair variant="line" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{End}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("400");
    // DOM audit: the crosshair is aria-hidden plot output.
    const line = drawn(host.querySelector('[data-slot="chart-crosshair"]'));
    expect([line.left, line.left + line.width]).toEqual([199, 200]);
  });

  it("draws a labelled area on the first of 400 bands on its pixel, 0 to 1 px, with its label", () => {
    // B7-1 and Q7-2: the area of c0 alone spans [0, 0.5], which snaps to nothing. The pixel floor
    // keeps the pixel [0, 1], and the area shows, label and all, from that drawn pixel.
    expect(devicePixelRatio).toBe(1);
    const { host } = renderThemed(
      <div style={{ width: 200 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={DENSE}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Tett">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceArea x1="c0" x2="c0" label="Spenn" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the reference is aria-hidden plot output; its sentence is the chart's description.
    const area = host.querySelector<HTMLElement>('[data-slot="chart-reference-area"]');
    expect(area?.hasAttribute("data-outside")).toBe(false);
    const band = drawn(area);
    expect([band.left, band.left + band.width]).toEqual([0, 1]);
    // DOM audit: the label is aria-hidden text inside the reference.
    const label = area?.querySelector('[data-slot="chart-reference-label"]');
    expect(label?.textContent).toBe("Spenn");
    expect(size(label ?? null).width).toBeGreaterThan(0);
  });
});

describe("the band crosshair on a point scale", () => {
  it("covers the focused option's columns, 62 to 137 px for the second of four points on 300 px", async () => {
    // B2-5: the points lie 100 px apart, and each owns a 75 px cell centred on it, so the second
    // point's cell runs from 62.5, which rounds left, to 137.5, which rounds left too.
    const { host } = renderThemed(
      <div style={{ width: 300 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={ROWS.slice(0, 4)}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            aria-label="Punkter">
            <Chart.Grid />
            <Chart.Crosshair variant="band" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the plot's single tab stop is the listbox's option.
    const option = host.querySelector<HTMLElement>('[role="option"]');
    option?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("2");
    // DOM audit: the crosshair is aria-hidden plot output.
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    const band = drawn(crosshair);
    expect([band.left, band.left + band.width]).toEqual([62, 137]);
    const plot = crosshair?.getBoundingClientRect() ?? new DOMRect();
    const focused = document.activeElement?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(focused.left - plot.left - 62)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(focused.right - plot.left - 137)).toBeLessThanOrEqual(0.5);
  });
});

describe("references outside the plot", () => {
  it("clip a band to the plot and draw no line outside it", () => {
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Utenfor">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceArea y1={8} y2={20} />
            <Chart.ReferenceLine y={30} label="Tak" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the guides are aria-hidden plot output, so their slots are the locators.
    const area = host.querySelector('[data-slot="chart-reference-area"]');
    const line = host.querySelector('[data-slot="chart-reference-line"]');
    // The band from 8 to 20 shows from the plot top down to 8, the top fifth of [0, 10].
    expect(drawn(area).top).toBeCloseTo(0, 0);
    expect(drawn(area).height).toBeCloseTo(size(area).height * 0.2, 0);
    const rule = line?.querySelector("svg");
    expect(rule === null || rule === undefined ? "" : getComputedStyle(rule).display).toBe("none");
    // The line keeps its sentence for readers.
    expect(line?.querySelector('[data-slot="chart-reference-text"]')?.textContent).not.toBe("");
  });

  it("place a guide inside or outside the plot before the snap, not after it", () => {
    // B10-1's class at 1x on 200 px over [0, 10], 20 px a unit. A line at 10.015 lies 0.3 px
    // above the plot, which snaps onto its top, and hides. A band from 5 to 5.01, 99.8 to 100 px,
    // lies inside and keeps the pixel its middle lies in, 99 to 100. A band from 9 to 10.01 runs 0.2 px past the top, so
    // its label takes the cut band's place.
    expect(devicePixelRatio).toBe(1);
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={ROWS}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Snapp">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine y={10.015} />
            <Chart.ReferenceArea y1={5} y2={5.01} />
            <Chart.ReferenceArea y1={9} y2={10.01} label="Kutt" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    // DOM audit: the guides are aria-hidden plot output, so their slots are the locators.
    const line = host.querySelector('[data-slot="chart-reference-line"]');
    const [thin, cut] = host.querySelectorAll('[data-slot="chart-reference-area"]');
    expect(line?.hasAttribute("data-outside")).toBe(true);
    expect(thin?.hasAttribute("data-outside")).toBe(false);
    expect(drawn(thin ?? null)).toEqual({ left: 0, top: 99, width: 400, height: 1 });
    expect(cut?.hasAttribute("data-clipped")).toBe(true);
  });
});

/** Whether two boxes share any area. */
describe("reference labels", () => {
  // jc5, jc6, js4 and js9. Eight categories of value 10, so every bar reaches the plot top, which
  // is the case where a label inside the plot must cross a bar.
  const TALL = Array.from({ length: 8 }, (_, index) => ({ name: `k${String(index)}`, v: 10 }));

  function labelled() {
    return renderThemed(
      <div style={{ width: 480 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
            data-intro="none"
            data={TALL}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Merket">
            <Chart.Bar dataKey="v" />
            <Chart.ReferenceLine x="k2" label="Endring" tone="muted" />
            <Chart.ReferenceArea x1="k5" x2="k6" label="Topp" tone="muted" />
            <Chart.ReferenceArea y1={8} y2={20} label="Bånd" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
  }

  function labelOf(host: HTMLElement, text: string): DOMRect {
    // DOM audit: reference labels are aria-hidden plot output, so their text is the locator.
    const label = [...host.querySelectorAll('[data-slot="chart-reference-label"]')].find(
      (element) => element.textContent === text
    );
    if (label === undefined) throw new Error(`no label ${text}`);
    return label.getBoundingClientRect();
  }

  it("label a slot line at its line and a slot band inside its band, clear of every bar", () => {
    const { host } = labelled();
    const plot = host.querySelector('[data-slot="chart-plot"], [role="listbox"]')?.getBoundingClientRect();
    if (plot === undefined) throw new Error("no plot");
    const slot = plot.width / 8;
    // k2's centre is 2.5 slots in, and the band of k5 and k6 runs from 5 to 7 slots in.
    const line = labelOf(host, "Endring");
    const lineX = plot.left + slot * 2.5;
    expect(line.left).toBeLessThanOrEqual(lineX);
    expect(line.right).toBeGreaterThanOrEqual(lineX);
    const band = labelOf(host, "Topp");
    expect(band.left).toBeCloseTo(plot.left + slot * 5, 0);
    expect(band.right).toBeLessThanOrEqual(plot.left + slot * 7);
    // DOM audit: bars are aria-hidden plot output, so their slot is the locator.
    for (const bar of host.querySelectorAll('[data-slot="chart-bar"]')) {
      expect(intersects(line, bar.getBoundingClientRect())).toBe(false);
      expect(intersects(band, bar.getBoundingClientRect())).toBe(false);
    }
  });

  it("paint muted label text in the full muted foreground", () => {
    const { host } = labelled();
    // DOM audit: reference labels are aria-hidden plot output, so their text is the locator.
    const label = [...host.querySelectorAll('[data-slot="chart-reference-label"]')].find(
      (element) => element.textContent === "Endring"
    );
    const probe = document.createElement("span");
    probe.style.color = "var(--muted-foreground)";
    host.querySelector('[data-slot="chart"]')?.append(probe);
    // The contrast matrix holds muted-foreground at 4.5:1, so the label must paint it unmixed.
    expect(label === undefined ? "" : getComputedStyle(label).color).toBe(getComputedStyle(probe).color);
    // The theme paints muted-foreground as an opaque grey, never the inherited default black.
    expect(getComputedStyle(probe).color).not.toBe("rgb(0, 0, 0)");
    expect(getComputedStyle(probe).color).not.toMatch(/\/\s*0?\.\d/);
  });

  it("keep a band's label inside the plot when the band runs past the domain", () => {
    const { host } = labelled();
    const plot = host.querySelector('[role="listbox"]')?.getBoundingClientRect();
    const band = labelOf(host, "Bånd");
    expect(band.top).toBeGreaterThanOrEqual((plot?.top ?? 0) - 0.5);
  });
});

describe.each([390, 1280])("reference labels in a %d px viewport", (width) => {
  // The final recheck's row 8: on capacity-step the band's label lay over the limit line's label at
  // every width, and on reference-areas at 390 px the peak hours' label lay over the high band's.
  // The oracle is the labels' own rendered boxes, of which no two may share any area.
  function labelBoxes(host: HTMLElement): DOMRect[] {
    // DOM audit: reference labels are aria-hidden plot output.
    return [...host.querySelectorAll('[data-slot="chart-reference-label"]')]
      .filter((label) => label.textContent !== "")
      .map((label) => label.getBoundingClientRect());
  }

  function expectApart(boxes: readonly DOMRect[]): void {
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (const [index, box] of boxes.entries()) {
      for (const other of boxes.slice(index + 1)) {
        expect(intersects(box, other), `${JSON.stringify(box)} over ${JSON.stringify(other)}`).toBe(false);
      }
    }
  }

  it("keep a band's label and a line's label at the band's top edge apart, with a third line below", async () => {
    await page.viewport(width, 720);
    const { host } = renderThemed(
      <div style={{ width: "100%", padding: 16, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data-intro="none"
            data={[1.2, 3.1, 2.4, 4.2, 1.8].map((kw, index) => ({ name: `k${String(index)}`, kw }))}
            config={{ kw: { label: "Peak", color: "chart-1" } }}
            xKey="name"
            yInclude={[5]}
            aria-label="Capacity">
            <Chart.YAxis />
            <Chart.ReferenceArea y1={2} y2={5} label="Capacity step 2–5 kW" tone="muted" />
            <Chart.Bar dataKey="kw" />
            <Chart.ReferenceLine y={3.2} label="Average of the top three 3.2 kW" variant="dashed" />
            <Chart.ReferenceLine y={5} label="Desired capacity limit 5 kW" tone="error" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    expectApart(labelBoxes(host));
  });

  it("keep a slot band's label above the plot apart from a value band's label at the plot top", async () => {
    await page.viewport(width, 720);
    const { host } = renderThemed(
      // The docs stage pads its demo by 40 px a side at 390 px, which narrows the plot as there.
      <div style={{ width: "100%", padding: 40, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data-intro="none"
            data={[0.42, 0.38, 0.35, 0.34, 0.36, 0.51, 0.88, 1.24, 1.02, 0.74, 0.66, 0.61].map(
              (kwh, index) => ({ name: `h${String(index)}`, kwh })
            )}
            config={{ kwh: { label: "Usage", color: "chart-1" } }}
            xKey="name"
            yInclude={[1.4]}
            aria-label="Peak window">
            <Chart.YAxis />
            <Chart.ReferenceArea x1="h6" x2="h8" label="Peak hours" tone="muted" />
            <Chart.ReferenceArea y1={1} y2={1.4} label="High band 1–1.4 kWh" tone="error" />
            <Chart.Bar dataKey="kwh" />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    expectApart(labelBoxes(host));
  });
});

describe("the ActiveValueLine pill", () => {
  // jp3: with no start axis the pill sat left of the plot, outside the root, and a stage cut it.
  it.each([
    ["with no value axis", false],
    ["beside a start value axis", true],
  ])("stays inside the root at 390 px %s", async (_, axis) => {
    const rows = [342, 676, 512, 924, 458].map((v, index) => ({ name: `m${String(index)}`, v }));
    const { host } = renderThemed(
      <div style={{ width: 390 }}>
        <LocaleProvider locale="nb-NO">
          <button type="button">før</button>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            aria-label="Pille">
            {axis ? <Chart.YAxis /> : null}
            <Chart.Bar dataKey="v" />
            <Chart.ActiveValueLine dataKey="v">
              <Chart.ValueLabel />
            </Chart.ActiveValueLine>
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}{ArrowRight}{ArrowRight}");
    // DOM audit: the pill and the root are aria-hidden plot output and the figure.
    const pill = host.querySelector('[data-slot="chart-value-label"]')?.getBoundingClientRect();
    const root = host.querySelector('[data-slot="chart"]')?.getBoundingClientRect();
    if (pill === undefined || root === undefined) throw new Error("no pill");
    // The fourth row holds 924, which the pill prints.
    expect(host.querySelector('[data-slot="chart-value-label"]')?.textContent).toContain("924");
    expect(pill.left).toBeGreaterThanOrEqual(root.left - 0.5);
    expect(pill.right).toBeLessThanOrEqual(root.right + 0.5);
  });
});
