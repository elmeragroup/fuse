/**
 * The paint model of a cartesian series, which the HTML bars, the path form and Root's active
 * overlay all read, after CONTRACT sections 4 and 11. Every paint reads the consumer's
 * `--chart-color-<key>` first, so an override wins for a role, a role list and a scale alike.
 */
import type { ChartColor } from "./chart-types";
import type { SeriesModel } from "./layout/cartesian-model";
import { colorBins } from "./layout/color-bins";
import type { ColorBins } from "./layout/color-bins";
import { seriesPaint } from "./layout/color-key";

/** Whether a colour is a decorative role list. */
export function isRoleList(color: ChartColor): color is Extract<ChartColor, readonly unknown[]> {
  return Array.isArray(color);
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

/**
 * The colour bins of a scale-coloured series over every row, or undefined for a role.
 *
 * @param color - The series colour.
 * @param series - The series.
 * @returns The value-to-step map.
 */
export function binsOf(
  color: ChartColor | undefined,
  series: SeriesModel | undefined
): ColorBins | undefined {
  if (series === undefined || (color !== "chart-seq" && color !== "chart-diverging")) return undefined;
  const values = series.readings.flatMap((reading) => (reading.kind === "reading" ? [reading.value] : []));
  return colorBins(color, values);
}

/**
 * One value's paint, or undefined when the series paint covers it, which is every value of a role
 * or a role list.
 *
 * @param key - The series key.
 * @param color - The series colour.
 * @param bins - The series' colour bins, for a scale.
 * @param value - The value.
 * @returns A CSS colour with the consumer override first.
 */
export function valuePaint(
  key: string,
  color: ChartColor,
  bins: ColorBins | undefined,
  value: number
): string | undefined {
  return bins === undefined ? undefined : seriesPaint(key, stepRole(color, bins(value)));
}

/**
 * A role list's colour stops from the bar's tip to its base, each with the consumer override first.
 *
 * @param key - The series key.
 * @param color - The series colour.
 * @returns One CSS colour per role, or undefined for a single role or a scale.
 */
export function listStops(key: string, color: ChartColor): string[] | undefined {
  return isRoleList(color) ? color.map((role) => seriesPaint(key, role)) : undefined;
}
