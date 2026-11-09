// PieChart's marks and readouts in Chromium. Units under test: PieChart.Pie, Labels, the Center
// parts, Track, Glow and the polar LegendToggleGroup. Oracles, written by hand: d3's pie rule over
// the rows, each slice spanning its value's share of 360°; the browser's own fill test, which the
// pick must agree with (Q8); CONTRACT section 8.4's on-colour label rule over the theme's
// `chart-*-foreground` roles; section 8.13's centre table with the largest-remainder shares; D3's
// pop and S2's dims; R10's halo; Q12's gradient; and S9's category word.
import { Profiler, useEffect, useState } from "react";

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  activeSlice,
  centreText,
  clientPoint,
  dialPoint,
  hoverAt,
  pieSvg,
  polarFigure,
  sectors,
} from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig, ChartQuality, ValueFormat } from "./chart-types";
import "./chart.css";
import { PieChart } from "./pie-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";
import { useChartPoint } from "./use-chart-point";

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
    await nextFrames(1);

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

/** A label template that grows to a sentence on the window's `grow` event, with no render of Labels. */
function GrowingLabel() {
  const [long, setLong] = useState(false);
  useEffect(() => {
    const grow = () => setLong(true);
    window.addEventListener("grow", grow);
    return () => window.removeEventListener("grow", grow);
  }, []);
  return long ? "En etikett som er langt bredere enn hele kaken" : "Ok";
}

describe("labels whose own size changes (A1-06)", () => {
  it("moves a label outside once its template grows too wide for its slice", async () => {
    // Two halves of a 320 px dial, each in a role with an on-colour. A two-letter label fits inside
    // its half; the same label grown to a sentence is far wider than the dial's radius, so it no
    // longer fits its slice and, as the Labels JSDoc says, draws outside with a leader. Only the
    // template's own state changes, as when a web font swaps in, so Labels never renders again.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={[
              { part: "strom", kr: 50 },
              { part: "nettleie", kr: 50 },
            ]}
            config={{
              strom: { label: "Strøm", color: "chart-1" },
              nettleie: { label: "Nettleie", color: "chart-2" },
            }}
            nameKey="part"
            valueKey="kr"
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Labels>
              <GrowingLabel />
            </PieChart.Labels>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: labels are aria-hidden plot output, read by their slot.
    const placements = () =>
      [...host.querySelectorAll('[data-slot="pie-chart-label"]')].map((label) =>
        label.getAttribute("data-placement")
      );
    expect(placements()).toEqual(["inside", "inside"]);
    window.dispatchEvent(new Event("grow"));
    await expect.poll(placements).toEqual(["outside", "outside"]);
  });
});

/** Prints the active point's qualities, as a consumer's headline would read them. */
function QualityProbe() {
  const point = useChartPoint();
  return <output>{point === null ? "none" : JSON.stringify(point.quality)}</output>;
}

describe("the active point's qualities (B8)", () => {
  // Two readings with no quality column, which the ChartPoint contract counts as measured.
  const bill = [
    { part: "strom", kr: 1 },
    { part: "nettleie", kr: 2 },
  ];
  const config = {
    strom: { label: "Strøm", color: "chart-1" },
    nettleie: { label: "Nettleie", color: "chart-2" },
  } as const;

  it.each([
    [
      "pie",
      <PieChart.Root key="pie" data={bill} config={config} nameKey="part" valueKey="kr" aria-label="Regning">
        <QualityProbe />
      </PieChart.Root>,
    ],
    [
      "radial",
      <RadialChart.Root
        key="radial"
        data={bill}
        config={config}
        nameKey="part"
        valueKey="kr"
        aria-label="Ringer">
        <QualityProbe />
      </RadialChart.Root>,
    ],
  ])("reports each measured %s reading as measured", async (_, chart) => {
    renderThemed(<LocaleProvider locale="nb-NO">{chart}</LocaleProvider>);
    await userEvent.tab();
    const shown = page.getByRole("status").filter({ hasText: "{" });
    expect(JSON.parse(shown.element().textContent)).toEqual({ strom: "measured", nettleie: "measured" });
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

describe("Other's quality (section 8.7, Q1)", () => {
  // A household's consumption of 60, 30 and 10 kWh under a cap of 2: 30 and 10 fold into Other's
  // 40. Folding is a drawing rule, so Other keeps the quality of the readings it holds: estimated
  // when any is estimated, corrected when any is corrected and none estimated, measured otherwise,
  // and missing only when every one is missing.
  it.each([
    [
      "estimated when one reading it holds is estimated",
      "measured",
      "estimated",
      "estimated",
      "40\u00a0kilowattimer, estimert, 40\u00a0prosent",
    ],
    [
      "estimated over corrected",
      "corrected",
      "estimated",
      "estimated",
      "40\u00a0kilowattimer, estimert, 40\u00a0prosent",
    ],
    [
      "corrected when one reading it holds is corrected",
      "corrected",
      "measured",
      "corrected",
      "40\u00a0kilowattimer, korrigert, 40\u00a0prosent",
    ],
    [
      "measured when every reading it holds is",
      "measured",
      "measured",
      undefined,
      "40\u00a0kilowattimer, 40\u00a0prosent",
    ],
  ] as const)("draws and names Other %s", async (_, second, third, drawn, spoken) => {
    const rows: { readonly use: string; readonly kwh: number; readonly q: ChartQuality }[] = [
      { use: "varme", kwh: 60, q: "measured" },
      { use: "lys", kwh: 30, q: second },
      { use: "elbil", kwh: 10, q: third },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={rows}
            config={{
              varme: { label: "Varme", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
              lys: { label: "Lys", color: "chart-2", format: { preset: "energy", unit: "kWh" } },
              elbil: { label: "Elbil", color: "chart-3", format: { preset: "energy", unit: "kWh" } },
            }}
            nameKey="use"
            valueKey="kwh"
            qualityKey="q"
            maxSlices={2}
            valueFormat={{ preset: "energy", unit: "kWh" }}
            data-intro="none"
            aria-label="Forbruk">
            <PieChart.Pie />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the slices are aria-hidden plot output, read by their slot.
    expect(sectors(host).at(-1)?.getAttribute("data-quality") ?? undefined).toBe(drawn);
    // Other is the second option, a step from the first.
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Annet, 2\u00a0kategorier: ${spoken}`);
  });
});

describe("outside labels before the entrance (D18)", () => {
  it("keeps the room for its outside labels while the pie waits to come into view", async () => {
    // The docs' server-component bill: Monthly fee's 49 of 1,386 kr is a 12.7° slice ending at
    // 12 o'clock, whose outside label sits above the dial, in the room the frame keeps above it. A
    // pie below the fold waits for its entrance, and the first paint must hold the rest layout, so
    // the room stays and every label lies inside the Root.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 560, marginTop: "300vh" }}>
          <PieChart.Root
            data={[
              { part: "energy", kr: 612 },
              { part: "grid", kr: 438 },
              { part: "taxes", kr: 287 },
              { part: "fee", kr: 49 },
            ]}
            config={{
              energy: { label: "Energi", color: "chart-1" },
              grid: { label: "Nettleie", color: "chart-2" },
              taxes: { label: "Avgifter", color: "chart-3" },
              fee: { label: "Fastledd", color: "chart-4" },
            }}
            nameKey="part"
            valueKey="kr"
            innerRadius={0.62}
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Labels position="outside" />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(2);
    // DOM audit: the figure, its labels layer and its labels are the Root's own plot output.
    const figure = host.querySelector<HTMLElement>("[data-polar]");
    expect(figure?.hasAttribute("data-drawn")).toBe(false);
    expect(host.querySelector('[data-slot="pie-chart-labels"]')?.hasAttribute("data-outside")).toBe(true);
    const box = figure?.getBoundingClientRect() ?? new DOMRect();
    const outside = [...host.querySelectorAll('[data-slot="pie-chart-label"]')].filter((label) => {
      const at = label.getBoundingClientRect();
      return (
        at.top < box.top - 0.5 ||
        at.bottom > box.bottom + 0.5 ||
        at.left < box.left - 0.5 ||
        at.right > box.right + 0.5
      );
    });
    expect(outside.map((label) => label.textContent)).toEqual([]);
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

  // B4 and r4 Q2: two formats that name the same options, in another key order or with an option
  // set to undefined, which prints as if omitted, are one format. Unit under test: the centre's
  // total, maximum and share. Oracle: the same chart with identical formats.
  const energy: ValueFormat = { preset: "energy", unit: "kWh" };
  it.each(
    (["pie", "radial"] as const).flatMap((family) => [
      [family, "another key order", { unit: "kWh", preset: "energy" }] as const,
      [
        family,
        "an option set to undefined",
        { preset: "energy", unit: "kWh", maximumFractionDigits: undefined },
      ] as const,
    ])
  )(
    "prints a %s's totals for formats that differ only in %s, as for identical ones",
    (family, _, variant: ValueFormat) => {
      const centre = (second: ValueFormat): string[] => {
        const config = {
          varme: { label: "Varme", color: "chart-1", format: energy },
          elbil: { label: "Elbil", color: "chart-2", format: second },
        } as const;
        const data = [
          { use: "varme", kwh: 100, limit: 200 },
          { use: "elbil", kwh: 50, limit: 100 },
        ];
        const parts = (
          <>
            <PieChart.CenterValue />
            <PieChart.CenterShare />
            <PieChart.CenterMax />
          </>
        );
        const { host, unmount } = renderThemed(
          <LocaleProvider locale="nb-NO">
            <div style={{ width: 320 }}>
              {family === "pie" ? (
                <PieChart.Root
                  data={data}
                  config={config}
                  nameKey="use"
                  valueKey="kwh"
                  innerRadius={0.6}
                  data-intro="none"
                  aria-label="Forbruk">
                  <PieChart.Pie />
                  <PieChart.Center>{parts}</PieChart.Center>
                </PieChart.Root>
              ) : (
                <RadialChart.Root
                  data={data}
                  config={config}
                  nameKey="use"
                  valueKey="kwh"
                  maxKey="limit"
                  data-intro="none"
                  aria-label="Forbruk">
                  <RadialChart.Bar />
                  <RadialChart.Center>{parts}</RadialChart.Center>
                </RadialChart.Root>
              )}
            </div>
          </LocaleProvider>
        );
        const texts = ["pie-chart-center-value", "pie-chart-center-share", "pie-chart-center-max"].map(
          (part) => centreText(host, part)
        );
        unmount();
        return texts;
      };
      const identical = centre(energy);
      // 100 and 50 kWh print a total either way, and a radial chart their 150 of 300 too.
      expect(identical[0]).not.toBe("");
      if (family === "radial") expect(identical.slice(1).every((text) => text !== "")).toBe(true);
      expect(centre(variant)).toEqual(identical);
    }
  );

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

describe("the centre's name line (CenterName)", () => {
  // Unit under test: CenterName. Oracle: the config's labels, "Nettleie" for the slice the pointer
  // is on and "Elbil" for the ring the keys reach, and the children with nothing active, as
  // CenterValue prints the active item's value and, at rest, the total.
  const nameOf = (host: HTMLElement): string | null =>
    // DOM audit: the centre is aria-hidden plot text, read by its slot.
    host.querySelector('[data-slot="pie-chart-center-name"]')?.textContent ?? null;

  it("names the slice under the pointer, and prints its children at rest", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={BILL}
            config={HALVES_CONFIG}
            nameKey="part"
            valueKey="kr"
            valueFormat={NOK}
            innerRadius={0.62}
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Center>
              <PieChart.CenterValue />
              <PieChart.CenterName>Totalt</PieChart.CenterName>
            </PieChart.Center>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    expect(nameOf(host)).toBe("Totalt");
    expect(centreText(host, "pie-chart-center-value")).toBe("1\u00a0386\u00a0kr");
    // Strøm's 44.16 % spans 0° to 159.0°, and Nettleie's 31.60 % from there to 272.7°.
    const point = dialPoint(215, 0.8);
    await hoverAt(...clientPoint(pieSvg(host), point.x, point.y));
    expect(nameOf(host)).toBe("Nettleie");
    expect(centreText(host, "pie-chart-center-value")).toBe("438\u00a0kr");
    // The pointer leaves the plot for the page, and after the leave's grace the centre rests.
    page
      .getByRole("listbox")
      .element()
      .dispatchEvent(
        new PointerEvent("pointerout", {
          bubbles: true,
          relatedTarget: document.body,
          pointerType: "mouse",
          clientX: 0,
          clientY: 0,
        })
      );
    await expect.poll(() => nameOf(host)).toBe("Totalt");
    expect(centreText(host, "pie-chart-center-value")).toBe("1\u00a0386\u00a0kr");
  });

  it("commits once per slice it names, never on a pointer move within the slice", async () => {
    // Unit under test: CenterName's renders. Oracle: CONTRACT section 4's cost rule, a part that
    // follows the active item commits when it changes and never on a move within it.
    let commits = 0;
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={BILL}
            config={HALVES_CONFIG}
            nameKey="part"
            valueKey="kr"
            valueFormat={NOK}
            innerRadius={0.62}
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <PieChart.Center>
              <Profiler
                id="name"
                onRender={() => {
                  commits += 1;
                }}>
                <PieChart.CenterName>Totalt</PieChart.CenterName>
              </Profiler>
            </PieChart.Center>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    const svg = pieSvg(host);
    const at = (angle: number) => {
      const point = dialPoint(angle, 0.8);
      return clientPoint(svg, point.x, point.y);
    };
    commits = 0;
    // Three moves inside Nettleie, from 159.0° to 272.7°, then one into Avgifter, to 347.3°.
    for (const angle of [200, 215, 230]) await hoverAt(...at(angle));
    expect(nameOf(host)).toBe("Nettleie");
    expect(commits).toBe(1);
    await hoverAt(...at(300));
    expect(nameOf(host)).toBe("Avgifter");
    expect(commits).toBe(2);
  });

  it("names the active ring, beside a CenterLabel that keeps its children and its maximum", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <RadialChart.Root
            data={[
              { use: "varme", kwh: 100, limit: 200 },
              { use: "elbil", kwh: 50, limit: 100 },
            ]}
            config={{
              varme: { label: "Varme", color: "chart-1" },
              elbil: { label: "Elbil", color: "chart-2" },
            }}
            nameKey="use"
            valueKey="kwh"
            maxKey="limit"
            valueFormat={{ preset: "energy", unit: "kWh" }}
            data-intro="none"
            aria-label="Forbruk">
            <RadialChart.Bar />
            <RadialChart.Center>
              <RadialChart.CenterValue />
              <RadialChart.CenterName>I alt</RadialChart.CenterName>
              <RadialChart.CenterLabel>
                av <RadialChart.CenterMax />
              </RadialChart.CenterLabel>
            </RadialChart.Center>
          </RadialChart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the centre is aria-hidden plot text, read by its slot.
    const label = host.querySelector('[data-slot="pie-chart-center-label"]');
    expect(nameOf(host)).toBe("I alt");
    expect(label?.firstChild?.textContent).toBe("av ");
    expect(centreText(host, "pie-chart-center-max")).toBe("300\u00a0kWh");
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect([centreText(host, "pie-chart-center-value"), nameOf(host)]).toEqual(["50\u00a0kWh", "Elbil"]);
    expect(label?.firstChild?.textContent).toBe("av ");
    expect(centreText(host, "pie-chart-center-max")).toBe("100\u00a0kWh");
  });
});

describe("the pick at the dial's centre", () => {
  // Unit under test: the polar pick. Oracle: a point within 2 CSS px of the centre has no angle to
  // read, so it keeps the slice the pointer holds; 3 px out, toward 3 o'clock, it reads Strøm, whose
  // slice spans 0° to 159.0°.
  it("keeps the held slice at the centre, and picks again 3 px out", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={BILL}
            config={HALVES_CONFIG}
            nameKey="part"
            valueKey="kr"
            valueFormat={NOK}
            innerRadius={0.62}
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    const svg = pieSvg(host);
    const point = dialPoint(215, 0.8);
    await hoverAt(...clientPoint(svg, point.x, point.y));
    expect(activeSlice(host)).toBe(1);
    const [x, y] = clientPoint(svg, 0, 0);
    await hoverAt(x, y);
    expect(activeSlice(host)).toBe(1);
    await hoverAt(x + 1, y + 1);
    expect(activeSlice(host)).toBe(1);
    await hoverAt(x + 3, y);
    expect(activeSlice(host)).toBe(0);
  });
});

describe("the centre's text floor and fit guard", () => {
  // A 200 px dial, R = 100 px, holds a hole square of side √2 · inner · 100: inner radii of 0.2121,
  // 0.3394 and 0.5657 give squares of 30, 48 and 80 px. The value, 18 370 kWh, needs about 38 px for
  // its number at the 12 px floor, and the label "Totalt i år" needs more than 48 px.
  function Total({
    inner,
    money = false,
    kwh = [12_000, 6370],
  }: {
    readonly inner: number;
    readonly money?: boolean;
    readonly kwh?: readonly [number, number];
  }) {
    return (
      <LocaleProvider locale={money ? "en-US" : "nb-NO"}>
        <div style={{ width: 320 }}>
          <PieChart.Root
            data={[
              { part: "varme", kwh: kwh[0] },
              { part: "lys", kwh: kwh[1] },
            ]}
            config={{
              varme: { label: "Varme", color: "chart-1" },
              lys: { label: "Lys", color: "chart-2" },
            }}
            nameKey="part"
            valueKey="kwh"
            valueFormat={
              money
                ? { style: "currency", currency: "NOK", maximumFractionDigits: 0 }
                : { preset: "energy", unit: "kWh" }
            }
            innerRadius={inner}
            data-intro="none"
            aria-label="Forbruk">
            <PieChart.Pie />
            <PieChart.Center>
              <PieChart.CenterValue />
              <PieChart.CenterLabel>Totalt i år</PieChart.CenterLabel>
            </PieChart.Center>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The hole, its value and its label, by their slots and parts. */
  function parts(host: HTMLElement) {
    // DOM audit: the centre is aria-hidden plot text, read by its slot and part.
    const hole = host.querySelector<HTMLElement>('[data-slot="pie-chart-center"] > [data-part="hole"]');
    const value = host.querySelector<HTMLElement>('[data-slot="pie-chart-center-value"]');
    const label = host.querySelector<HTMLElement>('[data-slot="pie-chart-center-label"]');
    if (hole === null || value === null || label === null) throw new Error("no centre");
    return { hole, value, label };
  }

  it.each([
    [0.2121, 30],
    [0.3394, 48],
    [0.5657, 80],
  ])("lays a hole of inner radius %s out as a %s px square", async (inner, side) => {
    const { host } = renderThemed(<Total inner={inner} />);
    await nextFrames(2);
    expect(parts(host).hole.getBoundingClientRect().width).toBeCloseTo(side, 0);
  });

  it("drops the whole centre in a 30 px hole, where the number alone overflows", async () => {
    const { host } = renderThemed(<Total inner={0.2121} />);
    await nextFrames(2);
    const { hole, value } = parts(host);
    expect(hole.getAttribute("data-fit")).toBe("none");
    expect(getComputedStyle(value).display).toBe("none");
  });

  it("drops a value that fits the 30 px square but comes within 2 px of the hole's edge", async () => {
    const { host } = renderThemed(<Total inner={0.2121} kwh={[1413, 300]} />);
    await nextFrames(2);
    const { hole, value } = parts(host);
    // 1 713 kWh wraps to "1 713" over "kWh" at the 12 px floor. Four 6 px figures and the group
    // space make the number about 27 px wide on a 14.4 px line, so it fits the 30 px square, but its
    // top corners lie about 19.7 px from the centre, past the hole's 21.2 px radius less the 2 px
    // every label keeps (19.2 px), so the guard drops it.
    expect(hole.getAttribute("data-fit")).toBe("none");
    expect(getComputedStyle(value).display).toBe("none");
  });

  it("keeps the value alone in a 48 px hole, at the 12 px floor and on two lines", async () => {
    const { host } = renderThemed(<Total inner={0.3394} />);
    await nextFrames(2);
    const { hole, value, label } = parts(host);
    // A hole under 4rem leaves the label out, and the value then fits on its own.
    expect(hole.getAttribute("data-fit")).not.toBe("none");
    expect(getComputedStyle(label).display).toBe("none");
    expect(getComputedStyle(value).fontSize).toBe("12px");
    // Two lines of 12 px at a 1.2 line height.
    expect(value.getBoundingClientRect().height).toBeGreaterThanOrEqual(2 * 12 * 1.2 - 0.5);
  });

  it("shows the value and the label in an 80 px hole", async () => {
    const { host } = renderThemed(<Total inner={0.5657} />);
    await nextFrames(2);
    const { hole, value, label } = parts(host);
    expect(hole.hasAttribute("data-fit")).toBe(false);
    expect(getComputedStyle(value).display).not.toBe("none");
    expect(getComputedStyle(label).display).not.toBe("none");
    expect(Number.parseFloat(getComputedStyle(label).fontSize)).toBeGreaterThanOrEqual(12);
  });

  it("wraps a currency written before its number, NOK 18,370, onto two lines in an 80 px hole", async () => {
    const { host } = renderThemed(<Total inner={0.5657} money />);
    await nextFrames(2);
    const { hole, value } = parts(host);
    // en-US writes "NOK 18,370", about 90 px at the hole's font size, so it fits only when the code
    // and the number break apart, the code on the first line.
    expect(hole.getAttribute("data-fit")).not.toBe("none");
    expect(getComputedStyle(value).display).not.toBe("none");
    // DOM audit: the value's number and unit are aria-hidden plot text, read by their parts.
    const code = value.querySelector('[data-part="unit"]');
    const number = value.querySelector('[data-part="number"]');
    if (code === null || number === null) throw new Error("no parts");
    expect(code.textContent).toBe("NOK");
    expect(code.getBoundingClientRect().bottom).toBeLessThanOrEqual(number.getBoundingClientRect().top + 0.5);
  });
});

describe("a default active category and the fold (L3)", () => {
  // Eight appliance categories and seven rows, so the default six-slice cap keeps five and folds the
  // two smallest, lys and lading, into Other. L3: a folding pie starts on Other when
  // `defaultActiveKey` names a folded category. A category with no row is in no slice and folds into
  // nothing, so the pie starts with nothing active, and CenterName prints its children.
  const appliances = {
    varme: { label: "Varme", color: "chart-1" },
    vann: { label: "Varmtvann", color: "chart-2" },
    kjokken: { label: "Kjøkken", color: "chart-3" },
    vask: { label: "Vask", color: "chart-4" },
    tork: { label: "Tørk", color: "chart-5" },
    lys: { label: "Lys", color: "chart-6" },
    lading: { label: "Lading", color: "chart-7" },
    bad: { label: "Bad", color: "chart-8" },
  } satisfies ChartConfig;
  const rows = [
    { part: "varme", kwh: 420 },
    { part: "vann", kwh: 210 },
    { part: "kjokken", kwh: 120 },
    { part: "vask", kwh: 80 },
    { part: "tork", kwh: 60 },
    { part: "lys", kwh: 30 },
    { part: "lading", kwh: 20 },
  ];
  const centreName = (key: keyof typeof appliances) => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
        <PieChart.Root
          data={rows}
          config={appliances}
          nameKey="part"
          valueKey="kwh"
          defaultActiveKey={key}
          aria-label="Forbruk per apparat">
          <PieChart.Pie />
          <PieChart.Center>
            <PieChart.CenterValue />
            <PieChart.CenterName>Totalt</PieChart.CenterName>
          </PieChart.Center>
        </PieChart.Root>
      </LocaleProvider>
    );
    // DOM audit: the centre is aria-hidden plot output, read by its slot.
    return host.querySelector('[data-slot="pie-chart-center-name"]')?.textContent ?? null;
  };

  it("starts with nothing active when the default names a category with no row", () => {
    expect(centreName("bad")).toBe("Totalt");
  });

  it("starts on Other when the default names a folded category", () => {
    // The count joins its word with a no-break space.
    expect(centreName("lading")).toBe("Annet, 2\u00a0kategorier");
  });

  it("starts on the slice when the default names a kept category", () => {
    expect(centreName("vann")).toBe("Varmtvann");
  });
});
