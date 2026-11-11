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

describe("a folded category named by its key", () => {
  // Eight categories under the default cap of 6: the five largest draw, and f, g and h, 6, 4 and 2
  // of 112, fold into Other. Each config key keeps its config label and paint, the consumer's
  // --chart-color-<key> first, and its own reading in the point's values, which Other, naming no
  // config key, is not a key of.
  const KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
  const VALUES = [30, 25, 20, 15, 10, 6, 4, 2];
  const config = {
    a: { label: "A", color: "chart-1" },
    b: { label: "B", color: "chart-2" },
    c: { label: "C", color: "chart-3" },
    d: { label: "D", color: "chart-4" },
    e: { label: "E", color: "chart-5" },
    f: { label: "F", color: "chart-6" },
    g: { label: "G", color: "chart-7" },
    h: { label: "H", color: "chart-8" },
  } as const satisfies ChartConfig;
  const data = KEYS.map((part, index) => ({ part, kr: VALUES[index] ?? 0 }));

  /** Prints the active point's values, as a consumer's headline would read them. */
  function ValuesProbe() {
    const point = useChartPoint();
    return <output data-values="">{point === null ? "none" : JSON.stringify(point.values)}</output>;
  }

  it("shows the config label and paint in a LegendItem and a Swatch for a folded key", async () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 360 }}>
          <PieChart.Root
            data={data}
            config={config}
            nameKey="part"
            valueKey="kr"
            data-intro="none"
            aria-label="Regning">
            <PieChart.Pie />
            <ul>
              <PieChart.LegendItem dataKey="g" />
            </ul>
          </PieChart.Root>
        </div>
      </LocaleProvider>
    );
    await nextFrames(1);
    const item = page.getByRole("listitem").element();
    expect(item.textContent).toBe("G");
    // A folded key draws no slice, so it carries no series ordinal.
    expect(item.hasAttribute("data-series")).toBe(false);
    // The swatch is aria-hidden decoration, read by its slot.
    const swatch = host.querySelector<HTMLElement>('[data-slot="chart-swatch"]');
    expect(swatch?.style.getPropertyValue("--chart-swatch-paint")).toBe(
      "var(--chart-color-g, var(--chart-7))"
    );
    expect(swatch?.hasAttribute("data-series")).toBe(false);
  });

  it("keys the point's values by config key, the folded ones included, and Other by none", async () => {
    renderThemed(
      <LocaleProvider locale="nb-NO">
        <PieChart.Root data={data} config={config} nameKey="part" valueKey="kr" aria-label="Regning">
          <ValuesProbe />
        </PieChart.Root>
      </LocaleProvider>
    );
    await userEvent.tab();
    // The probe is the test's own output, read by its attribute.
    const shown = document.querySelector("[data-values]")?.textContent ?? "";
    expect(JSON.parse(shown)).toEqual({ a: 30, b: 25, c: 20, d: 15, e: 10, f: 6, g: 4, h: 2 });
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
    // The slices are aria-hidden plot output, read by their slot.
    expect(sectors(host).at(-1)?.getAttribute("data-quality") ?? undefined).toBe(drawn);
    // Other is the second option, a step from the first.
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Annet, 2\u00a0kategorier: ${spoken}`);
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

  it("reads a gauge's total against its maximum, and marks a value past it", () => {
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
    // The pie layer states data-over-max, which the stylesheet and consumers read.
    expect(pieSvg(host).hasAttribute("data-over-max")).toBe(false);
    rerender(<Gauge kwh={6} />);
    expect(pieSvg(host).hasAttribute("data-over-max")).toBe(true);
  });
});

describe("the centre's name line (CenterName)", () => {
  // Unit under test: CenterName. Oracle: the config's labels, "Nettleie" for the slice the pointer
  // is on and "Elbil" for the ring the keys reach, and the children with nothing active, as
  // CenterValue prints the active item's value and, at rest, the total.
  const nameOf = (host: HTMLElement): string | null =>
    // The centre is aria-hidden plot text, read by its slot.
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
    // The centre is aria-hidden plot text, read by its slot.
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
    // The centre is aria-hidden plot output, read by its slot.
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
