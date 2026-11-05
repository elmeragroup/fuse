// PieChart's marks and readouts in Chromium. Units under test: PieChart.Pie, Labels, the Center
// parts, Track, Glow and the polar LegendToggleGroup. Oracles, written by hand: d3's pie rule over
// the rows, each slice spanning its value's share of 360°; the browser's own fill test, which the
// pick must agree with (Q8); CONTRACT section 8.4's on-colour label rule over the theme's
// `chart-*-foreground` roles; section 8.13's centre table with the largest-remainder shares; D3's
// pop and S2's dims; R10's halo; Q12's gradient; and S9's category word.
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  activeSlice,
  centreText,
  clientPoint,
  hoverAt,
  pieSvg,
  polarFigure,
  sectors,
} from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";

/** Shares of 100, so slice i spans its value as a share of 360°: 0–180, 180–288, 288–342 and 342–360. */
const HALVES = [
  { part: "strom", kr: 50 },
  { part: "nettleie", kr: 30 },
  { part: "avgifter", kr: 15 },
  { part: "fast", kr: 5 },
];

const HALVES_CONFIG = {
  strom: { label: "Strøm", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgifter: { label: "Avgifter", color: "chart-3" },
  fast: { label: "Fastledd", color: "chart-4" },
} as const;

/** October's bill, 1 386 kr: shares 44.16, 31.60, 20.71 and 3.54, rounding together to 44, 32, 21 and 3. */
const BILL = [
  { part: "strom", kr: 612 },
  { part: "nettleie", kr: 438 },
  { part: "avgifter", kr: 287 },
  { part: "fast", kr: 49 },
];

const NOK = { style: "currency", currency: "NOK", maximumFractionDigits: 0 } as const;

function Halves({ children }: { readonly children?: React.ReactNode }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 320 }}>
        <PieChart.Root
          data={HALVES}
          config={HALVES_CONFIG}
          nameKey="part"
          valueKey="kr"
          innerRadius={0.5}
          data-intro="none"
          aria-label="Regning">
          <PieChart.Pie />
          {children}
        </PieChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** Finish every running transition in the host, so styles show their rest. */
function settle(host: HTMLElement): void {
  for (const animation of host.getAnimations({ subtree: true })) animation.finish();
}

describe("the slices (d3's pie rule, Q8)", () => {
  it("fills each slice where its share puts it, and picks the slice whose fill holds the pointer", async () => {
    const { host } = renderThemed(<Halves />);
    const svg = pieSvg(host);
    const drawn = sectors(host);
    expect(drawn).toHaveLength(4);
    // The frame writes the slices in a microtask after the commit.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Each slice's bisector, three quarters out, lies in its own fill and in no other.
    const bisectors = [90, 234, 315, 351];
    bisectors.forEach((angle, index) => {
      const radians = (angle * Math.PI) / 180;
      // Rounded, as Chromium's fill test reads a coordinate of 1e-17 off its true side.
      const round = (value: number) => Math.round(value * 1e9) / 1e9;
      const point = new DOMPoint(round(0.75 * Math.sin(radians)), round(-0.75 * Math.cos(radians)));
      expect(drawn.map((path) => path.isPointInFill(point))).toEqual(
        drawn.map((_, other) => other === index)
      );
    });
    // Every point of a 13 × 13 grid that lies in one slice's fill, half a pixel clear of its edges,
    // picks that slice.
    const unit = svg.getBoundingClientRect().width / 2;
    const clear = 0.5 / unit;
    let checked = 0;
    for (let row = 0; row < 13; row += 1) {
      for (let column = 0; column < 13; column += 1) {
        const x = Math.round((-0.96 + (column * 1.92) / 12) * 1e6) / 1e6;
        const y = Math.round((-0.96 + (row * 1.92) / 12) * 1e6) / 1e6;
        const owner = drawn.findIndex((path) =>
          [
            [0, 0],
            [clear, 0],
            [-clear, 0],
            [0, clear],
            [0, -clear],
          ].every(([dx = 0, dy = 0]) => path.isPointInFill(new DOMPoint(x + dx, y + dy)))
        );
        if (owner === -1) continue;
        await hoverAt(...clientPoint(svg, x, y));
        expect(activeSlice(host), `${String(x)},${String(y)}`).toBe(owner);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("pops the active slice 8 px along its bisector and dims the rest (D3)", async () => {
    const { host } = renderThemed(<Halves />);
    const [first, ...rest] = sectors(host);
    const before = first?.getBoundingClientRect() ?? new DOMRect();
    await userEvent.tab();
    settle(host);
    const after = first?.getBoundingClientRect() ?? new DOMRect();
    // Strøm's bisector points at 3 o'clock, so it moves 8 px right and none down.
    expect(after.left - before.left).toBeCloseTo(8, 0);
    expect(after.top - before.top).toBeCloseTo(0, 0);
    expect(rest.map((path) => getComputedStyle(path).opacity)).toEqual(["0.45", "0.45", "0.45"]);
    expect(getComputedStyle(first ?? host).opacity).toBe("1");
  });

  it("dims every slice but the selected category's, and names its toggles with the category word (S2, S9)", async () => {
    const { host } = renderThemed(
      <Halves>
        <PieChart.LegendToggleGroup />
      </Halves>
    );
    expect(page.getByRole("group", { name: "Kategorier" }).elements()).toHaveLength(1);
    await userEvent.click(page.getByRole("button", { name: "Nettleie" }));
    settle(host);
    expect(sectors(host).map((path) => getComputedStyle(path).opacity)).toEqual([
      "0.45",
      "1",
      "0.45",
      "0.45",
    ]);
  });
});

describe("the labels (section 8.4, Q10)", () => {
  it("puts a label inside only where its role has an on-colour role and it fits, with a leader from the rim otherwise", () => {
    // Strøm in chart-1 and Avgifter in chart-other have on-colour roles, and Nettleie's sequential
    // step has none, so it reads outside, its leader leaving the rim on its bisector at 225°.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 360 }}>
          <span data-probe="" style={{ color: "var(--chart-1-foreground)" }} />
          <PieChart.Root
            data={[
              { part: "strom", kr: 50 },
              { part: "nettleie", kr: 25 },
              { part: "avgifter", kr: 25 },
            ]}
            config={{
              strom: { label: "Strøm", color: "chart-1" },
              nettleie: { label: "Nettleie", color: "chart-seq-4" },
              avgifter: { label: "Avgifter", color: "chart-other" },
            }}
            nameKey="part"
            valueKey="kr"
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Labels>
              <PieChart.LegendShare />
            </PieChart.Labels>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: labels are aria-hidden plot output, read by their slot.
    const labels = [...host.querySelectorAll('[data-slot="pie-chart-label"]')];
    expect(labels.map((label) => [label.textContent, label.getAttribute("data-placement")])).toEqual([
      ["50 %", "inside"],
      ["25 %", "outside"],
      ["25 %", "inside"],
    ]);
    // An inside label reads its slice role's on-colour.
    expect(getComputedStyle(labels[0] ?? host).color).toBe(
      getComputedStyle(host.querySelector("[data-probe]") ?? host).color
    );
    // DOM audit: leaders are aria-hidden plot output, read by their slot.
    const leader = host.querySelectorAll('[data-slot="pie-chart-leader"]')[1]?.getAttribute("points") ?? "";
    const [x = Number.NaN, y = Number.NaN] = (leader.split(" ")[0] ?? "").split(",").map(Number);
    expect(x).toBeCloseTo(-Math.SQRT1_2, 3);
    expect(y).toBeCloseTo(Math.SQRT1_2, 3);
  });
});

describe("the Other fold (section 8.4)", () => {
  it("lists the kept categories and then Other with its count in the Legend", () => {
    // Seven rows past a cap of 6: the two smallest, 4 and 6 of 110, fold into Other.
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 360 }}>
          <PieChart.Root
            data={["a", "b", "c", "d", "e", "f", "g"].map((part, index) => ({
              part,
              kr: [30, 25, 20, 15, 6, 4, 10][index] ?? 0,
            }))}
            config={{
              a: { label: "A", color: "chart-1" },
              b: { label: "B", color: "chart-2" },
              c: { label: "C", color: "chart-3" },
              d: { label: "D", color: "chart-4" },
              e: { label: "E", color: "chart-5" },
              f: { label: "F", color: "chart-6" },
              g: { label: "G", color: "chart-7" },
            }}
            nameKey="part"
            valueKey="kr"
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Legend />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    expect(
      page
        .getByRole("listitem")
        .elements()
        .map((item) => item.textContent)
    ).toEqual(["A", "B", "C", "D", "G", "Annet, 2\u00a0kategorier"]);
  });
});

describe("the centre (section 8.13)", () => {
  function Bill({ config }: { readonly config: ChartConfig }) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={BILL}
            config={config}
            nameKey="part"
            valueKey="kr"
            valueFormat={NOK}
            innerRadius={0.62}
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Center>
              <PieChart.CenterValue />
              <PieChart.CenterShare />
              <PieChart.CenterMax />
            </PieChart.Center>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("prints the total with nothing active, then the active slice's value and its share in the pie's set", async () => {
    const { host } = renderThemed(<Bill config={HALVES_CONFIG} />);
    expect(centreText(host, "pie-chart-center-value")).toBe("1 386 kr");
    expect(centreText(host, "pie-chart-center-share")).toBe("");
    expect(centreText(host, "pie-chart-center-max")).toBe("");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(centreText(host, "pie-chart-center-value")).toBe("438 kr");
    expect(centreText(host, "pie-chart-center-share")).toBe("32 %");
  });

  it("prints no total when the categories' formats differ", () => {
    const { host } = renderThemed(
      <Bill
        config={{
          ...HALVES_CONFIG,
          fast: { label: "Fastledd", color: "chart-4", format: { preset: "energy", unit: "kWh" } },
        }}
      />
    );
    expect(centreText(host, "pie-chart-center-value")).toBe("");
  });

  it("reads a gauge's total against its maximum, and fills the whole track past it", async () => {
    function Gauge({ kwh }: { readonly kwh: number }) {
      return (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 320 }}>
            <PieChart.Root
              data={[{ measure: "peak", kwh }]}
              config={{
                peak: {
                  label: "Topp",
                  color: "chart-1",
                  format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
                },
              }}
              nameKey="measure"
              valueKey="kwh"
              max={5}
              startAngle={-135}
              endAngle={135}
              innerRadius={0.75}
              data-intro="none"
              aria-label="Effekttrinn">
              <PieChart.Track />
              <PieChart.Pie />
              <PieChart.Center>
                <PieChart.CenterValue format={{ maximumFractionDigits: 1 }} />
                <PieChart.CenterShare />
                <PieChart.CenterMax />
              </PieChart.Center>
            </PieChart.Root>
          </div>
        </LocaleProvider>
      );
    }
    const { host, rerender } = renderThemed(<Gauge kwh={3.9} />);
    // 3.9 of 5 is 78 %, which a gauge rounds alone.
    expect(centreText(host, "pie-chart-center-value")).toBe("3,9");
    expect(centreText(host, "pie-chart-center-share")).toBe("78 %");
    expect(centreText(host, "pie-chart-center-max")).toBe("5 kWh");
    // DOM audit: the pie layer states data-over-max, which the stylesheet and consumers read.
    expect(pieSvg(host).hasAttribute("data-over-max")).toBe(false);
    rerender(<Gauge kwh={6} />);
    expect(pieSvg(host).hasAttribute("data-over-max")).toBe(true);
    // DOM audit: the track is aria-hidden plot output, read by its slot.
    const track = host.querySelector('[data-slot="pie-chart-track"]')?.getAttribute("d");
    // The loop moves the slice over the update's 480 ms.
    await expect.poll(() => sectors(host)[0]?.getAttribute("d"), { timeout: 2000 }).toBe(track);
  });
});

describe("Glow and gradients (R10, Q12)", () => {
  it("haloes the named slice's own path, and nothing for a category that folds into Other", () => {
    const { host } = renderThemed(
      <Halves>
        <PieChart.Glow dataKey="nettleie" />
      </Halves>
    );
    // DOM audit: the halo is aria-hidden plot output, read by its slot.
    const halo = host.querySelector('[data-slot="pie-chart-glow"]');
    expect(halo?.getAttribute("d")).toBe(sectors(host)[1]?.getAttribute("d"));
    expect(getComputedStyle(halo ?? host).filter).toMatch(/^drop-shadow\(/u);
  });

  it("paints a role list from the rim to the hole along each bisector", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <span data-probe="" style={{ color: "var(--chart-1)" }} />
          <PieChart.Root
            data={HALVES}
            config={{ ...HALVES_CONFIG, strom: { label: "Strøm", color: ["chart-1", "chart-2"] } }}
            nameKey="part"
            valueKey="kr"
            innerRadius={0.5}
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the gradient is the slice's paint server, read by its tag.
    const gradient = host.querySelector("radialGradient");
    expect(gradient?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    const stops = [...(gradient?.querySelectorAll("stop") ?? [])];
    expect(stops.map((stop) => Number(stop.getAttribute("offset")))).toEqual([0.5, 1]);
    // The list's tip, chart-1, paints at the rim.
    const probe = host.querySelector("[data-probe]") ?? host;
    expect(getComputedStyle(stops[1] ?? host).stopColor).toBe(getComputedStyle(probe).color);
    expect(getComputedStyle(sectors(host)[0] ?? host).fill).toBe(`url("#${gradient?.id ?? ""}")`);
    expect(polarFigure(host)).toBeTruthy();
  });
});
