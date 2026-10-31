/**
 * The shared public types of `@elmeragroup/fuse/chart`. This module exports types only and carries
 * no directive, so server and client modules import it alike.
 */
import type { ComponentProps, CSSProperties, JSX, ReactElement } from "react";

import type { useRender } from "@base-ui/react/use-render";

import type { FormattedText } from "./format/formatted-text";
import type { Interval, TimePreset } from "./format/time-format";
import type { ValueFormat } from "./format/value-format";

export type { FormattedText } from "./format/formatted-text";
export type { Interval, TimePreset } from "./format/time-format";
export type { ChartFractionDigits, ValueFormat } from "./format/value-format";

/**
 * Every value a data cell may hold. Flight serialises each of these, and none is a function.
 *
 * @beta
 */
export type ChartScalar = string | number | boolean | Date | null | undefined;

/**
 * An x value. A string is a category, and a `Date` or epoch milliseconds is an instant.
 *
 * @beta
 */
export type ChartX = string | number | Date;

/**
 * An instant, as a `Date` or epoch milliseconds.
 *
 * @beta
 */
export type ChartInstant = Date | number;

/**
 * The default row type for wrappers that name no row type of their own.
 *
 * @beta
 */
export type ChartRow = { readonly [key: string]: ChartScalar };

/**
 * The row constraint of every Root. It maps the row's own keys, so an interface passes as well as a
 * type alias. An index-signature constraint would reject interfaces.
 *
 * @template TRow - The row type the chart reads.
 * @beta
 */
export type ChartRowOf<TRow> = { readonly [K in keyof TRow]: ChartScalar };

/**
 * The keys of `TRow` whose values are assignable to `TValue`. A row type with a string index, such
 * as the default `ChartRow` a wrapper uses, cannot be narrowed, so every key is a `string`.
 *
 * @template TRow - The row type the chart reads.
 * @template TValue - The value type a matching column holds.
 * @beta
 */
export type ChartKeyOf<TRow, TValue> = string extends keyof TRow
  ? string
  : {
      [K in keyof TRow]-?: TRow[K] extends TValue ? K : never;
    }[keyof TRow] &
      string;

/**
 * Columns that can be the x axis. A nullable column is not one.
 *
 * @template TRow - The row type the chart reads.
 * @beta
 */
export type ChartXKey<TRow> = ChartKeyOf<TRow, ChartX>;

/**
 * Columns of numbers, which series values and polar values read.
 *
 * @template TRow - The row type the chart reads.
 * @beta
 */
export type ChartSeriesKey<TRow> = ChartKeyOf<TRow, number | null | undefined>;

/**
 * Columns of strings, which polar categories read.
 *
 * @template TRow - The row type the chart reads.
 * @beta
 */
export type ChartCategoryKey<TRow> = ChartKeyOf<TRow, string>;

/**
 * Columns of reading qualities.
 *
 * @template TRow - The row type the chart reads.
 * @beta
 */
export type ChartQualityKey<TRow> = ChartKeyOf<TRow, ChartQuality | null | undefined>;

/**
 * The quality of one reading. A number with no quality counts as measured. `"missing"` marks a
 * reading that should exist and does not, whatever its value cell holds.
 *
 * @beta
 */
export type ChartQuality = "measured" | "estimated" | "corrected" | "missing";

/**
 * A half-open time window that holds `start` and ends just before `end`, such as one calendar month.
 *
 * @beta
 */
export type ChartPeriod = readonly [start: ChartInstant, end: ChartInstant];

/**
 * What a prop that names an x accepts. On a time axis any instant inside the slot finds it. A row
 * type that cannot be narrowed accepts any x.
 *
 * @template TX - The type of the x column.
 * @beta
 */
export type ChartXValue<TX> = [TX] extends [string]
  ? TX
  : [TX] extends [ChartInstant]
    ? ChartInstant
    : ChartX;

/**
 * What a callback reports for an x, which is the category, or the slot start as a `Date` for every
 * instant column.
 *
 * @template TX - The type of the x column.
 * @beta
 */
export type ChartXOut<TX> = [TX] extends [string] ? TX : [TX] extends [ChartInstant] ? Date : string | Date;

/**
 * The first and last slot of a window, both inclusive.
 *
 * @template TX - The type of the x column.
 * @beta
 */
export type ChartXRange<TX> = readonly [first: ChartXValue<TX>, last: ChartXValue<TX>];

/**
 * One of the eight shared categorical roles. Theme layers own the values.
 *
 * @beta
 */
export type ChartCategoricalRole = `chart-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

/**
 * One step of the sequential ramp, light to dark.
 *
 * @beta
 */
export type ChartSequentialRole = `chart-seq-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

/**
 * One step of the diverging scale, whose middle step sits at 0.
 *
 * @beta
 */
export type ChartDivergingRole = `chart-diverging-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

/**
 * A role that says a value is favourable or unfavourable. A layout never mixes it with a
 * categorical role.
 *
 * @beta
 */
export type ChartSentimentRole = "chart-sentiment-positive" | "chart-sentiment-negative";

/**
 * Every chart colour role, plus `chart-other` for the folded Other slice and its kin.
 *
 * @beta
 */
export type ChartRole =
  | ChartCategoricalRole
  | ChartSequentialRole
  | ChartDivergingRole
  | ChartSentimentRole
  | "chart-other";

/**
 * A scale, whose colour follows the value. Root bins each value into the scale's 7 steps. A bar
 * paints its step, and a line or area paints a gradient along the value axis, so a line or area
 * takes a scale only where it draws its own values. On a stacked series, or under
 * `stackOffset="expand"`, `Chart.Line` and `Chart.Area` throw `scale-colour-on-stack`.
 *
 * @beta
 */
export type ChartScale = "chart-seq" | "chart-diverging";

/**
 * One role, a list of two or more roles, or a scale. A role list is a decorative gradient that
 * never follows the value. It runs along the category axis on lines and areas, from the baseline
 * to the tip on bars, along the bisector on slices and along the sweep on rings. Use a scale when
 * the colour must follow the value. No CSS string passes, so set `--chart-color-<key>` on Root for
 * a colour outside the roles.
 *
 * @beta
 */
export type ChartColor = ChartRole | ChartScale | readonly [ChartRole, ChartRole, ...ChartRole[]];

/**
 * The roles a pie or radial category takes. A category is never favourable and has no sign.
 *
 * @beta
 */
export type ChartPolarRole = ChartCategoricalRole | ChartSequentialRole | "chart-other";

/**
 * One polar role or a list of two or more, which paints a gradient along the slice or the sweep.
 *
 * @beta
 */
export type ChartPolarColor = ChartPolarRole | readonly [ChartPolarRole, ChartPolarRole, ...ChartPolarRole[]];

/**
 * A time label format, a preset or Intl date options. The zone has one owner, Root's `timeZone`
 * over the provider's, so this omits it.
 *
 * @beta
 */
export type XFormat = TimePreset | Omit<Intl.DateTimeFormatOptions, "timeZone" | "timeZoneName">;

/**
 * The looks of a series' bars, which its config's `variant` names.
 *
 * @beta
 */
export type ChartBarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "striped"
  | "blocks"
  | "expandable"
  | "isometric";

/**
 * What a chart knows about one series, or about one category in pie and radial charts.
 *
 * @beta
 */
export type ChartSeriesConfig = {
  /**
   * The name every legend item, tooltip row, table header, option and description uses, kept
   * verbatim. It names the series without its unit, because the table header and spoken text add
   * the unit from `format`. A `FormattedText` gives the series a separate spoken name, which options,
   * the description and the table read, while every visible control keeps `text`.
   */
  label: string | FormattedText;
  /** A role, a decorative role list or a scale. Pie and radial config takes `ChartPolarColor`. */
  color: ChartColor;
  /**
   * The look of the series' bars, and of its legend swatches inside the chart, so the server draws
   * both alike. "default" by default. Above 100 slots a series draws its bars as one path, which
   * knows the "default" and "gradient" looks only, so every other look draws the default one there,
   * its swatches too, and warns `bar-variant-needs-html` in development. The tinted looks, which are
   * "hatched", "striped", "gradient", "duotone" and "duotone-reverse", fill most of a bar with a
   * pale tint of the series colour, so a series relies on the bar's 1 px edge in the full colour
   * and on the legend for its identity. Pair them with a Legend or a Table. Lines and areas take
   * their own look as a prop. Cartesian config only.
   */
  variant?: ChartBarVariant;
  /** How the series' values print. In pie and radial charts it overrides Root's `valueFormat`. */
  format?: ValueFormat;
  /** An element such as `<Lightning />`. A component type would not cross Flight. */
  icon?: ReactElement;
  /** Series with the same stack id stack together. Cartesian config only. */
  stack?: string;
  /** How a missing reading draws. "gap" is the default, and no option draws a missing reading as 0. */
  missing?: "gap" | "connect";
  /**
   * From this x on, the series draws as a projection. An x string on a time axis throws
   * `x-type-mismatch`. Cartesian config only.
   */
  projectedFrom?: ChartX;
  /**
   * The row column that holds each reading's `ChartQuality`. Write a missing reading as its
   * quality `"missing"`, with the value null or whatever the meter sent, because Fuse ignores the
   * value then. A null value with no quality column reads as missing inside the series' run of
   * readings too. Write the config `as const satisfies ChartConfig` so a misspelt literal fails the
   * type, because plain `satisfies` widens it.
   *
   * @example
   * ```ts
   * const rows = [
   *   { day: new Date("2025-10-04T22:00:00Z"), kwh: 12.4, kwhQuality: "measured" },
   *   { day: new Date("2025-10-05T22:00:00Z"), kwh: null, kwhQuality: "missing" },
   * ];
   * ```
   */
  qualityKey?: string;
  /**
   * The series' own resolution. It must be Root's `interval` or a coarser one that nests, and
   * Root's `interval` is the finest in the chart. Series at two resolutions share one `data` array
   * on Root's grid. A coarse series writes its value only on the rows at its own slot starts and
   * leaves it out of the others, and those gaps are not missing readings. Fuse never sums or
   * averages. Cartesian config only.
   *
   * @example
   * ```ts
   * // Root interval="quarter-hour". kwh sits on the :00 rows only.
   * const rows = [
   *   { start: new Date("2026-10-16T10:00:00Z"), price: 1.21, kwh: 0.35 },
   *   { start: new Date("2026-10-16T10:15:00Z"), price: 1.18 },
   * ];
   * const config = {
   *   price: { label: "Spotpris", color: "chart-2" },
   *   kwh: { label: "Forbruk", color: "chart-1", interval: "hour" },
   * } as const satisfies ChartConfig;
   * ```
   */
  interval?: Interval;
};

/**
 * Every series of a chart, keyed by the number column it reads, or every category of a pie or
 * radial chart, keyed by category value.
 *
 * @beta
 */
export type ChartConfig = { readonly [key: string]: ChartSeriesConfig };

/**
 * What a change callback reports beside the new value.
 *
 * @template TReason - The gestures that can cause the change.
 * @beta
 */
export type ChartChangeEventDetails<TReason extends string> = {
  /** The gesture behind the change. */
  readonly reason: TReason;
  /** The DOM event behind the change. */
  readonly event: Event | undefined;
};

/**
 * The gestures that change the selected series. A data update never reports one.
 *
 * @beta
 */
export type ChartSelectionChangeReason = "legend" | "plot" | "keyboard";

/**
 * The gestures that change the brushed window, Base UI Slider's own names.
 *
 * @beta
 */
export type ChartXRangeChangeReason = "drag" | "keyboard" | "track-press" | "input-change";

/**
 * Every chart needs a name. Exactly one of the two is required, because with both the label would
 * be dead text.
 *
 * @beta
 */
export type ChartAccessibleName =
  | {
      /** The chart's name. Pass this or `aria-labelledby`, never both. */
      "aria-label": string;
      /** The id of the element that names the chart. Pass this or `aria-label`, never both. */
      "aria-labelledby"?: never;
    }
  | {
      /** The id of the element that names the chart. Pass this or `aria-label`, never both. */
      "aria-labelledby": string;
      /** The chart's name. Pass this or `aria-labelledby`, never both. */
      "aria-label"?: never;
    };

/**
 * The active point that `useChartPoint` returns.
 *
 * @beta
 */
export type ChartPoint = {
  /** The slot or slice index. */
  readonly index: number;
  /** A category string, or the slot start as a `Date` on a time axis. */
  readonly x: string | Date;
  /** The slot's or category's label. */
  readonly label: FormattedText;
  /**
   * The focused or nearest series in cartesian and radar charts, or the active slice or ring in pie
   * and radial charts. It is null under "all series" focus and on the Other slice.
   */
  readonly key: string | null;
  /** Each config key's reading at the point. A key that is pending or missing there reports null. */
  readonly values: Readonly<Record<string, number | null>>;
  /**
   * Each config key's quality at the point, decided per series. A missing reading reports
   * "missing", and a key that is pending there has no entry.
   */
  readonly quality: Readonly<Record<string, ChartQuality>>;
};

/**
 * The figure's own props, which every Root takes. `hidden` goes, because it reads as "hide a series"
 * and would hide the whole chart and its status region. Render nothing instead. A wrapper uses
 * this helper to type its props.
 *
 * @beta
 */
export type ChartFigureProps = Omit<
  ComponentProps<"figure">,
  "children" | "color" | "content" | "hidden" | "style" | "aria-label" | "aria-labelledby"
> & {
  /** Inline styles, with every public chart custom property typed. */
  style?: ChartStyle;
};

/**
 * A DOM part's props. RDFa `content` and the legacy `color` attribute go, so
 * `TooltipValue content="share"` and `Swatch color="red"` fail the type instead of doing nothing.
 *
 * @template E - The element the part renders.
 * @beta
 */
export type ChartDomProps<E extends keyof JSX.IntrinsicElements> = Omit<
  useRender.ComponentProps<E>,
  "color" | "content" | "style"
> & {
  /** Inline styles, with every public chart custom property typed. */
  style?: ChartStyle;
};

/**
 * The entrance wipe origins a consumer writes as `data-intro` on `Chart.Root`. They are physical,
 * because time runs left to right under `dir="rtl"` too. "none" turns the entrance off.
 *
 * @beta
 */
export type ChartIntro = "left" | "right" | "center" | "edges" | "none";

/**
 * The public chart custom properties. React's `CSSProperties` declares no custom property, so
 * without this a standalone consumer could set none of them through `style` without a cast.
 *
 * @beta
 */
export type ChartStyleVars = {
  /** The cartesian plot height, on Root or a Panel. `12.5rem` by default. */
  "--chart-plot-height"?: string;
  /** One category row of a horizontal bar chart. `2rem` by default. */
  "--chart-row-height"?: string;
  /** The largest width of the aspect-locked polar cell. `12.5rem` by default. */
  "--chart-polar-size"?: string;
  /** The line stroke width. `2px` by default. */
  "--chart-stroke"?: string;
  /** The gap between categories. 25 % of the band by default. */
  "--chart-band-gap"?: string;
  /** The gap between grouped bars. `2px` by default. */
  "--chart-bar-gap"?: string;
  /** The surface-coloured gap between stacked segments. `2px` by default. */
  "--chart-bar-seam"?: string;
  /** The rounded end of a bar. The radius role by default. */
  "--chart-bar-radius"?: string;
  /** The area fill opacity. `0.1` by default. */
  "--chart-area-opacity"?: number | string;
  /** The opacity of marks outside the active column. `0.45` by default, and `1` turns dimming off. */
  "--chart-hover-dim"?: number | string;
  /** A ring's stroke as a fraction of its band, which also sets the gap to the next ring. `0.7` by default. */
  "--chart-ring-fill"?: number | string;
  /** The surface-coloured stroke between adjacent slices. `--chart-bar-seam` by default. */
  "--chart-slice-seam"?: string;
  /** The active-dot ping animation. Reduced motion sets it to `none`. */
  "--animate-chart-ping"?: string;
  /** The flowing-line dash animation. Reduced motion sets it to `none`. */
  "--animate-chart-dash"?: string;
  /** The skeleton shimmer animation. Reduced motion sets it to `none`. */
  "--animate-chart-shimmer"?: string;
} & {
  /**
   * A series' or category's paint, which wins over its config role. Fuse only reads it. ASCII
   * letters, digits and `-` in a key stay as they are, and every other character becomes `_`, its
   * code point in lower case hexadecimal, and `_`, so `net_rent` reads `--chart-color-net_5f_rent`.
   */
  readonly [key: `--chart-color-${string}`]: string;
};

/**
 * React's `CSSProperties` with every public chart custom property, which `style` takes on every
 * chart part.
 *
 * @beta
 */
export type ChartStyle = CSSProperties & ChartStyleVars;

/**
 * The selected-series triple every Root takes. A wrapper uses this helper to type its props.
 *
 * @template TKey - The config keys a selection can name.
 * @beta
 */
export type ChartSelectionProps<TKey extends string> = {
  /** The selected series, or null for none. Controlled. */
  selectedKey?: TKey | null;
  /** The series selected on first render, or null for none. Uncontrolled. */
  defaultSelectedKey?: TKey | null;
  /** Called when a legend toggle, a plot press or a key changes the selection. */
  onSelectedKeyChange?: (
    key: TKey | null,
    details: ChartChangeEventDetails<ChartSelectionChangeReason>
  ) => void;
};

/**
 * The time-axis props other than `interval`. A wrapper uses this helper to type its props.
 *
 * @beta
 */
export type ChartTimeFields = {
  /**
   * The whole window the axis lists, past the first and last rows, such as one calendar month.
   * Every slot inside it gets a cell, with or without a row. A series with no reading at a slot
   * that starts at or after `now` is pending there, which draws nothing. A past slot inside the
   * series' run of readings is missing, which draws the missing marker. So leave out the rows of
   * days to come, or give their cells null.
   */
  period?: ChartPeriod;
  /** The current instant. Fuse never reads the clock. */
  now?: ChartInstant;
  /** IANA zone of the data's market. It overrides LocaleProvider's, and a time axis with neither throws. */
  timeZone?: string;
  /** The x label format in the tooltip, the table and spoken text. */
  xFormat?: XFormat;
};

/**
 * Time-axis props exist only when the x column holds instants, and there `interval` is required.
 * It is the slot length and the finest interval in the chart. A row type that cannot be narrowed
 * takes every time prop as optional, which a wrapper typed with the default parameters relies on.
 *
 * @template TX - The type of the x column.
 * @beta
 */
export type ChartTimeAxisProps<TX> = [TX] extends [string]
  ? {
      /** Time axes only. A category axis takes no interval. */
      interval?: never;
      /** Time axes only. */
      period?: never;
      /** Time axes only. */
      now?: never;
      /** Time axes only. */
      timeZone?: never;
      /** Time axes only. */
      xFormat?: never;
    }
  : [TX] extends [ChartInstant]
    ? {
        /** The slot length, which is also the finest interval in the chart. A time axis requires it. */
        interval: Interval;
      } & ChartTimeFields
    : {
        /** The slot length, which is also the finest interval in the chart. A time axis requires it. */
        interval?: Interval;
      } & ChartTimeFields;

/**
 * Config keys must name number columns, and a literal `qualityKey` must name a quality column. A
 * widened config skips the check.
 *
 * @template TConfig - The config the Root infers.
 * @template TRow - The row type the chart reads.
 * @beta
 */
export type ChartSeriesConfigCheck<TConfig, TRow> = string extends keyof TConfig
  ? unknown
  : {
      readonly [K in keyof TConfig]: K extends ChartSeriesKey<TRow>
        ? TConfig[K] extends { qualityKey: infer Q extends string }
          ? string extends Q
            ? unknown
            : Q extends ChartQualityKey<TRow>
              ? unknown
              : {
                  readonly "Chart qualityKey must name a data column of ChartQuality values": ChartQualityKey<TRow>;
                }
          : unknown
        : { readonly "Chart config keys must name number columns of data": never };
    };

/**
 * Pie and radial config takes no cartesian field and only `ChartPolarColor`. A widened config skips
 * the check.
 *
 * @template TConfig - The config the Root infers.
 * @beta
 */
export type ChartPolarFieldCheck<TConfig> = string extends keyof TConfig
  ? unknown
  : {
      readonly [K in keyof TConfig]: TConfig[K] extends
        | { stack: unknown }
        | { projectedFrom: unknown }
        | { qualityKey: unknown }
        | { interval: unknown }
        | { missing: unknown }
        ? {
            readonly "PieChart and RadialChart config takes no stack, projectedFrom, qualityKey, interval or missing": never;
          }
        : TConfig[K] extends { color: ChartPolarColor }
          ? unknown
          : {
              readonly "PieChart and RadialChart colours are categorical or sequential roles, chart-other, or lists of them": never;
            };
    };

/**
 * Radar config takes no stack, projection or series interval, and no scale. A widened config skips
 * the check.
 *
 * @template TConfig - The config the Root infers.
 * @beta
 */
export type ChartRadarFieldCheck<TConfig> = string extends keyof TConfig
  ? unknown
  : {
      readonly [K in keyof TConfig]: TConfig[K] extends
        | { stack: unknown }
        | { projectedFrom: unknown }
        | { interval: unknown }
        ? { readonly "RadarChart config takes no stack, projectedFrom or interval": never }
        : TConfig[K] extends { color: ChartScale }
          ? { readonly "RadarChart colours are roles or role lists, never a scale": never }
          : unknown;
    };

/**
 * A literal category union needs one entry per category and no other key. A `string` column needs
 * neither, and neither does a widened config, which `unknown-category` covers at render.
 *
 * @template TConfig - The config the Root infers.
 * @template TCategory - The type of the category column.
 * @beta
 */
export type ChartCategoryConfigCheck<TConfig, TCategory> = (string extends TCategory | keyof TConfig
  ? unknown
  : { readonly [K in TCategory & string]: ChartSeriesConfig } & {
      readonly [K in Exclude<keyof TConfig, TCategory>]: {
        readonly "PieChart config keys must name categories of data": never;
      };
    }) &
  ChartPolarFieldCheck<TConfig>;

/**
 * The union without one of its members. Inference from an intersection of signatures uses the
 * last signature, which the TypeScript handbook documents, so the step drops exactly one member,
 * and which one never changes a count.
 *
 * @template U - The union to shrink.
 * @internal
 */
export type ChartWithoutOne<U> = Exclude<
  U,
  (
    (U extends unknown ? (pick: () => U) => void : never) extends (pick: infer I) => void ? I : never
  ) extends () => infer R
    ? R
    : never
>;

/**
 * True when a union holds five or more members, because four steps of `ChartWithoutOne` leave a
 * member exactly then. A widened `string` counts as false. The four steps are applied in turn
 * rather than by recursion, because the docs extractor walks a recursive alias without end.
 *
 * @template U - The union to count.
 * @internal
 */
export type ChartHasFiveKeys<U> = [U] extends [never]
  ? false
  : string extends U
    ? false
    : [ChartWithoutOne<ChartWithoutOne<ChartWithoutOne<ChartWithoutOne<U>>>>] extends [never]
      ? false
      : true;

/**
 * A radar draws at most 4 series. A fifth literal key fails the type, and a fifth runtime key
 * throws `radar-series-cap`.
 *
 * @template TConfig - The config the Root infers.
 * @beta
 */
export type ChartRadarCap<TConfig> =
  ChartHasFiveKeys<keyof TConfig & string> extends true
    ? { readonly "RadarChart draws at most 4 series": never }
    : unknown;

/**
 * The props of every closed part, which takes no DOM handlers and no `render`. `style` exists for
 * standalone consumers, who cannot generate arbitrary classes the way Tailwind-source consumers can.
 *
 * @beta
 */
export type ChartLayerProps = {
  /** Classes on the part's element. */
  className?: string;
  /** Inline styles, with every public chart custom property typed. */
  style?: ChartStyle;
};

/**
 * d3-shape curves. "monotone" stays monotone along the category axis, so it is monotoneX when time
 * runs along x and monotoneY under `orientation="horizontal"`. "monotone-y" is d3's monotoneY in
 * screen space, a decorative curve that puts a vertical tangent at every reading.
 *
 * @beta
 */
export type ChartCurve =
  | "linear"
  | "monotone"
  | "monotone-y"
  | "natural"
  | "step"
  | "step-before"
  | "step-after"
  | "bump"
  | "basis";

/**
 * The datum a part draws when nothing is active, which is the first or last reading of its series,
 * the lowest or highest, or the slot that contains Root's `now`.
 *
 * @beta
 */
export type ChartFallback = "first" | "last" | "min" | "max" | "now";

/**
 * The slots a part draws, picked by a `ChartFallback` keyword or by the slots containing these x
 * values. An x string on a time axis throws `x-type-mismatch`. Ties for "min" and "max" select every
 * tied slot.
 *
 * @beta
 */
export type ChartDatum = ChartFallback | { readonly x: ChartX | readonly ChartX[] };

/**
 * The plot background patterns.
 *
 * @beta
 */
export type ChartBackgroundPattern =
  | "dots"
  | "grid"
  | "cross-hatch"
  | "diagonal-lines"
  | "plus"
  | "falling-triangles"
  | "4-pointed-star"
  | "tiny-checkers"
  | "overlapping-circles"
  | "wiggle-lines"
  | "bubbles";

/**
 * The tone of a reference line or area.
 *
 * @beta
 */
export type ChartTone = "default" | "muted" | "error";
