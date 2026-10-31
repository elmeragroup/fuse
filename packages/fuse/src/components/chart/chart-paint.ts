/**
 * The paint model of a cartesian series, which the bars, the path form, lines, areas, the active
 * overlay and the swatches all read, after CONTRACT sections 4 and 11. Every paint reads the
 * consumer's `--chart-color-<key>` first, so an override wins for a role, a role list and a scale
 * alike.
 */
import type { ChartColor, ChartConfig } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { binEdges, colorBins } from "./layout/color-bins";
import type { ColorBins } from "./layout/color-bins";
import { seriesPaint } from "./layout/color-key";
import { ChartCompositionError } from "./layout/errors";
import type { StackOffset } from "./layout/stack";

/** Whether a colour is a decorative role list. */
export function isRoleList(color: ChartColor): color is Extract<ChartColor, readonly unknown[]> {
  return Array.isArray(color);
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
    if (color === undefined) return [];
    return isRoleList(color) ? [...color] : [color];
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
 * The error of a scale-coloured Line or Area whose values draw stacked. A scale's bins split the
 * series' own values along the value axis, and a stacked or expanded path draws at other values, so
 * no single gradient can paint it by value. Bars take a scale on a stack, because each bar paints
 * its own value.
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
  if (color !== "chart-seq" && color !== "chart-diverging") return null;
  if (!stacked && stackOffset !== "expand") return null;
  return new ChartCompositionError(
    part,
    "scale-colour-on-stack",
    `paints color "${color}" on ${stacked ? "a stacked series" : 'stackOffset="expand"'}, where the path draws at stacked values the scale's bins don't follow. Give the series a role, or draw it with Chart.Bar.`
  );
}

/**
 * The role a colour names at one scale step: a role itself, a role list's first role, or a scale's
 * step, 4 when the step is unknown.
 *
 * @param color - The series colour.
 * @param step - The scale step of the value, if the colour is a scale.
 * @returns The role name.
 */
export function stepRole(color: ChartColor, step: number | undefined): string {
  if (isRoleList(color)) return color[0];
  if (color === "chart-seq" || color === "chart-diverging") return `${color}-${String(step ?? 4)}`;
  return color;
}

/** What a series paints with, which its marks, its active overlay and its swatches all read. */
export type SeriesPaint = {
  readonly key: string;
  readonly color: ChartColor;
  /** A scale's value-to-step map over every reading, or undefined for a role or a role list. */
  readonly bins: ColorBins | undefined;
  /** A scale's six bin edges, ascending, where a path's gradient changes step. Empty otherwise. */
  readonly edges: readonly number[];
  /** The series paint, which a mark without a paint of its own takes. */
  readonly base: string;
  /** The role list's colour stops from the tip to the base, or undefined for a role or a scale. */
  readonly stops: readonly string[] | undefined;
  /** A scale's 7 step paints, lowest first, or undefined for a role or a role list. */
  readonly ramp: readonly string[] | undefined;
};

const SCALE_STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

// One paint per series model and colour, so every mark and swatch of a model shares its bins.
const paints = new WeakMap<SeriesModel, Map<string, SeriesPaint>>();

function buildPaint(key: string, color: ChartColor, series: SeriesModel | undefined): SeriesPaint {
  const scale = color === "chart-seq" || color === "chart-diverging" ? color : undefined;
  const values =
    scale === undefined || series === undefined
      ? []
      : series.readings.flatMap((reading) => (reading.kind === "reading" ? [reading.value] : []));
  return {
    key,
    color,
    bins: scale === undefined || series === undefined ? undefined : colorBins(scale, values),
    edges: scale === undefined ? [] : binEdges(scale, values),
    base: seriesPaint(key, stepRole(color, undefined)),
    stops: isRoleList(color) ? color.map((role) => seriesPaint(key, role)) : undefined,
    ramp:
      scale === undefined
        ? undefined
        : SCALE_STEPS.map((step) => seriesPaint(key, `${scale}-${String(step)}`)),
  };
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
  const id = `${key}\u0000${isRoleList(color) ? color.join(",") : color}`;
  const known = paints.get(series) ?? new Map<string, SeriesPaint>();
  paints.set(series, known);
  const paint = known.get(id) ?? buildPaint(key, color, series);
  known.set(id, paint);
  return paint;
}

/**
 * One value's paint, or undefined when the series paint covers it, which is every value of a role
 * or a role list.
 *
 * @param paint - The series paint.
 * @param value - The value.
 * @returns A CSS colour with the consumer override first.
 */
export function valuePaint(paint: SeriesPaint, value: number): string | undefined {
  return paint.bins === undefined ? undefined : paint.ramp?.[paint.bins(value) - 1];
}
