// Guides and followers under both orientations, in Chromium, Firefox and WebKit, after layer 05's
// review findings q13, q19, s11 and s21. Oracle: positions written by hand from the linear value
// scale over a niced domain of [0, 10] and from the band of each category, read from the computed
// style of each guide's drawn box, which is its `::before`.
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

/** Five categories whose largest value, 10, nices the domain to [0, 10]. */
const ROWS = [2, 4, 6, 8, 10].map((v, index) => ({ name: `k${String(index)}`, v }));

function finish(host: HTMLElement): void {
  // DOM audit: Root's figure holds every animation of the chart.
  for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ?? []) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)) animation.finish();
  }
}

/** A guide's drawn box in pixels from its own element's top left. */
type DrawnBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** An element's rendered size in pixels. */
type Size = { readonly width: number; readonly height: number };

function drawn(element: Element | null): DrawnBox {
  if (element === null) throw new Error("no guide");
  const before = getComputedStyle(element, "::before");
  return {
    left: Number.parseFloat(before.left),
    top: Number.parseFloat(before.top),
    width: Number.parseFloat(before.width),
    height: Number.parseFloat(before.height),
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
    finish(host);
    // DOM audit: the guides are aria-hidden plot output, so their slots are the locators.
    const line = host.querySelector('[data-slot="chart-reference-line"]');
    const area = host.querySelector('[data-slot="chart-reference-area"]');
    const valueLine = host.querySelector('[data-slot="chart-active-value-line"]');
    const crosshair = host.querySelector('[data-slot="chart-crosshair"]');
    const { width, height } = size(line);
    // 5 of [0, 10] sits halfway across, and the band from 2 to 4 spans 20 % to 40 %.
    expect(drawn(line).left).toBeCloseTo(width * 0.5, 0);
    expect(drawn(line).height).toBeCloseTo(height, 0);
    expect(drawn(area).left).toBeCloseTo(width * 0.2, 0);
    expect(drawn(area).width).toBeCloseTo(width * 0.2, 0);
    // ArrowDown moves to the second category, whose value 4 sits 40 % across.
    expect(drawn(valueLine).left).toBeCloseTo(size(valueLine).width * 0.4, 0);
    // The band of the second of five rows starts a fifth of the way down and is a fifth tall.
    expect(drawn(crosshair).top).toBeCloseTo(size(crosshair).height / 5, 0);
    expect(drawn(crosshair).height).toBeCloseTo(size(crosshair).height / 5, 0);
  });
});

describe("references outside the plot", () => {
  it("clip a band to the plot and draw no line outside it", () => {
    const { host } = renderThemed(
      <div style={{ width: 400 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
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
    expect(line === null ? "" : getComputedStyle(line, "::before").display).toBe("none");
    // The line keeps its sentence for readers.
    expect(line?.querySelector('[data-slot="chart-reference-text"]')?.textContent).not.toBe("");
  });
});

/** Whether two boxes share any area. */
function intersects(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("reference labels", () => {
  // jc5, jc6, js4 and js9. Eight categories of value 10, so every bar reaches the plot top, which
  // is the case where a label inside the plot must cross a bar.
  const TALL = Array.from({ length: 8 }, (_, index) => ({ name: `k${String(index)}`, v: 10 }));

  function labelled() {
    return renderThemed(
      <div style={{ width: 480 }}>
        <LocaleProvider locale="nb-NO">
          <Chart.Root
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
    finish(host);
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
    finish(host);
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
    finish(host);
    expectApart(labelBoxes(host));
  });

  it("keep a slot band's label above the plot apart from a value band's label at the plot top", async () => {
    await page.viewport(width, 720);
    const { host } = renderThemed(
      // The docs stage pads its demo by 40 px a side at 390 px, which narrows the plot as there.
      <div style={{ width: "100%", padding: 40, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
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
    finish(host);
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
    finish(host);
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
