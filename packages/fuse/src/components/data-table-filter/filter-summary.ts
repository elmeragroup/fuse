// A chip's value summary in the LocaleProvider's locale. No noun takes a form chosen by a count:
// options list up to two labels and a bare "+N", and numbers and dates use the platform's own
// `formatRange`.

import { dateTimeFormat, listFormat, numberFormat } from "../../internal/intl-cache";
import type { FilterField } from "./filter-fields";
import { optionsOf } from "./filter-fields";
import type { FilterValue } from "./filter-model";

/** A summary and the whole value it may shorten. */
export type FilterSummary = {
  /** What the chip shows. */
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
};

/** Option labels a summary shows before "+N". */
const VISIBLE_OPTIONS = 2;

function utcDay(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Summarizes a filter value for its chip.
 *
 * @param value - The filter.
 * @param field - Its field, for option labels and the number format.
 * @param locale - The locale to format in.
 * @param strings - The locale's `moreValues` and `quoted` rows.
 * @returns The summary.
 */
export function summarize(
  value: FilterValue,
  field: FilterField,
  locale: string,
  strings: SummaryStrings
): FilterSummary {
  switch (value.kind) {
    case "option":
    case "multiOption": {
      const options = optionsOf(field);
      const labels = value.values.map(
        (item) => options.find((option) => option.value === item)?.label ?? item
      );
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
      const text =
        value.values.length === 2
          ? numbers.formatRange(value.values[0], value.values[1])
          : numbers.format(value.values[0]);
      return { text, full: text };
    }
    case "date": {
      // The values are calendar days, so they format in UTC, where midnight is that same day.
      const dates = dateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
      const text =
        value.values.length === 2
          ? dates.formatRange(utcDay(value.values[0]), utcDay(value.values[1]))
          : dates.format(utcDay(value.values[0]));
      return { text, full: text };
    }
  }
}
