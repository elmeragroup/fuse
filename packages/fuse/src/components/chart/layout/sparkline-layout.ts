/**
 * The Sparkline's geometry and its range sentence, after CONTRACT sections 6, 8.9 and 9.10 and
 * ticket 06's F4. A Sparkline draws on the server at no known size, so its marks live in a viewBox
 * of equal cells that the svg stretches to its box, and its strokes keep their width on screen.
 * Every value sits in its own cell, so a step curve keeps the last run, as on a chart.
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
import { PATH_DIGITS, pathNumber } from "./rounding";

/** The viewBox width of one value's cell. */
export const SPARKLINE_CELL = 10;

/** The viewBox height. */
export const SPARKLINE_HEIGHT = 100;

/** The share of a bar cell left empty around its bar, as a chart's default band gap. */
const BAR_GAP = 0.25;

/** What a Sparkline draws. */
export type SparklineLayout = {
  readonly viewBox: string;
  /** The mark: a line, an area's fill or the bars, empty with no reading. */
  readonly mark: string;
  /** An area's lone readings as round caps, which its fill cannot paint, empty for the others. */
  readonly lone: string;
  /** The zero line, where the domain spans 0, or null. */
  readonly zero: string | null;
  /** The flat reference line, or null. */
  readonly reference: string | null;
  /** The emphasised value's dot, or null. */
  readonly dot: string | null;
};

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

/**
 * Lay a Sparkline out in its viewBox.
 *
 * @param input - The values and the look.
 * @returns The path data of each part.
 */
export function sparklineLayout(input: SparklineInput): SparklineLayout {
  const { data } = input;
  const width = Math.max(1, data.length) * SPARKLINE_CELL;
  const viewBox = `0 0 ${String(width)} ${String(SPARKLINE_HEIGHT)}`;
  const values = data.flatMap((value) => (value === null ? [] : [value]));
  if (values.length === 0) return { viewBox, mark: "", lone: "", zero: null, reference: null, dot: null };
  const [low, high] = domainOf(values, input);
  const y = (value: number) => ((high - value) / (high - low)) * SPARKLINE_HEIGHT;
  const x = (index: number) => (index + 0.5) * SPARKLINE_CELL;
  const rule = (value: number) => `M0,${pathNumber(y(value))}H${pathNumber(width)}`;
  const topology: PathTopology = {
    count: data.length,
    states: data.map((value) => (value === null ? "missing" : "reading")),
    estimated: data.map(() => false),
    projectedFrom: data.length,
    sides: data.map(() => null),
    missing: "gap",
  };
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
  let mark: string;
  let lone = "";
  if (input.variant === "bar") {
    const bar = SPARKLINE_CELL * (1 - BAR_GAP);
    mark = data
      .flatMap((value, index) => {
        if (value === null) return [];
        const top = Math.min(y(value), y(0));
        const height = Math.abs(y(value) - y(0));
        return [
          `M${pathNumber(x(index) - bar / 2)},${pathNumber(top)}h${pathNumber(bar)}v${pathNumber(height)}h${pathNumber(-bar)}Z`,
        ];
      })
      .join("");
  } else if (input.variant === "area") {
    const numbers = data.flatMap((value, index) => [x(index), y(value ?? 0), y(0)]);
    const paths = areaPaths(numbers.length === data.length * AREA_STRIDE ? numbers : [], topology, place);
    mark = paths.area;
    lone = paths.dots;
  } else {
    const numbers = data.flatMap((value, index) => [x(index), y(value ?? 0)]);
    mark = linePaths(numbers.length === data.length * LINE_STRIDE ? numbers : [], topology, place).line;
  }
  const picked = emphasisIndex(data, input.emphasis);
  const pickedValue = picked === -1 ? null : (data[picked] ?? null);
  return {
    viewBox,
    mark,
    lone,
    zero: low < 0 && high > 0 ? rule(0) : null,
    reference: input.reference === undefined ? null : rule(input.reference),
    dot: pickedValue === null ? null : `M${pathNumber(x(picked))},${pathNumber(y(pickedValue))}Z`,
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
