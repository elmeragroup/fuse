/**
 * The public x-axis contracts of `Chart.Root`: what a prop that names an x takes, and the props
 * each x scale admits. A slot axis is a time or category axis. This module exports types only and
 * carries no directive, so server and client modules import it alike.
 */
import type { ChartInstant, ChartPeriod, ChartX, XFormat } from "./chart-types";
import type { Interval } from "./format/time-format";
import type { ValueFormat } from "./format/value-format";

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
 * The first and last slot of a window, both inclusive.
 *
 * @template TX - The type of the x column.
 * @beta
 */
export type ChartXRange<TX> = readonly [first: ChartXValue<TX>, last: ChartXValue<TX>];

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
  /**
   * The IANA zone of the data's market, such as "Europe/Oslo". It overrides LocaleProvider's, and a
   * time axis with neither throws.
   */
  timeZone?: string;
  /**
   * The x label format in the tooltip, the table and spoken text. A time axis takes an `XFormat`. A
   * linear axis takes a `ValueFormat`, and its axis and options also print with it.
   */
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
      // A category axis takes no time-axis prop. Each is documented once, on its time-axis type.
      interval?: never;
      period?: never;
      now?: never;
      timeZone?: never;
      xFormat?: never;
    }
  : [TX] extends [ChartInstant]
    ? {
        /**
         * The slot length, which is also the finest interval in the chart. A time axis requires it.
         * The axis lists at most 1,000,000 slots, so a year of minutes fits and a year of seconds
         * throws `slot-limit`.
         */
        interval: Interval;
      } & ChartTimeFields
    : {
        /**
         * The slot length, which is also the finest interval in the chart. A time axis requires it.
         * The axis lists at most 1,000,000 slots, so a year of minutes fits and a year of seconds
         * throws `slot-limit`.
         */
        interval?: Interval;
      } & ChartTimeFields;

/**
 * The x scale props of a slot axis, which is a time axis or a category axis in data order. A
 * wrapper uses this helper to type its props. This type documents each prop a slot axis and a
 * linear axis share, true of both, and `ChartLinearScaleProps` narrows its type.
 *
 * @template TX - The type of the x column.
 * @beta
 */
export type ChartSlotScaleProps<TX> = {
  /**
   * The x scale. "band" gives each slot a band of its own, which bars fill. "point" places each
   * slot at a point, which line and area charts usually pass. "linear" places each row at its x
   * number over a nice x domain from the lowest number to the highest, and needs a number column.
   * Pass it for unevenly spaced numbers. Its rows may arrive in any order, and a repeated number
   * keeps its first row. Evenly spaced numbers also work as categories under "point" once converted
   * to strings, since a number column on a band or point scale is a time axis that needs `interval`.
   */
  xScale?: "band" | "point";
  /**
   * "horizontal" draws the x column down the left edge and values left to right, for horizontal
   * bars. Axes keep their data roles in both orientations, so `XAxis` is always the `xKey` axis and
   * `YAxis` always the value axis. Each category row is `--chart-row-height` tall. On a horizontal
   * chart, ArrowDown and ArrowUp move between categories, and ArrowRight and ArrowLeft move the
   * series focus. A linear axis runs along the bottom only.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * The first and last slot of the window, both inclusive. On a linear axis they are any two x
   * numbers, and the window holds the rows between them.
   */
  xRange?: ChartXRange<TX>;
  /** The window on first render. */
  defaultXRange?: ChartXRange<TX>;
  /**
   * The slot that is active before any pointer or key moves, by its x. On a linear axis the x is a
   * number. An x survives a reload where an index would not.
   *
   * The plot is one tab stop. ArrowRight and ArrowLeft move one slot, PageDown and PageUp a tenth
   * of the window's slots and at least one, and Home and End go to the window's first and last
   * slot. ArrowDown and ArrowUp move the series focus. Enter and Space select the focused series
   * while a `LegendToggleGroup` is mounted, and pin the tooltip otherwise. Escape hides the
   * tooltip and keeps focus, and a second Escape passes on.
   */
  defaultActiveX?: ChartXValue<TX>;
  xLabel?: never;
  xInclude?: never;
} & ChartTimeAxisProps<TX>;

/**
 * The x scale props of a linear axis, which places each row at its x number, so unevenly spaced
 * numbers, such as capacity tariff thresholds in kW or an EV's charging power by state of charge,
 * keep their true distances. Each row is still one slot: one option for the keyboard, one tooltip
 * readout, one table row and one spoken item, in ascending x order. The time-axis props do not
 * apply, and neither does `orientation="horizontal"`. The props it shares with a slot axis are
 * documented on `ChartSlotScaleProps`. A wrapper uses this helper to type its props.
 *
 * @beta
 */
export type ChartLinearScaleProps = {
  xScale: "linear";
  xFormat?: ValueFormat;
  /**
   * The x measure's name, such as "Ladenivå", which the options and the table's header print. The
   * table's header defaults to the dictionary's "Verdi". `XAxis` takes the axis title as its own
   * `label`. Only a linear axis takes it.
   */
  xLabel?: string;
  /** Values a linear axis's x domain must reach, such as 0 kW. */
  xInclude?: readonly number[];
  interval?: never;
  period?: never;
  now?: never;
  timeZone?: never;
  orientation?: "vertical";
  xRange?: readonly [first: number, last: number];
  defaultXRange?: readonly [first: number, last: number];
  defaultActiveX?: number;
};

/**
 * The kinds of x axis a props type admits: "slot", a time or category axis whose slots sit in band
 * or point cells, and "linear", which places each row at its x number.
 *
 * @beta
 */
export type ChartXAxisKind = "slot" | "linear";

/**
 * The x scale props a Root takes for its x column: a slot axis for every column, and a linear axis
 * for a number column, or for a row type that cannot be narrowed. `TAxis` names the kinds of axis
 * the props admit, both by default. Each kind is its own member of the union, so the props keep
 * which x props go together.
 *
 * @template TX - The type of the x column.
 * @template TAxis - The kinds of x axis the props admit.
 * @beta
 */
export type ChartXScaleProps<TX, TAxis extends ChartXAxisKind = ChartXAxisKind> =
  | ("slot" extends TAxis ? ChartSlotScaleProps<TX> : never)
  // A string or `Date` column takes no linear axis.
  | ("linear" extends TAxis
      ? [TX] extends [string]
        ? never
        : [TX] extends [number]
          ? ChartLinearScaleProps
          : [TX] extends [ChartInstant]
            ? never
            : ChartLinearScaleProps
      : never);
