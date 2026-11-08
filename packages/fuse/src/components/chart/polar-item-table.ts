"use client";

/**
 * The item table a pie's and a radial chart's Table part builds, in a module of the Table's own, so a
 * Root with no Table never loads it.
 */
import type { ItemSource } from "./chart-polar-item";
import { qualityOf, sharedFormat, shareWords, valueOf } from "./chart-polar-item";
import type { ChartTableCell, ChartTableModel } from "./chart-readout-port";
import type { ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { POLAR_STRINGS } from "./format/polar-strings";
import { seriesLabel } from "./format/series-label";
import { formatUnitLabel, formatUnitless, formatValue } from "./format/value-format";

/**
 * The rows of an item table: every original row unfolded, with its value and its share or maximum.
 *
 * @param source - The items, their rows and the Root's input.
 * @param rowShares - Each row's share in percent at some digits, or null where it has none.
 * @returns The table.
 */
export function itemTable(
  source: ItemSource,
  rowShares: (digits: number) => (number | null)[]
): ChartTableModel {
  const { rows, input } = source;
  const { locale, config, valueFormat } = input;
  const strings = CHART_STRINGS[locale];
  const polarStrings = POLAR_STRINGS[locale];
  const formatOf = (category: string): ValueFormat => config[category]?.format ?? valueFormat ?? {};
  const shared = sharedFormat(rows.map(({ category }) => ({ format: formatOf(category) })));
  const unit = shared === null ? null : formatUnitLabel(locale, shared);
  const header = (word: string): FormattedText =>
    unit === null
      ? { text: word, spoken: word }
      : { text: `${word} (${unit.text})`, spoken: `${word} (${unit.spoken})` };
  const numberCell = (
    key: string,
    value: number | null,
    format: ValueFormat,
    words: readonly string[]
  ): ChartTableCell => {
    if (value === null)
      return { kind: "value", key, text: { text: "–", spoken: strings.missing }, words: [], rows: 1 };
    const text =
      shared === null ? formatValue(locale, value, format, "full") : formatUnitless(locale, value, format);
    return { kind: "value", key, text, words, rows: 1 };
  };
  const page = { key: 0, slots: rows.map((_, index) => index), label: "", spoken: "" };
  return {
    pages: () => [page],
    caption: () => input.name ?? "",
    xHeader: () => strings.xHeaderCategory,
    heads: () => [
      header(polarStrings.valueHeader),
      source.third === "share"
        ? { text: polarStrings.shareHeader, spoken: polarStrings.shareHeader }
        : header(polarStrings.maxHeader),
    ],
    rows: () => {
      const shares = rowShares(0);
      return rows.map((row, index) => {
        const format = formatOf(row.category);
        const quality = qualityOf(row.reading);
        const words = quality === undefined || quality === "missing" ? [] : [strings[quality]];
        const third: ChartTableCell =
          source.third === "share"
            ? {
                kind: "value",
                key: "share",
                text: shareWords(locale, shares[index] ?? null, 0),
                words: [],
                rows: 1,
              }
            : numberCell("max", source.max(index), format, []);
        return {
          key: `${row.category}\u0000${String(index)}`,
          slot: index,
          head: row.known
            ? seriesLabel({ config }, row.category)
            : { text: row.category, spoken: row.category },
          cells: [numberCell("value", valueOf(row.reading), format, words), third],
        };
      });
    },
    // A slot is a kept row, so a table column reads the row it came from in `data`.
    cell: (slot, column) => input.rows[rows[slot]?.row ?? -1]?.[column],
    hasColumn: (column) => input.rows.some((row) => Object.hasOwn(row, column)),
    timeZone: "UTC",
  };
}
