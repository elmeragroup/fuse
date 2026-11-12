/**
 * The Sparkline's geometry and its range sentence, after CONTRACT sections 6, 8.9 and 9.10 and
 * ticket 06's F4. A Sparkline draws on the server at no known size, so a line or an area lives in
 * a viewBox of equal cells that the svg stretches to its box, and its strokes keep their width on
 * screen. Bars, the rules, the dots and the hover regions place by percentages of the box, which
 * read the same in the stretched viewBox and in the bars' unstretched box. Every value sits in its
 * own cell, so a step curve keeps the last run, as on a chart.
 */
import type { SupportedLocale } from "../../../intl/locale-context";
import type { ChartCurve } from "../chart-types";
import { CHART_STRINGS } from "../format/chart-strings";
import { formatSlot, LABEL_PRESETS, nextSlotStart, slotStart } from "../format/time-format";
import type { Interval } from "../format/time-format";
import { formatValue } from "../format/value-format";
import type { ValueFormat } from "../format/value-format";
import { AREA_STRIDE, LINE_STRIDE, areaPaths, linePaths } from "./line-path";
import type { PathPlacement, PathTopology } from "./line-path";
import { PATH_DIGITS, rounded } from "./rounding";

/** The viewBox width of one value's cell. */
const SPARKLINE_CELL = 10;

/** The viewBox height, so a y coordinate is also a percentage of the box's height. */
const SPARKLINE_HEIGHT = 100;

/** The share of a bar cell left empty around its bar, as a chart's default band gap. */
const BAR_GAP = 0.25;

/**
 * How far past the box, in percent, a hover band at either end reaches, so the clip that draws it
 * keeps the end's round cap.
 */
const BAND_BLEED = 10;

/** A span across the box, start first, in percent of its width. */
export type SparklineSpan = readonly [start: number, end: number];

/** A place in the box, in percent of its width and its height from the top left. */
export type SparklinePoint = { readonly x: number; readonly y: number };

/**
 * How many readings either side of a hovered one its segment's path runs through, per curve. The
 * segment clips to the span from the reading before to the reading after, so a reach is the fewest
 * readings that shape that span:
 *
 * - linear, bump, step-before and step-after join each pair of readings from those two alone, so
 *   one each side draws the span exactly;
 * - monotone and basis shape a span's ends from the readings either side of it, and the centred
 *   step ends a path's last reading at its centre rather than at the next step, so they take two
 *   each side to draw the span through the full line's own commands;
 * - the natural spline shapes each span from every reading. A reading's pull on a span shrinks by
 *   a factor of about 2 - √3, a quarter, per reading between them, so a reading past four away
 *   moves the clipped segment by under a fiftieth of its bend, below a pixel in a 2rem box.
 */
const SEGMENT_REACH = {
  linear: 1,
  monotone: 2,
  "monotone-y": 2,
  natural: 4,
  step: 2,
  "step-before": 1,
  "step-after": 1,
  bump: 1,
  basis: 2,
} as const satisfies Record<ChartCurve, number>;

/**
 * One reading the pointer can rest on, in percent of the box: its point, and the cell it owns,
 * which is the region whose hover shows its crosshair and dot.
 */
export type SparklineReading = SparklinePoint & {
  readonly index: number;
  readonly cell: SparklineSpan;
};

/**
 * A line's or an area's reading, with the segment of the line its hover re-strokes at full
 * strength: a path through the readings around it, in viewBox units, which its band clips to the
 * span from the centre of the cell before it to the centre of the cell after it. Each reading
 * carries its own segment, so hover needs no script and no id, at the cost of the path data of the
 * readings its curve's reach takes in.
 */
export type SparklinePathReading = SparklineReading & {
  readonly band: SparklineSpan;
  readonly segment: string;
};

/** A bar's reading, with its bar, which a negative value hangs below the baseline. */
export type SparklineBarReading = SparklineReading & {
  readonly bar: SparklinePoint & { readonly width: number; readonly height: number };
  readonly negative: boolean;
};

/** What every variant draws besides its marks. Each value is in percent of the box. */
type SparklineFrame = {
  /** The zero line's height, where the domain spans 0, or null. */
  readonly zero: number | null;
  /** The flat reference line's height, or null. */
  readonly reference: number | null;
  /** The emphasised value's dot, or null. */
  readonly dot: SparklinePoint | null;
};

/**
 * What a Sparkline draws. A line or an area draws paths in a viewBox of equal cells that the svg
 * stretches to its box. Bars place each bar by percentages in the unstretched box instead, so the
 * corners they round stay circular.
 */
export type SparklineLayout =
  | (SparklineFrame & {
      readonly kind: "path";
      readonly viewBox: string;
      /** An area's fill between the values and 0, empty for a line. */
      readonly fill: string;
      /** The line, or an area's top edge, with every lone reading as a round cap. Empty with no reading. */
      readonly stroke: string;
      /**
       * Where 0 sits down the view box, in percent: 100 under positive values, 0 over negative
       * ones, and between for values on both sides. An area fades toward it. The view box, not the
       * fill's own box, so the place holds when a lone reading or the reference reaches past the
       * readings that draw fill.
       */
      readonly fillZero: number;
      readonly readings: readonly SparklinePathReading[];
    })
  | (SparklineFrame & {
      readonly kind: "bars";
      readonly readings: readonly SparklineBarReading[];
    });

/** What the layout reads. */
export type SparklineInput = {
  readonly data: readonly (number | null)[];
  readonly variant: "line" | "area" | "bar";
  readonly curve: ChartCurve;
  readonly emphasis: "first" | "last" | "min" | "max" | number | undefined;
  readonly reference: number | undefined;
};

/**
 * The value domain: the data's extent with the reference, and with 0 for an area or bars, which
 * encode length from it. A flat extent widens by a tenth of its value either way, or to −1 and 1
 * at 0, after section 8.2, so a flat line sits mid-box.
 */
function domainOf(values: readonly number[], input: SparklineInput): readonly [number, number] {
  const reach = [...values, ...(input.reference === undefined ? [] : [input.reference])];
  if (input.variant !== "line") reach.push(0);
  const low = Math.min(...reach);
  const high = Math.max(...reach);
  if (high > low) return [low, high];
  if (low === 0) return input.variant === "line" ? [-1, 1] : [0, 1];
  const spread = Math.abs(low) / 10;
  return [low - spread, low + spread];
}

/** The index the first tie of the lowest or highest value takes. */
function extremeIndex(data: readonly (number | null)[], sign: 1 | -1): number {
  let best = -1;
  data.forEach((value, index) => {
    if (value === null) return;
    const current = best === -1 ? null : data[best];
    if (current === null || current === undefined || sign * value > sign * current) best = index;
  });
  return best;
}

/**
 * The index a Sparkline's `emphasis` picks, or -1. Ties pick the first index.
 *
 * @param data - The values.
 * @param emphasis - The keyword or index.
 * @returns The index of a value, or -1 when the pick has no value.
 */
export function emphasisIndex(
  data: readonly (number | null)[],
  emphasis: SparklineInput["emphasis"]
): number {
  if (emphasis === undefined) return -1;
  const read = data.flatMap((value, index) => (value === null ? [] : [index]));
  switch (emphasis) {
    case "first":
      return read[0] ?? -1;
    case "last":
      return read.at(-1) ?? -1;
    case "min":
      return extremeIndex(data, -1);
    case "max":
      return extremeIndex(data, 1);
    default:
      return data[emphasis] === null || data[emphasis] === undefined ? -1 : emphasis;
  }
}

/** The topology of evenly spaced values, each in its own cell, with a gap at every null. */
function topologyOf(values: readonly (number | null)[]): PathTopology {
  return {
    count: values.length,
    states: values.map((value) => (value === null ? "missing" : "reading")),
    estimated: values.map(() => false),
    projectedFrom: values.length,
    sides: values.map(() => null),
    cells: values.map(() => 1),
    missing: "gap",
  };
}

/**
 * Lay a Sparkline out.
 *
 * @param input - The values and the look.
 * @returns The marks, the rules, the dot and each reading's hover geometry.
 */
export function sparklineLayout(input: SparklineInput): SparklineLayout {
  const { data } = input;
  const count = Math.max(1, data.length);
  const width = count * SPARKLINE_CELL;
  const viewBox = `0 0 ${String(width)} ${String(SPARKLINE_HEIGHT)}`;
  const values = data.flatMap((value) => (value === null ? [] : [value]));
  const [low, high] = values.length === 0 ? [0, 1] : domainOf(values, input);
  // The viewBox is 100 high, so a y coordinate is a percentage of the box's height as well.
  const y = (value: number) => ((high - value) / (high - low)) * SPARKLINE_HEIGHT;
  const x = (index: number) => (index + 0.5) * SPARKLINE_CELL;
  // A cell's share of the box, as a percentage of its width.
  const share = (cells: number) => rounded((cells / count) * 100);
  const readings = data.flatMap((value, index) =>
    value === null
      ? []
      : [
          {
            index,
            x: share(index + 0.5),
            y: rounded(y(value)),
            cell: [share(index), share(index + 1)] as const,
          },
        ]
  );
  const picked = emphasisIndex(data, input.emphasis);
  const pick = readings.find((reading) => reading.index === picked);
  const frame: SparklineFrame = {
    zero: values.length > 0 && low < 0 && high > 0 ? rounded(y(0)) : null,
    reference: values.length === 0 || input.reference === undefined ? null : rounded(y(input.reference)),
    dot: pick === undefined ? null : { x: pick.x, y: pick.y },
  };
  if (input.variant === "bar") {
    return {
      ...frame,
      kind: "bars",
      readings: readings.map((reading) => {
        const value = data[reading.index] ?? 0;
        const top = Math.min(y(value), y(0));
        return {
          ...reading,
          bar: {
            x: share(reading.index + BAR_GAP / 2),
            y: rounded(top),
            width: share(1 - BAR_GAP),
            height: rounded(Math.abs(y(value) - y(0))),
          },
          negative: value < 0,
        };
      }),
    };
  }
  const place: PathPlacement = {
    orientation: "vertical",
    curve: input.curve,
    along: (at) => at,
    run: (centre) => [centre - SPARKLINE_CELL / 2, centre + SPARKLINE_CELL / 2],
    edge: (at) => at,
    across: (at) => at,
    lone: "cap",
    digits: PATH_DIGITS,
  };
  // The line through the readings from `start` up to `end`, each at its own place.
  const lineThrough = (start: number, end: number) => {
    const window = data.slice(start, end);
    const numbers = window.flatMap((value, offset) => [x(start + offset), y(value ?? 0)]);
    return linePaths(numbers.length === window.length * LINE_STRIDE ? numbers : [], topologyOf(window), place)
      .line;
  };
  const stroke = values.length === 0 ? "" : lineThrough(0, data.length);
  const reach = SEGMENT_REACH[input.curve];
  let fill = "";
  if (input.variant === "area" && values.length > 0) {
    const numbers = data.flatMap((value, index) => [x(index), y(value ?? 0), y(0)]);
    fill = areaPaths(
      numbers.length === data.length * AREA_STRIDE ? numbers : [],
      topologyOf(data),
      place
    ).area;
  }
  const last = data.length - 1;
  return {
    ...frame,
    kind: "path",
    viewBox,
    fill,
    stroke,
    fillZero: rounded(y(0)),
    readings: readings.map((reading) => ({
      ...reading,
      segment: lineThrough(Math.max(0, reading.index - reach), reading.index + reach + 1),
      band: [
        reading.index === 0 ? -BAND_BLEED : share(reading.index - 0.5),
        reading.index === last ? 100 + BAND_BLEED : share(reading.index + 1.5),
      ] as const,
    })),
  };
}

/** Where a Sparkline's values sit in time, for the slots its sentence names. */
export type SparklineSlots = {
  readonly start: number;
  readonly interval: Interval;
  readonly timeZone: string;
};

/**
 * A Sparkline's range sentence, such as "Lavest 23 øre kl. 03 til 04, høyest 178 øre kl. 17 til
 * 18.", in the spoken forms a screen reader reads, or the dictionary's `noData` with no value. Ties
 * name the first index.
 *
 * @param locale - The sentence's locale.
 * @param data - The values.
 * @param format - How the values print.
 * @param slots - The first value's slot, the interval and the zone, or undefined to name no slot.
 * @returns The sentence.
 */
export function sparklineSentence(
  locale: SupportedLocale,
  data: readonly (number | null)[],
  format: ValueFormat | undefined,
  slots: SparklineSlots | undefined
): string {
  const strings = CHART_STRINGS[locale];
  const low = extremeIndex(data, -1);
  const high = extremeIndex(data, 1);
  const lowValue = data[low];
  const highValue = data[high];
  if (lowValue === null || lowValue === undefined || highValue === null || highValue === undefined) {
    return `${strings.noData}.`;
  }
  const spoken = (value: number) => formatValue(locale, value, format ?? {}, "full").spoken;
  if (slots === undefined) return strings.sparklineRange(spoken(lowValue), spoken(highValue));
  const starts: number[] = [];
  let start = slotStart(slots.start, slots.interval, slots.timeZone);
  for (let index = 0; index <= Math.max(low, high); index += 1) {
    starts.push(start);
    start = nextSlotStart(start, slots.interval, slots.timeZone);
  }
  const at = (index: number) =>
    formatSlot(
      locale,
      slots.timeZone,
      starts[index] ?? slots.start,
      slots.interval,
      LABEL_PRESETS[slots.interval],
      "full"
    ).spoken;
  return strings.sparklineRangeAt(spoken(lowValue), at(low), spoken(highValue), at(high));
}
