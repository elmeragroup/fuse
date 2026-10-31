/**
 * Negative type cases of CONTRACT.md section 14, including the 30 negative cases of the contract's
 * revision check. The TypeScript checker is the oracle. Each `@ts-expect-error` line must fail,
 * and an unused one fails the file.
 * Each case fits on one formatted line, because a directive covers only the line below it, so the
 * data and configs are hoisted. The misspelt custom-property case lives in
 * `test/packed-consumer/chart-types/`, because the workspace's csstype augmentation accepts every
 * `--*` property.
 */
import type { ReactElement } from "react";

import { expectTypeOf, test } from "vitest";

import {
  BarChart,
  Chart,
  formatChartSlot,
  formatChartValue,
  LineChart,
  PieChart,
  RadarChart,
  RadialChart,
  Sparkline,
} from "@elmeragroup/fuse/chart";
import type {
  ChartActiveDotProps,
  ChartAreaProps,
  ChartBarProps,
  ChartConfig,
  ChartGlowProps,
  ChartLegendProps,
  ChartLineProps,
  ChartQuality,
  ChartRootProps,
  ChartSwatchProps,
  ChartTooltipProps,
  ChartTooltipValueProps,
  ChartYAxisProps,
  PieChartRootProps,
  RadarChartGlowProps,
  ValueFormat,
} from "@elmeragroup/fuse/chart";

type Day = {
  day: Date;
  kwh: number | null;
  kwhQuality: ChartQuality | null;
  price: number | null;
  area: string;
};
const days: readonly Day[] = [];
const kwh = { kwh: { label: "Forbruk", color: "chart-1" } } as const satisfies ChartConfig;
const months = [{ month: "jan", desktop: 186, mobile: 80 }];
const hours = [{ start: new Date(0), kwh: 0.4, price: 1.2 }];
const browsers = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
] as const;
const spokes = [{ cat: "Hus", a: 1, b: -2 }];
const rings = [{ name: "kwh", used: 3.9, budget: 5 }];
const fn = (value: number): string => String(value);

/** A Date-column chart's props, so each case adds only the prop it tests. */
const daily = { data: days, xKey: "day", interval: "day", "aria-label": "x" } as const;
/** A pie's props without its config. */
const pie = { data: browsers, nameKey: "browser", valueKey: "visitors", "aria-label": "x" } as const;
/** A valid config for the two browser categories. */
const browserConfig = {
  chrome: { label: "C", color: "chart-1" },
  safari: { label: "S", color: "chart-2" },
} as const satisfies ChartConfig;
/** A radar's props without its config. */
const radar = { data: spokes, nameKey: "cat", "aria-label": "r" } as const;
/** A radial chart's props without its maximum. */
const budget = { data: rings, config: {}, nameKey: "name", valueKey: "used", "aria-label": "B" } as const;

/** Thirty literal keys, `k00` to `k29`, which only their type needs. */
type Thirty = `k${0 | 1 | 2}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
declare const thirtyKeys: { readonly [K in Thirty]: { readonly label: string; readonly color: "chart-1" } };
declare const thirty: readonly ({ readonly cat: string } & { readonly [K in Thirty]: number })[];

test("functions never pass where Flight needs data", () => {
  const formatFunction = { kwh: { label: "k", color: "chart-1", format: fn } } as const;
  const colorFunction = { kwh: { label: "k", color: fn } } as const;
  const functionCell = [{ day: new Date(), kwh: () => 1 }];
  const urlCell = [{ day: new Date(), kwh: 1, link: new URL("https://example.com") }];
  const objectCell = [{ day: new Date(), kwh: 1, meta: { a: 1 } }];
  // @ts-expect-error a function as YAxis format
  void (<Chart.YAxis format={fn} />);
  // @ts-expect-error a function as XAxis format
  void (<Chart.XAxis format={fn} />);
  // @ts-expect-error a function as TooltipValue format
  void (<Chart.TooltipValue format={fn} />);
  // @ts-expect-error a function as a config format
  void (<Chart.Root {...daily} config={formatFunction} />);
  // @ts-expect-error a function as valueFormat
  void (<PieChart.Root {...pie} config={browserConfig} valueFormat={fn} />);
  // @ts-expect-error a function as a colour
  void (<Chart.Root {...daily} config={colorFunction} />);
  // @ts-expect-error a function as emphasis
  void (<Chart.Bar dataKey="kwh" emphasis={() => 14} />);
  // @ts-expect-error a function cell
  void (<Chart.Root data={functionCell} config={kwh} xKey="day" interval="day" aria-label="x" />);
  // @ts-expect-error a URL cell
  void (<Chart.Root data={urlCell} config={kwh} xKey="day" interval="day" aria-label="x" />);
  // @ts-expect-error a nested object cell
  void (<Chart.Root data={objectCell} config={kwh} xKey="day" interval="day" aria-label="x" />);
  // @ts-expect-error closed parts take no DOM handlers
  void (<Chart.Bar dataKey="kwh" onClick={() => undefined} />);
  // @ts-expect-error closed parts take no render
  void (<Chart.Bar dataKey="kwh" render={() => <rect />} />);
  // @ts-expect-error a function as a format value
  const _formatFunction: ValueFormat = fn;
});

test("no evilcharts flag, mode prop or hidden attribute exists below or on Root", () => {
  const flags = [
    "glowing",
    "isClickable",
    "enableHoverHighlight",
    "enableHoverReveal",
    "enableMaxValueHighlight",
    "connectNulls",
    "showBackground",
    "hideDots",
    "cursor",
    "isLoading",
    "animation",
  ] as const;
  for (const flag of flags) {
    expectTypeOf<ChartRootProps>().not.toHaveProperty(flag);
    expectTypeOf<ChartBarProps>().not.toHaveProperty(flag);
    expectTypeOf<ChartLineProps>().not.toHaveProperty(flag);
    expectTypeOf<ChartAreaProps>().not.toHaveProperty(flag);
    expectTypeOf<ChartTooltipProps>().not.toHaveProperty(flag);
    expectTypeOf<PieChartRootProps>().not.toHaveProperty(flag);
  }
  expectTypeOf<ChartRootProps>().not.toHaveProperty("hiddenKeys");
  expectTypeOf<ChartLegendProps>().not.toHaveProperty("action");
  expectTypeOf<ChartTooltipValueProps>().not.toHaveProperty("content");
  expectTypeOf<ChartSwatchProps>().not.toHaveProperty("color");
  expectTypeOf<ChartGlowProps>().not.toHaveProperty("dataKey");
  expectTypeOf<RadarChartGlowProps>().not.toHaveProperty("dataKey");
  // @ts-expect-error Root omits the HTML hidden attribute
  void (<Chart.Root data={months} config={{}} xKey="month" aria-label="x" hidden />);
  // @ts-expect-error DOM parts omit the RDFa content attribute
  void (<PieChart.TooltipValue content="share" />);
  // @ts-expect-error DOM parts omit the legacy color attribute
  void (<Chart.Swatch color="red" />);
  // @ts-expect-error Legend has no action mode
  void (<Chart.Legend action="select" />);
  // @ts-expect-error a cartesian Glow takes its marks as children, not a dataKey
  void (<LineChart.Glow dataKey="desktop" />);
  // @ts-expect-error a radar Glow takes its marks as children, not a dataKey
  void (<RadarChart.Glow dataKey="a" />);
});

test("keys and values follow the data", () => {
  const areaKey = { area: { label: "a", color: "chart-1" } } as const satisfies ChartConfig;
  const priceQuality = {
    kwh: { label: "k", color: "chart-1", qualityKey: "price" },
  } as const satisfies ChartConfig;
  const typo = {
    kwh: { label: "Forbruk", color: "chart-1", qualityKey: "kwhQualty" },
  } as const satisfies ChartConfig;
  const oneCategory = { chrome: { label: "C", color: "chart-1" } } as const satisfies ChartConfig;
  const extraCategory = {
    ...oneCategory,
    safari: { label: "S", color: "chart-2" },
    edge: { label: "E", color: "chart-3" },
  } as const satisfies ChartConfig;
  const pieStack = {
    chrome: { label: "C", color: "chart-1", stack: "s" },
    safari: { label: "S", color: "chart-2" },
  } as const satisfies ChartConfig;
  const pieScale = {
    chrome: { label: "C", color: "chart-seq" },
    safari: { label: "S", color: "chart-2" },
  } as const satisfies ChartConfig;
  const pieSentiment = {
    chrome: { label: "C", color: "chart-sentiment-positive" },
    safari: { label: "S", color: "chart-2" },
  } as const satisfies ChartConfig;
  const radarStack = { a: { label: "A", color: "chart-1", stack: "s" } } as const satisfies ChartConfig;
  const radarInterval = {
    a: { label: "A", color: "chart-1", interval: "hour" },
  } as const satisfies ChartConfig;
  const radarScale = { a: { label: "A", color: "chart-diverging" } } as const satisfies ChartConfig;
  const five = [{ cat: "Hus", a: 1, b: 2, c: 3, d: 4, e: 5 }];
  const fiveKeys = {
    a: { label: "A", color: "chart-1" },
    b: { label: "B", color: "chart-2" },
    c: { label: "C", color: "chart-3" },
    d: { label: "D", color: "chart-4" },
    e: { label: "E", color: "chart-5" },
  } as const satisfies ChartConfig;
  // The cap counts keys, so the same five in reverse order and thirty template keys fail too.
  const fiveReversed = {
    e: { label: "E", color: "chart-5" },
    d: { label: "D", color: "chart-4" },
    c: { label: "C", color: "chart-3" },
    b: { label: "B", color: "chart-2" },
    a: { label: "A", color: "chart-1" },
  } as const satisfies ChartConfig;
  // @ts-expect-error an unknown xKey
  void (<Chart.Root data={days} config={kwh} xKey="nope" interval="day" aria-label="x" />);
  // @ts-expect-error xKey on a nullable column
  void (<Chart.Root data={days} config={kwh} xKey="kwh" interval="day" aria-label="x" />);
  // @ts-expect-error interval on a string x column
  void (<Chart.Root data={months} config={{}} xKey="month" interval="hour" aria-label="x" />);
  // @ts-expect-error timeZone on a category axis
  void (<Chart.Root data={months} config={{}} xKey="month" timeZone="Europe/Oslo" aria-label="x" />);
  // @ts-expect-error a Date x column without interval
  void (<Chart.Root data={hours} config={{}} xKey="start" timeZone="Europe/Oslo" aria-label="x" />);
  // @ts-expect-error a config key that is not a number column
  void (<Chart.Root {...daily} config={areaKey} />);
  // @ts-expect-error a literal qualityKey must name a quality column
  void (<Chart.Root data={hours} config={priceQuality} xKey="start" interval="hour" aria-label="x" />);
  // @ts-expect-error a selectedKey that is not a config key
  void (<Chart.Root {...daily} config={kwh} selectedKey="nope" />);
  // @ts-expect-error a category range on a time axis
  void (<Chart.Root {...daily} config={kwh} defaultXRange={["jan", "feb"]} />);
  // @ts-expect-error under `as const` a misspelt qualityKey fails the Root check
  void (<Chart.Root {...daily} config={typo} />);
  // @ts-expect-error a literal category union needs one entry per category
  void (<PieChart.Root {...pie} config={oneCategory} />);
  // @ts-expect-error a literal config key must name a category
  void (<PieChart.Root {...pie} config={extraCategory} />);
  // @ts-expect-error stack in a pie config
  void (<PieChart.Root {...pie} config={pieStack} />);
  // @ts-expect-error a scale bins values, which means nothing for one value per category
  void (<PieChart.Root {...pie} config={pieScale} />);
  // @ts-expect-error sentiment means favourable, never a category
  void (<PieChart.Root {...pie} config={pieSentiment} />);
  // @ts-expect-error stack is a type error in a radar config
  void (<RadarChart.Root {...radar} config={radarStack} />);
  // @ts-expect-error interval is a type error in a radar config
  void (<RadarChart.Root {...radar} config={radarInterval} />);
  // @ts-expect-error a radar colour is a role or a role list
  void (<RadarChart.Root {...radar} config={radarScale} />);
  // @ts-expect-error max and maxKey together
  void (<RadialChart.Root {...budget} maxKey="budget" max={3} />);
  // @ts-expect-error a fifth literal radar series fails
  void (<RadarChart.Root data={five} config={fiveKeys} nameKey="cat" aria-label="r" />);
  // @ts-expect-error a fifth literal radar series fails in any key order
  void (<RadarChart.Root data={five} config={fiveReversed} nameKey="cat" aria-label="r" />);
  // @ts-expect-error thirty literal radar series fail
  void (<RadarChart.Root data={thirty} config={thirtyKeys} nameKey="cat" aria-label="r" />);
  // @ts-expect-error ActiveDot names its series
  void (<Chart.ActiveDot />);
  // @ts-expect-error RadarChart.ActiveDot names its series too
  void (<RadarChart.ActiveDot />);
  // @ts-expect-error Marker needs a datum
  void (<LineChart.Marker dataKey="price" />);
  // @ts-expect-error BarGroup lists config keys, not one key
  void (<BarChart.BarGroup series="desktop" />);
  expectTypeOf<ChartActiveDotProps>().toHaveProperty("dataKey").toEqualTypeOf<string>();
});

test("string props take only their vocabulary", () => {
  const red = { kwh: { label: "k", color: "red" } } as const;
  const cssVar = { kwh: { label: "k", color: "var(--chart-1)" } } as const;
  // @ts-expect-error a literal colour string
  void (<Chart.Root {...daily} config={red} />);
  // @ts-expect-error a CSS colour string
  void (<Chart.Root {...daily} config={cssVar} />);
  // @ts-expect-error an unknown curve
  void (<Chart.Line dataKey="kwh" curve="smooth" />);
  // @ts-expect-error the catalogue's misspelt bar variant
  void (<Chart.Bar dataKey="kwh" variant="stripped" />);
  // @ts-expect-error unit-price without vat
  const _noVat: ValueFormat = { preset: "unit-price", currency: "NOK" };
  // @ts-expect-error wipe origins are physical
  void (<Chart.Root data={months} config={{}} xKey="month" data-intro="start" aria-label="x" />);
  // @ts-expect-error YAxis is the value axis in both orientations, so a time preset fails
  void (<BarChart.YAxis format="hour" />);
  expectTypeOf<ChartYAxisProps["format"]>().toEqualTypeOf<ValueFormat | undefined>();
  // @ts-expect-error a y reference prints a number, so a time preset fails
  void (<BarChart.ReferenceLine y={2} format="hour" />);
  // @ts-expect-error an x reference prints a slot label, so a value preset fails
  void (<BarChart.ReferenceLine x={new Date(0)} format={{ preset: "energy", unit: "kWh" }} />);
  // @ts-expect-error a takeaway stays text
  void (<Chart.Takeaway>{<b>lav</b>}</Chart.Takeaway>);
  // @ts-expect-error a locale without a Fuse dictionary fails on Sparkline
  void (<Sparkline aria-label="s" data={[1, 2]} locale="de" />);
  // @ts-expect-error a locale without a Fuse dictionary fails on formatChartValue
  void formatChartValue(1, undefined, { locale: "nb" });
  // @ts-expect-error a locale without a Fuse dictionary fails on formatChartSlot
  void formatChartSlot(0, "hour", { locale: "de-DE", timeZone: "Europe/Berlin" });
});

test("every chart has exactly one name", () => {
  // @ts-expect-error a nameless chart
  void (<Chart.Root data={days} config={kwh} xKey="day" interval="day" />);
  // @ts-expect-error both names
  void (<Chart.Root {...daily} config={kwh} aria-labelledby="b" />);
  // @ts-expect-error a nameless pie
  void (<PieChart.Root data={browsers} config={browserConfig} nameKey="browser" valueKey="visitors" />);
  // @ts-expect-error Sparkline without aria-label
  void (<Sparkline data={[1]} locale="nb-NO" />);
  // @ts-expect-error Sparkline without locale
  void (<Sparkline aria-label="s" data={[1]} />);
  // @ts-expect-error Sparkline start without timeZone
  void (<Sparkline aria-label="s" data={[1]} locale="nb-NO" start={0} interval="hour" />);
});

// Each case above must fail for its stated rule alone, so each passes once that one violation goes.
test("each negative case passes once its violation is removed", () => {
  const preset = {
    kwh: { label: "k", color: "chart-1", format: { maximumFractionDigits: 1 } },
  } as const satisfies ChartConfig;
  const quality = {
    kwh: { label: "k", color: "chart-1", qualityKey: "kwhQuality" },
  } as const satisfies ChartConfig;
  const plainHours = { kwh: { label: "k", color: "chart-1" } } as const satisfies ChartConfig;
  const twoCategories = {
    chrome: { label: "C", color: "chart-1" },
    safari: { label: "S", color: "chart-2" },
  } as const satisfies ChartConfig;
  const radarPlain = { a: { label: "A", color: "chart-1" } } as const satisfies ChartConfig;
  const fourSpokes = [{ cat: "Hus", a: 1, b: 2, c: 3, d: 4 }];
  const fourKeys = {
    a: { label: "A", color: "chart-1" },
    b: { label: "B", color: "chart-2" },
    c: { label: "C", color: "chart-3" },
    d: { label: "D", color: "chart-4" },
  } as const satisfies ChartConfig;
  const twins = (
    <>
      <Chart.Root {...daily} config={preset} />
      <Chart.Root {...daily} config={kwh} />
      <Chart.Root {...daily} config={quality} />
      <Chart.Root data={hours} config={plainHours} xKey="start" interval="hour" aria-label="x" />
      <PieChart.Root {...pie} config={twoCategories} />
      <PieChart.Root {...pie} config={browserConfig} valueFormat={{ maximumFractionDigits: 0 }} />
      <PieChart.Root
        data={browsers}
        config={browserConfig}
        nameKey="browser"
        valueKey="visitors"
        aria-label="x"
      />
      <RadarChart.Root {...radar} config={radarPlain} />
      <RadarChart.Root data={fourSpokes} config={fourKeys} nameKey="cat" aria-label="r" />
      <RadialChart.Root {...budget} maxKey="budget" />
      <Chart.Root data={months} config={{}} xKey="month" data-intro="left" aria-label="x" />
      <Chart.Line dataKey="kwh" curve="monotone" />
      <Chart.Bar dataKey="kwh" variant="striped" emphasis={{ x: new Date(0) }} />
      <BarChart.YAxis format={{ maximumFractionDigits: 0 }} />
      <BarChart.ReferenceLine y={2} format={{ maximumFractionDigits: 1 }} />
      <BarChart.ReferenceLine x={new Date(0)} format="hour" />
      <Chart.Takeaway>lav</Chart.Takeaway>
      <Sparkline
        aria-label="s"
        data={[1, 2]}
        locale="nb-NO"
        start={0}
        interval="hour"
        timeZone="Europe/Oslo"
      />
    </>
  );
  expectTypeOf(twins).toExtend<ReactElement>();
});
