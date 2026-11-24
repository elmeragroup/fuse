// A chip's value summary in the LocaleProvider's locale. No noun takes a form chosen by a count:
// options list up to two labels and a bare "+N". A date range writes both ends in full and joins
// them with the locale's `rangeSeparator`, because `Intl.DateTimeFormat#formatRange` shortens a
// range differently by engine. A range from a day to the same day writes that day once. A name
// the runtime supplies can still differ by engine, such as a currency's name under
// `currencyDisplay: "name"`.

import { dateTimeFormat, listFormat, numberFormat } from "../../internal/intl-cache";
import { canonicalSpaces } from "../../intl/canonical-spaces";
import type { SupportedLocale } from "../../intl/locale-context";
import { rangeSeparator } from "../../intl/range-separator";
import type { FilterField } from "./filter-fields";
import { optionsOf } from "./filter-fields";
import type { FilterValue } from "./filter-model";
import { booleanLabel } from "./option-list";

/** A summary and the whole value it may shorten. */
export type FilterSummary = {
  /** The text the chip shows. */
  readonly text: string;
  /** The whole value, which the chip also states when `text` is shortened. */
  readonly full: string;
};

/** The dictionary rows a summary uses, already bound to the locale. */
export type SummaryStrings = {
  /** The "+N" after the shown labels, given the formatted count. */
  readonly moreValues: (count: string) => string;
  /** A text value in the locale's quotation marks. */
  readonly quoted: (text: string) => string;
  /** A boolean's `true` when its field names none. */
  readonly yes: string;
  /** A boolean's `false` when its field names none. */
  readonly no: string;
};

/** The number of option labels a summary shows before "+N". */
const VISIBLE_OPTIONS = 2;

function utcDay(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Summarizes a filter value for its chip.
 *
 * @param value - The filter.
 * @param field - Its field, for option labels, boolean labels and the number format.
 * @param locale - The locale to format in.
 * @param strings - The locale's `moreValues`, `quoted`, `yes` and `no` rows.
 * @returns The summary.
 */
export function summarize(
  value: FilterValue,
  field: FilterField,
  locale: SupportedLocale,
  strings: SummaryStrings
): FilterSummary {
  switch (value.kind) {
    case "option":
    case "multiOption": {
      // First option wins on a repeated value, as the chip's icon lookup does.
      const labelOf = new Map<string, string>();
      for (const option of optionsOf(field)) {
        if (!labelOf.has(option.value)) labelOf.set(option.value, option.label);
      }
      const labels = value.values.map((item) => labelOf.get(item) ?? item);
      const list = listFormat(locale, { type: "unit", style: "short" });
      const shown = labels.slice(0, VISIBLE_OPTIONS);
      const rest = labels.length - shown.length;
      const text =
        rest > 0
          ? `${list.format(shown)} ${strings.moreValues(numberFormat(locale).format(rest))}`
          : list.format(shown);
      return { text, full: list.format(labels) };
    }
    case "text": {
      const text = strings.quoted(value.values[0]);
      return { text, full: text };
    }
    case "number": {
      const numbers = numberFormat(locale, field.kind === "number" ? field.format : undefined);
      // Intl applies CLDR's number range pattern, which spaces the dash around a sign and writes an
      // affix both ends share once, such as `NOK 100–500`.
      const text =
        value.values.length === 2
          ? canonicalSpaces(numbers.formatRange(value.values[0], value.values[1]))
          : numbers.format(value.values[0]);
      return { text, full: text };
    }
    case "date": {
      // The values are calendar days, so they format in UTC, where midnight is that same day.
      const dates = dateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
      const first = dates.format(utcDay(value.values[0]));
      const last = value.values.length === 2 ? dates.format(utcDay(value.values[1])) : first;
      const text = last === first ? first : `${first}${rangeSeparator(locale)}${last}`;
      return { text, full: text };
    }
    case "boolean": {
      const text = booleanLabel(field.kind === "boolean" ? field : {}, value.values[0], strings);
      return { text, full: text };
    }
  }
}
