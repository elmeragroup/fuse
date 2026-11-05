/**
 * The paint model of a cartesian series, which the bars, the path form, lines, areas, the active
 * overlay, the point marks and the swatches all read, after CONTRACT sections 4 and 11. Every paint
 * reads the consumer's `--chart-color-<key>` first, so an override wins for a role, a role list, a
 * scale and both sides of a threshold alike.
 */
import type { ChartColor, ChartConfig, ChartScale } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { binEdges, colorBins } from "./layout/color-bins";
import type { ColorBins } from "./layout/color-bins";
import { isRoleList, isThresholdColor, seriesPaint } from "./layout/color-key";
import { ChartCompositionError } from "./layout/errors";
import type { Reading } from "./layout/readings";
import type { StackOffset } from "./layout/stack";

/** The scale a colour names, or undefined for every other colour. */
function scaleOf(color: ChartColor): ChartScale | undefined {
  return color === "chart-seq" || color === "chart-diverging" ? color : undefined;
}

/** The roles a colour paints with: a role, a list's roles, a threshold's two sides, or none for a scale. */
function rolesOf(color: ChartColor): readonly string[] {
  if (isRoleList(color)) return color;
  if (isThresholdColor(color)) return [color.below.color, color.above.color];
  return [color];
}

/**
 * The series whose threshold is not a finite number, in config order. Development throws
 * `non-finite-threshold` for the first, and production warns once for each and paints it in its
 * `below` role.
 *
 * @param config - The Root's config.
 * @returns The series keys, empty when every threshold is finite.
 */
export function nonFiniteThresholds(config: ChartConfig): readonly string[] {
  return Object.keys(config).filter((key) => {
    const color = config[key]?.color;
    return color !== undefined && isThresholdColor(color) && !Number.isFinite(color.threshold);
  });
}

/**
 * The error of one layout that mixes a sentiment role with a categorical role, which D4 forbids,
 * because a reader would take the categorical hue for a judgement. Each layout checks its own
 * keys: a Panel its `series`, and Root's default layout every config key when it draws.
 *
 * @param part - The layout's owner, `Chart.Root` or `Chart.Panel`.
 * @param config - The Root's config.
 * @param keys - The config keys the layout covers.
 * @returns The error, or null for a layout of one colour family.
 */
export function colourFamilyError(
  part: string,
  config: ChartConfig,
  keys: readonly string[]
): ChartCompositionError | null {
  const roles = keys.flatMap((key) => {
    const color = config[key]?.color;
    return color === undefined ? [] : rolesOf(color);
  });
  const sentiment = roles.some((role) => role.startsWith("chart-sentiment-"));
  const categorical = roles.some((role) => /^chart-\d$/u.test(role));
  return sentiment && categorical
    ? new ChartCompositionError(
        part,
        "mixed-sentiment-categorical",
        "mixes a sentiment role with a categorical role in one layout. Colour every series of the layout by sentiment, or every series by category."
      )
    : null;
}

/**
 * The error of a Line or Area coloured by a scale or a threshold whose values draw stacked. Both
 * split the series' own values along the value axis, and a stacked or expanded path draws at other
 * values, so no single gradient can paint it by value. Bars take either on a stack, because each
 * bar paints its own value.
 *
 * @param part - `Chart.Line` or `Chart.Area`.
 * @param color - The series colour.
 * @param stacked - Whether the series is in a stack of two or more keys.
 * @param stackOffset - Root's stack offset, which under "expand" redraws even a lone series.
 * @returns The error, or null for a path that draws its own values.
 */
export function stackedScaleError(
  part: string,
  color: ChartColor,
  stacked: boolean,
  stackOffset: StackOffset
): ChartCompositionError | null {
  const scale = scaleOf(color);
  if (scale === undefined && !isThresholdColor(color)) return null;
  if (!stacked && stackOffset !== "expand") return null;
  const named = scale === undefined ? "a threshold colour" : `color "${scale}"`;
  const split = scale === undefined ? "the threshold doesn't follow" : "the scale's bins don't follow";
  return new ChartCompositionError(
    part,
    "scale-colour-on-stack",
    `paints ${named} on ${stacked ? "a stacked series" : 'stackOffset="expand"'}, where the path draws at stacked values ${split}. Give the series a role, or draw it with Chart.Bar.`
  );
}

/** What a series paints with, which its marks, its active overlay and its swatches all read. */
export type SeriesPaint = {
  readonly key: string;
  readonly color: ChartColor;
  /**
   * The value-to-step map of a scale or a threshold, whose step k paints `ramp[k - 1]`, or
   * undefined for a role or a role list. A scale's bins read every reading, and a threshold's need
   * none.
   */
  readonly bins: ColorBins | undefined;
  /**
   * Where a path's gradient changes step, ascending: a scale's six bin edges, or a finite
   * threshold. Empty otherwise.
   */
  readonly edges: readonly number[];
  /**
   * The series paint, which a mark without a paint of its own takes: a role itself, a role list's
   * first stop, a scale's middle step or a threshold's `below` side.
   */
  readonly base: string;
  /** The role list's colour stops from the tip to the base, or undefined for every other colour. */
  readonly stops: readonly string[] | undefined;
  /**
   * The step paints, lowest first: a scale's 7, or a threshold's `below` and `above`. Undefined
   * for a role or a role list.
   */
  readonly ramp: readonly string[] | undefined;
};

const SCALE_STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

// One paint per series model and colour, so every mark and swatch of a model shares its bins.
const paints = new WeakMap<SeriesModel, Map<string, SeriesPaint>>();

/**
 * A threshold's two steps. A value above the threshold takes step 2, and a value at it or below
 * takes step 1, so a reading that equals the average reads as not above it. A threshold that is
 * not a finite number puts every value in step 1, production's `non-finite-threshold` fallback.
 */
function thresholdBins(threshold: number): ColorBins {
  if (!Number.isFinite(threshold)) return () => 1;
  return (value) => (value > threshold ? 2 : 1);
}

function buildPaint(key: string, color: ChartColor, series: SeriesModel | undefined): SeriesPaint {
  if (isRoleList(color)) {
    const stops = color.map((role) => seriesPaint(key, role));
    // The list's first stop.
    return {
      key,
      color,
      base: seriesPaint(key, color[0]),
      bins: undefined,
      edges: [],
      stops,
      ramp: undefined,
    };
  }
  if (isThresholdColor(color)) {
    const { threshold, below, above } = color;
    const ramp = [seriesPaint(key, below.color), seriesPaint(key, above.color)] as const;
    return {
      key,
      color,
      base: ramp[0],
      bins: thresholdBins(threshold),
      edges: Number.isFinite(threshold) ? [threshold] : [],
      stops: undefined,
      ramp,
    };
  }
  const scale = scaleOf(color);
  if (scale === undefined) {
    return {
      key,
      color,
      base: seriesPaint(key, color),
      bins: undefined,
      edges: [],
      stops: undefined,
      ramp: undefined,
    };
  }
  const values =
    series === undefined
      ? []
      : series.readings.flatMap((reading) => (reading.kind === "reading" ? [reading.value] : []));
  return {
    key,
    color,
    // The middle of the ramp's 7 steps.
    base: seriesPaint(key, `${scale}-4`),
    bins: series === undefined ? undefined : colorBins(scale, values),
    edges: binEdges(scale, values),
    stops: undefined,
    ramp: SCALE_STEPS.map((step) => seriesPaint(key, `${scale}-${String(step)}`)),
  };
}

/** What tells two colours' paints apart: a threshold's number and roles, never its labels. */
function paintId(color: ChartColor): string {
  if (isRoleList(color)) return color.join(",");
  if (isThresholdColor(color)) {
    return `threshold:${String(color.threshold)}:${color.below.color}:${color.above.color}`;
  }
  return color;
}

/**
 * A series' paint, every stop with the consumer's `--chart-color-<key>` first. It is built once per
 * series model, key and colour, so a pointer step that reads it only looks up the active value.
 *
 * @param key - The series key.
 * @param color - The series colour.
 * @param series - The series, whose readings a scale bins.
 * @returns The paint.
 */
export function seriesPaintOf(key: string, color: ChartColor, series: SeriesModel | undefined): SeriesPaint {
  if (series === undefined) return buildPaint(key, color, series);
  const id = `${key}\u0000${paintId(color)}`;
  const known = paints.get(series) ?? new Map<string, SeriesPaint>();
  paints.set(series, known);
  const paint = known.get(id) ?? buildPaint(key, color, series);
  known.set(id, paint);
  return paint;
}

/**
 * One value's paint: its scale step, or its threshold side. Undefined when the series paint covers
 * it, which is every value of a role or a role list.
 *
 * @param paint - The series paint.
 * @param value - The value.
 * @returns A CSS colour with the consumer override first.
 */
export function valuePaint(paint: SeriesPaint, value: number): string | undefined {
  return paint.bins === undefined ? undefined : paint.ramp?.[paint.bins(value) - 1];
}

/**
 * One reading's paint: its value's step under a scale or a threshold. Undefined for a slot with no
 * reading and for every reading of a role or a role list, which take the series paint.
 *
 * @param paint - The series paint.
 * @param reading - The slot's reading, if any.
 * @returns A CSS colour with the consumer override first.
 */
export function readingPaint(paint: SeriesPaint, reading: Reading | undefined): string | undefined {
  return reading?.kind === "reading" ? valuePaint(paint, reading.value) : undefined;
}
