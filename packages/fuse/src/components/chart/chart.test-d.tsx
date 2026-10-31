/**
 * Positive type cases of CONTRACT.md section 14, ported from the contract's revision check. The
 * TypeScript checker is the oracle, and each case compiles with no cast. `package-check-chart-types.ts` runs this file against
 * the packed `.d.ts` under TypeScript 7.0.2 and 5.9.3, with and without `exactOptionalPropertyTypes`.
 */
import type { ReactElement } from "react";

import { expectTypeOf, test } from "vitest";

import {
  AreaChart,
  BarChart,
  Chart,
  formatChartSlot,
  formatChartValue,
  LineChart,
  PieChart,
  RadarChart,
  RadialChart,
  Sparkline,
  useChartPoint,
} from "@elmeragroup/fuse/chart";
import type {
  ChartConfig,
  ChartPeriod,
  ChartPoint,
  ChartQuality,
  ChartRootProps,
  ChartRow,
  ChartSeriesConfig,
  ChartXKey,
  FormattedText,
  PieChartRootProps,
  SupportedLocale,
} from "@elmeragroup/fuse/chart";

const months = [
  { month: "jan", desktop: 186, mobile: 80 },
  { month: "feb", desktop: 305, mobile: 200 },
];
const hours = [{ start: new Date(0), kwh: 0.4, price: 1.2 }];
const browsers = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
] as const;
const spokes = [{ cat: "Hus", a: 1, b: -2 }];

test("the S15 Forbruk og pris composition compiles with no cast", () => {
  type Day = { day: Date; kwh: number | null; kwhQuality: ChartQuality | null; price: number | null };
  const config = {
    kwh: {
      label: "Forbruk",
      color: "chart-1",
      format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
      qualityKey: "kwhQuality",
    },
    price: {
      label: "Spotpris",
      color: "chart-2",
      format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
    },
  } as const satisfies ChartConfig;

  function MonthPanels({ days, month, now }: { days: readonly Day[]; month: ChartPeriod; now: Date }) {
    return (
      <Chart.Root
        data={days}
        config={config}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        period={month}
        now={now}
        aria-label="Forbruk og spotpris i oktober">
        <Chart.Panel series={["kwh"]}>
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.Bar dataKey="kwh" emphasis="now" />
          <Chart.Crosshair variant="band" />
        </Chart.Panel>
        <Chart.Panel series={["price"]}>
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.XAxis />
          <Chart.Line dataKey="price" curve="step-after" />
          <Chart.Crosshair />
        </Chart.Panel>
        <Chart.LegendToggleGroup />
        <Chart.Tooltip />
        <Chart.Empty />
        <Chart.Table />
      </Chart.Root>
    );
  }
  const row = { hourlyPrice: [1.2, null, 0.8], day: new Date(0), label: "1. oktober" };
  const sparkline = (
    <Sparkline
      data={row.hourlyPrice}
      variant="line"
      curve="step-after"
      emphasis="last"
      locale="nb-NO"
      format={{ preset: "unit-price", currency: "NOK", minor: true, vat: "included" }}
      start={row.day}
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label={`Spotpris ${row.label}`}
    />
  );
  expectTypeOf(MonthPanels).returns.toExtend<ReactElement>();
  expectTypeOf(sparkline).toExtend<ReactElement>();
});

test("the family sketches compile", () => {
  const area = (
    <AreaChart.Root
      data={months}
      config={{ desktop: { label: "Desktop", color: ["chart-1", "chart-4"] } }}
      xKey="month"
      xScale="point"
      aria-label="Besøk">
      <AreaChart.Grid variant="dashed" />
      <AreaChart.XAxis />
      <AreaChart.Glow>
        <AreaChart.Area dataKey="desktop" variant="gradient" curve="natural" />
      </AreaChart.Glow>
      <AreaChart.Tooltip variant="frosted">
        <AreaChart.TooltipLabel />
        <AreaChart.TooltipItems>
          <AreaChart.Swatch variant="circle" />
          <AreaChart.SeriesLabel />
          <AreaChart.TooltipValue />
        </AreaChart.TooltipItems>
      </AreaChart.Tooltip>
      <AreaChart.Legend side="top" />
    </AreaChart.Root>
  );
  const donut = (
    <PieChart.Root
      data={browsers}
      config={{
        chrome: { label: "Chrome", color: "chart-1" },
        safari: { label: "Safari", color: "chart-seq-4" },
      }}
      nameKey="browser"
      valueKey="visitors"
      innerRadius={0.62}
      aria-label="Nettlesere">
      <PieChart.Pie cornerRadius={0.04} />
      <PieChart.Labels position="outside" />
      <PieChart.Center>
        <PieChart.CenterValue />
        <PieChart.CenterLabel>besøk</PieChart.CenterLabel>
      </PieChart.Center>
      <PieChart.Tooltip>
        <PieChart.TooltipItems>
          <PieChart.SeriesLabel />
          <PieChart.TooltipShare format={{ maximumFractionDigits: 0 }} />
        </PieChart.TooltipItems>
      </PieChart.Tooltip>
      <PieChart.Legend />
    </PieChart.Root>
  );
  const budgets = [
    { part: "kwh", used: 3.9, budget: 5 },
    { part: "kr", used: 410, budget: 500 },
  ] as const;
  const radial = (
    <RadialChart.Root
      data={budgets}
      config={{ kwh: { label: "Strøm", color: "chart-1" }, kr: { label: "Kostnad", color: "chart-2" } }}
      nameKey="part"
      valueKey="used"
      maxKey="budget"
      startAngle={-135}
      endAngle={135}
      aria-label="Budsjett">
      <RadialChart.Track />
      <RadialChart.Bar variant="dotted" />
      <RadialChart.Center>
        <RadialChart.CenterValue />
        <RadialChart.CenterLabel>av</RadialChart.CenterLabel>
        <RadialChart.CenterMax />
      </RadialChart.Center>
    </RadialChart.Root>
  );
  const radar = (
    <RadarChart.Root
      data={spokes}
      config={{
        a: { label: "A", color: "chart-1", missing: "connect" },
        b: { label: "B", color: "chart-2" },
      }}
      nameKey="cat"
      defaultActiveName="Hus"
      aria-label="Profil">
      <RadarChart.Grid variant="circle" />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis format={{ maximumFractionDigits: 0 }} />
      <RadarChart.Glow>
        <RadarChart.Area dataKey="a" />
        <RadarChart.Line dataKey="a" />
      </RadarChart.Glow>
      <RadarChart.Dots dataKey="b" variant="ring" />
      <RadarChart.ActiveDot dataKey="a" />
    </RadarChart.Root>
  );
  for (const element of [area, donut, radial, radar]) {
    expectTypeOf(element).toExtend<ReactElement>();
  }
});

test("rows may be interfaces with Date and null cells, read-only", () => {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- the case proves that an interface row type passes.
  interface Hour {
    readonly start: Date;
    readonly kwh: number | null;
  }
  const data: readonly Hour[] = [{ start: new Date(0), kwh: null }];
  const chart = (
    <LineChart.Root
      data={data}
      config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-labelledby="heading"
    />
  );
  expectTypeOf(chart).toExtend<ReactElement>();
});

test("config keys stay literal, so callbacks report the key union and instants report a Date", () => {
  const config = {
    desktop: { label: "Desktop", color: "chart-1" },
    mobile: { label: "Mobile", color: "chart-2" },
  } satisfies ChartConfig;
  const epoch = [{ t: 0, kwh: 1 }];
  const charts = (
    <>
      <Chart.Root
        data={months}
        config={config}
        xKey="month"
        aria-label="x"
        onSelectedKeyChange={(key, details) => {
          expectTypeOf(key).toEqualTypeOf<"desktop" | "mobile" | null>();
          expectTypeOf(details.reason).toEqualTypeOf<"legend" | "plot" | "keyboard">();
        }}
        onXRangeCommitted={(range) => {
          expectTypeOf(range[0]).toEqualTypeOf<string>();
        }}
      />
      <Chart.Root
        data={hours}
        config={{ kwh: { label: "k", color: "chart-1" } }}
        xKey="start"
        interval="hour"
        timeZone="Europe/Oslo"
        defaultXRange={[0, new Date(3_600_000)]}
        defaultActiveX={new Date(0)}
        aria-label="x"
        onXRangeCommitted={(range, details) => {
          expectTypeOf(range[0]).toEqualTypeOf<Date>();
          expectTypeOf(details.reason).toEqualTypeOf<"drag" | "keyboard" | "track-press" | "input-change">();
        }}
      />
      <Chart.Root
        data={epoch}
        config={{ kwh: { label: "k", color: "chart-1" } }}
        xKey="t"
        interval="hour"
        timeZone="Europe/Oslo"
        data-intro="left"
        data-fade="past"
        aria-label="x"
        onXRangeCommitted={(range) => {
          expectTypeOf(range[1]).toEqualTypeOf<Date>();
        }}
      />
    </>
  );
  expectTypeOf(charts).toExtend<ReactElement>();
});

test("a widened config compiles under every Root", () => {
  const wide: Record<string, ChartSeriesConfig> = {};
  const charts = (
    <>
      <Chart.Root
        data={hours}
        config={wide}
        xKey="start"
        interval="hour"
        timeZone="Europe/Oslo"
        aria-label="x"
      />
      <PieChart.Root data={browsers} config={wide} nameKey="browser" valueKey="visitors" aria-label="x" />
      <RadialChart.Root data={browsers} config={wide} nameKey="browser" valueKey="visitors" aria-label="x" />
      <RadarChart.Root data={spokes} config={wide} nameKey="cat" aria-label="x" />
    </>
  );
  expectTypeOf(charts).toExtend<ReactElement>();
});

test("a pie over a string column and a four-series radar compile", () => {
  const parts: readonly { part: string; kr: number }[] = [{ part: "Strøm", kr: 410 }];
  const four = [{ cat: "Hus", a: 1, b: 2, c: 3, d: 4 }];
  const pie = (
    <PieChart.Root
      data={parts}
      config={{ Strøm: { label: "Strøm", color: "chart-1" } }}
      nameKey="part"
      valueKey="kr"
      maxSlices={4}
      otherLabel="Annet"
      defaultActiveKey="Strøm"
      aria-label="Regning"
    />
  );
  const radar = (
    <RadarChart.Root
      data={four}
      config={{
        a: { label: "A", color: "chart-1" },
        b: { label: "B", color: "chart-2" },
        c: { label: "C", color: "chart-3" },
        d: { label: "D", color: "chart-4" },
      }}
      nameKey="cat"
      aria-label="r"
    />
  );
  expectTypeOf(pie).toEqualTypeOf(radar);
});

test("wrappers typed with the default parameters accept any column", () => {
  function UsageChart(props: ChartRootProps) {
    return <Chart.Root {...props} />;
  }
  function BillPie(props: PieChartRootProps) {
    return <PieChart.Root {...props} />;
  }
  const xKey: ChartRootProps["xKey"] = "day";
  const rowKey: ChartXKey<ChartRow> = "day";
  const nameKey: PieChartRootProps["nameKey"] = "part";
  expectTypeOf(xKey).toEqualTypeOf<string>();
  expectTypeOf(rowKey).toEqualTypeOf<string>();
  expectTypeOf(nameKey).toEqualTypeOf<string>();
  const category = (
    <UsageChart
      data={months}
      config={{ desktop: { label: "D", color: "chart-1" } }}
      xKey="month"
      aria-label="x"
    />
  );
  const time = (
    <UsageChart
      data={hours}
      config={{ kwh: { label: "k", color: "chart-1" } }}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="x"
    />
  );
  const pie = <BillPie data={browsers} config={{}} nameKey="browser" valueKey="visitors" aria-label="x" />;
  for (const element of [category, time, pie]) {
    expectTypeOf(element).toExtend<ReactElement>();
  }
});

test("style takes the public custom properties with no cast", () => {
  const styled = (
    <BarChart.Root
      data={months}
      config={{ desktop: { label: "D", color: "chart-1" } }}
      xKey="month"
      style={{ "--chart-hover-dim": 1, "--chart-color-desktop": "oklch(0.7 0.12 40)" }}
      aria-label="x">
      <BarChart.Bar dataKey="desktop" style={{ "--chart-bar-radius": "2px" }} />
      <BarChart.Line dataKey="desktop" style={{ "--chart-stroke": "1.5px" }} />
      <BarChart.Legend style={{ "--chart-color-price": "red" }} />
    </BarChart.Root>
  );
  expectTypeOf(styled).toExtend<ReactElement>();
});

test("grouped bars, horizontal bars, markers, totals and table columns compose", () => {
  type Quarter = { start: Date; price: number | null };
  type Day = { day: Date; peak: number | null; peakHour: Date | null; change: number | null };
  const noQuarters: readonly Quarter[] = [];
  const noDays: readonly Day[] = [];
  const sek = {
    price: {
      label: "Spotpris",
      color: "chart-1",
      format: { preset: "unit-price", currency: "SEK", minor: true, vat: "excluded" },
    },
  } satisfies ChartConfig;
  const now = new Date(0);
  const charts = (
    <>
      <Chart.Root
        data={months}
        config={{ desktop: { label: "D", color: "chart-1" }, mobile: { label: "M", color: "chart-2" } }}
        xKey="month"
        aria-label="x">
        <Chart.BarGroup series={["desktop"]}>
          <Chart.Bar dataKey="desktop" variant="isometric" />
        </Chart.BarGroup>
        <Chart.Line dataKey="mobile" />
        <Chart.ActiveDot dataKey="mobile" variant="ping" />
      </Chart.Root>
      <BarChart.Root
        data={months}
        config={{ desktop: { label: "D", color: "chart-1" } }}
        xKey="month"
        orientation="horizontal"
        aria-label="x">
        <BarChart.XAxis />
        <BarChart.YAxis format={{ maximumFractionDigits: 0 }} side="end" />
        <BarChart.Bar dataKey="desktop" variant="striped" />
      </BarChart.Root>
      <LineChart.Root
        data={noQuarters}
        config={sek}
        xKey="start"
        interval="quarter-hour"
        timeZone="Europe/Stockholm"
        now={now}
        aria-label="Spotpris">
        <LineChart.Headline>
          <LineChart.ActiveValue dataKey="price" fallback="now" />
        </LineChart.Headline>
        <LineChart.Line dataKey="price" curve="step-after" />
        <LineChart.Marker dataKey="price" at="now" variant="halo" />
        <LineChart.Marker dataKey="price" at="min">
          <LineChart.ValueLabel />
        </LineChart.Marker>
        <LineChart.ActiveValueLine dataKey="price">
          <LineChart.ValueLabel />
        </LineChart.ActiveValueLine>
        <LineChart.ReferenceLine x={now} label="Nå {value}" format="time" variant="dashed" />
        <LineChart.ReferenceLine y={2.2} label="Snitt {value}" tone="muted" />
        <LineChart.ReferenceArea y1={5} y2={10} label="Trinn 3" tone="error" />
      </LineChart.Root>
      <BarChart.Root
        data={noDays}
        config={{ peak: { label: "Høyeste time", color: "chart-1", stack: "total" } }}
        xKey="day"
        interval="day"
        timeZone="Europe/Oslo"
        aria-label="x">
        <BarChart.Bar dataKey="peak" emphasis={{ x: [new Date(0)] }} emphasisLabel="topp" />
        <BarChart.Tooltip anchor="top">
          <BarChart.TooltipLabel format="weekday" />
          <BarChart.TooltipItems>
            <BarChart.SeriesIcon />
            <BarChart.TooltipValue />
          </BarChart.TooltipItems>
          <BarChart.TooltipTotal stack="total" label="Sum" />
        </BarChart.Tooltip>
        <BarChart.Table caption="Toppene" showLabel="Vis" hideLabel="Skjul">
          <BarChart.TableColumn dataKey="peakHour" header="Time" format="hour-range" />
          <BarChart.TableColumn
            dataKey="change"
            header="Endring"
            format={{ style: "percent", maximumFractionDigits: 1 }}
          />
        </BarChart.Table>
        <BarChart.Brush minSpan={7} format="date">
          <BarChart.BrushPreview>
            <BarChart.Bar dataKey="peak" />
          </BarChart.BrushPreview>
        </BarChart.Brush>
        <BarChart.Background variant="4-pointed-star" />
        <BarChart.Reveal>
          <BarChart.Line dataKey="peak" variant="flowing" />
        </BarChart.Reveal>
      </BarChart.Root>
    </>
  );
  expectTypeOf(charts).toExtend<ReactElement>();
});

test("a directive-free server component formats a headline and a takeaway takes interpolated text", () => {
  function SpotHeadline({ price, now, locale }: { price: number; now: Date; locale: SupportedLocale }) {
    const value = formatChartValue(
      price,
      { preset: "unit-price", currency: "NOK", vat: "included" },
      { locale }
    );
    const slot = formatChartSlot(now, "quarter-hour", {
      locale,
      timeZone: "Europe/Oslo",
      format: "time-range",
    });
    const low = "03";
    return (
      <>
        <Chart.Headline>
          {value.text} {slot.text}
        </Chart.Headline>
        <Chart.Takeaway>Prisen er lavest kl. {low}</Chart.Takeaway>
      </>
    );
  }
  expectTypeOf(formatChartValue).returns.toEqualTypeOf<FormattedText>();
  expectTypeOf(formatChartSlot).returns.toEqualTypeOf<FormattedText>();
  expectTypeOf(SpotHeadline).toBeFunction();
});

test("as const satisfies keeps a literal qualityKey, so the Root check runs", () => {
  const config = {
    kw: { label: "Effekt", color: "chart-1", qualityKey: "quality" },
  } as const satisfies ChartConfig;
  expectTypeOf(config.kw.qualityKey).toEqualTypeOf<"quality">();
  type Reading = { at: Date; kw: number; quality: ChartQuality | null };
  const noReadings: readonly Reading[] = [];
  const live = (
    <LineChart.Root
      data={noReadings}
      config={config}
      xKey="at"
      xScale="point"
      interval="second"
      xFormat="time-seconds"
      timeZone="Europe/Oslo"
      yBaseline="none"
      aria-label="Effekt nå">
      <LineChart.Line dataKey="kw" />
      <LineChart.LegendItem>
        <LineChart.LegendValue fallback="last" />
        <LineChart.LegendShare />
      </LineChart.LegendItem>
    </LineChart.Root>
  );
  expectTypeOf(live).toExtend<ReactElement>();
});

/** A namespace's members as a plain object type, so two ES module namespaces compare by member. */
type Members<T> = { readonly [K in keyof T]: T[K] };

test("the aliases hold Chart's parts, and every shared part is one type across the four namespaces", () => {
  // Each alias is an ES module namespace of its own, so the check compares members, not modules.
  expectTypeOf<Members<typeof BarChart>>().toEqualTypeOf<Members<typeof Chart>>();
  expectTypeOf<Members<typeof AreaChart>>().toEqualTypeOf<Members<typeof Chart>>();
  expectTypeOf<Members<typeof LineChart>>().toEqualTypeOf<Members<typeof Chart>>();
  expectTypeOf(PieChart.Tooltip).toEqualTypeOf(Chart.Tooltip);
  expectTypeOf(RadialChart.Legend).toEqualTypeOf(Chart.Legend);
  expectTypeOf(RadarChart.Table).toEqualTypeOf(Chart.Table);
  expectTypeOf(RadarChart.TableColumn).toEqualTypeOf(Chart.TableColumn);
  expectTypeOf(PieChart.Headline).toEqualTypeOf(Chart.Headline);
  expectTypeOf(RadialChart.Center).toEqualTypeOf(PieChart.Center);
  expectTypeOf(RadialChart.Glow).toEqualTypeOf(PieChart.Glow);
  expectTypeOf(useChartPoint).returns.toEqualTypeOf<ChartPoint | null>();
});
