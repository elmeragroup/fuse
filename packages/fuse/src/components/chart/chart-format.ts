/**
 * Fuse's chart text outside the chart. A headline figure or a peak-hour list beside a chart must
 * print the chart's own strings, so these two functions call the same private format modules the
 * parts call. Neither calls a hook or reads a provider, so a server component calls them too.
 */
import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartInstant, XFormat } from "./chart-types";
import type { FormattedText } from "./format/formatted-text";
import { formatSlot, LABEL_PRESETS } from "./format/time-format";
import type { Interval } from "./format/time-format";
import { formatValue } from "./format/value-format";
import type { ValueFormat } from "./format/value-format";

/**
 * A value as the chart prints it, such as the text `1,78 kr/kWh inkl. mva` with the spoken form
 * `1,78 norske kroner per kilowattime inkludert merverdiavgift`. Call it on the server or the
 * client.
 *
 * @param value - The value to print.
 * @param format - Intl number options or a Fuse preset. Without one, the locale's plain number.
 * @param options - The locale to print in.
 * @returns The visual and spoken text, with canonical spaces, so server and client agree byte for byte.
 * @beta
 */
export function formatChartValue(
  value: number,
  format: ValueFormat | undefined,
  options: { readonly locale: SupportedLocale }
): FormattedText {
  return formatValue(options.locale, value, format ?? {}, "full");
}

/**
 * The label of the slot that contains `at`, such as the text `17–18` with the spoken form
 * `kl. 17 til 18` for an hour. A day, week, month or year starts at the first instant of its first
 * local date in `timeZone`, and a shorter slot steps its fixed length from the first instant of its
 * day. So any instant inside the slot gives the same label, and a week's `date` label names its
 * Monday. `format` picks a preset or Intl date options. The default is the interval's label
 * preset, such as `hour-range` for an hour and `date` for a day. When Intl options hold both date
 * and time fields, Fuse joins the two halves itself with the CLDR 48 pattern for English,
 * Norwegian Bokmål, Swedish or Finnish, so every engine prints the same label. The `time-seconds`
 * preset of a `second` interval has no recipe yet and throws a `RangeError`.
 *
 * @param at - Any instant inside the slot.
 * @param interval - The slot length.
 * @param options - The locale, the IANA zone of the data's market and an optional format.
 * @returns The visual and spoken label, with canonical spaces.
 * @throws A `RangeError` when `timeZone` is not an IANA zone, a range preset meets a day or longer
 * interval, or the format is `time-seconds`. Each is a configuration defect.
 * @beta
 */
export function formatChartSlot(
  at: ChartInstant,
  interval: Interval,
  options: { readonly locale: SupportedLocale; readonly timeZone: string; readonly format?: XFormat }
): FormattedText {
  const { locale, timeZone, format = LABEL_PRESETS[interval] } = options;
  return formatSlot(locale, timeZone, at instanceof Date ? at.getTime() : at, interval, format, "full");
}
