/**
 * The words a live line chart prints and speaks: a reading's time and value in their formats, the
 * value's name, the option's name and the generated description. Every text reads the readings
 * alone, never the chart's clock, so the server and the browser write the same words. The module
 * calls no hook.
 */
import { countOf } from "../../intl/count-of";
import type { SupportedLocale } from "../../intl/locale-context";
import type { ValueFormat, XFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText, LabelRole } from "./format/formatted-text";
import { formatInstant } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { visibleSpan, windowEndingAt } from "./layout/live-window";
import type { LivePoint, LiveSpan } from "./layout/live-window";

/**
 * The formats a live line chart prints a reading's time in: a time preset or Intl options, but no
 * range preset, `"hour-range"` or `"time-range"`, since a reading is an instant with no span.
 *
 * @beta
 */
export type LiveLineChartTimeFormat = Exclude<XFormat, "hour-range" | "time-range">;

/** What the live words read from Root. */
export type LiveText = {
  readonly locale: SupportedLocale;
  /** The market's IANA zone, which every time prints in. */
  readonly timeZone: string;
  /** How a reading's time prints in the tooltip, the option, the table and the description. */
  readonly timeFormat: LiveLineChartTimeFormat;
  readonly valueFormat: ValueFormat;
  /** Root's `label`, or undefined for the dictionary's. */
  readonly label: string | undefined;
};

/**
 * A reading's time.
 *
 * @param text - The locale, the zone and the format.
 * @param time - The instant in epoch milliseconds.
 * @param role - "tick" for an axis label, "full" for a readout.
 * @param format - The format, Root's `timeFormat` by default.
 * @returns The visual and spoken time.
 */
export function liveTimeText(
  text: Pick<LiveText, "locale" | "timeZone" | "timeFormat">,
  time: number,
  role: LabelRole,
  format: LiveLineChartTimeFormat = text.timeFormat
): FormattedText {
  // A reading is an instant, so its time prints unfloored, fractional seconds and all.
  return formatInstant(text.locale, text.timeZone, time, "second", format, role);
}

/**
 * A reading's value in Root's `valueFormat`.
 *
 * @param text - The locale and the format.
 * @param value - The value.
 * @param role - "tick" for an axis label, "full" for a readout.
 * @returns The visual and spoken value.
 */
export function liveValueText(
  text: Pick<LiveText, "locale" | "valueFormat">,
  value: number,
  role: LabelRole
): FormattedText {
  return formatValue(text.locale, value, text.valueFormat, role);
}

/**
 * The value's name: Root's `label`, or the dictionary's "Verdi".
 *
 * @param text - The locale and Root's label.
 * @returns The name.
 */
export function liveName(text: Pick<LiveText, "locale" | "label">): string {
  return text.label ?? CHART_STRINGS[text.locale].liveValue;
}

/**
 * The readings the table and the description cover: the window's length back from the latest
 * reading, which the chart's clock never moves, so the server and the browser agree.
 *
 * @param points - The readings in time order.
 * @param duration - The window's length in milliseconds.
 * @returns The index range, empty with no reading.
 */
export function latestWindow(points: readonly LivePoint[], duration: number): LiveSpan {
  const latest = points.at(-1);
  return latest === undefined
    ? { first: 0, end: 0 }
    : visibleSpan(points, windowEndingAt(latest.time, duration));
}

/**
 * The single option's name for a reading: its time, then the value after its name, as
 * `kl. 12:00:05, Pris: 1,78 kroner`.
 *
 * @param text - The Root's words.
 * @param point - The reading.
 * @returns The spoken name.
 */
export function liveOptionName(text: LiveText, point: LivePoint): string {
  const time = liveTimeText(text, point.time, "full").spoken;
  return `${time}, ${liveName(text)}: ${liveValueText(text, point.value, "full").spoken}`;
}

/**
 * The generated description of the readings `latestWindow` covers: their span and count, the
 * value's lowest and highest reading with their times, and the latest value with its time, the
 * first tie of each extreme named.
 *
 * @param text - The Root's words.
 * @param points - The readings in time order.
 * @param duration - The window's length in milliseconds.
 * @param latest - The latest value, which Root's `value` may set apart from the latest reading.
 * @returns The description.
 */
export function liveDescription(
  text: LiveText,
  points: readonly LivePoint[],
  duration: number,
  latest: number | null
): string {
  const strings = CHART_STRINGS[text.locale];
  const { first, end } = latestWindow(points, duration);
  const oldest = points[first];
  const newest = points[end - 1];
  if (oldest === undefined || newest === undefined || latest === null) return `${strings.noData}.`;
  let low = oldest;
  let high = oldest;
  for (let index = first + 1; index < end; index += 1) {
    const point = points[index];
    if (point === undefined) continue;
    if (point.value < low.value) low = point;
    if (point.value > high.value) high = point;
  }
  const time = (point: LivePoint) => liveTimeText(text, point.time, "full").spoken;
  const value = (amount: number) => liveValueText(text, amount, "full").spoken;
  const count = countOf(text.locale, end - first, strings.points);
  return [
    strings.descriptionSpan(time(oldest), oldest === newest ? undefined : time(newest), count),
    strings.descriptionSeries(liveName(text), value(low.value), time(low), value(high.value), time(high)),
    strings.liveLatest(value(latest), time(newest)),
  ].join(" ");
}
