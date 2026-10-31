"use client";

import { createContext, Fragment, use, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretDoubleLeft } from "../../icons/generated/caret-double-left";
import { CaretDoubleRight } from "../../icons/generated/caret-double-right";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import { pageStatus } from "../data-table/data-table-pagination-status";
import { dataTableStrings } from "../data-table/intl";
import { Table } from "../table/table";
import { useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { usePendingOr } from "./chart-pending-root";
import { qualityWords, seriesLabel, slotLabel, stackTotalAt } from "./chart-text";
import type { ChartLayerProps, ChartScalar, ValueFormat, XFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatSlot, slotStart } from "./format/time-format";
import type { Interval, TimePreset } from "./format/time-format";
import { formatUnitLabel, formatUnitless, formatValue } from "./format/value-format";
import { rowSpans } from "./layout/coarse-slots";
import { ChartDataError, DATA_MESSAGES, isChartDevelopment } from "./layout/errors";
import { numberOf, stringOf } from "./layout/scalar";

/**
 * Props for `Chart.Table`, a closed part.
 *
 * @beta
 */
export type ChartTableProps = ChartLayerProps & {
  /** Replaces the generated caption, the chart name and the period. */
  caption?: string;
  /** Replaces the first column's header, which the interval picks. */
  xHeader?: string;
  /** Replaces the dictionary's "Vis som tabell". */
  showLabel?: string;
  /** Replaces the dictionary's "Skjul tabell". */
  hideLabel?: string;
  /** Extra columns as `TableColumn` parts, after the series and total columns. */
  children?: ReactNode;
};

/**
 * Props for `Chart.TableColumn`, a closed part.
 *
 * @beta
 */
export type ChartTableColumnProps = ChartLayerProps & {
  /** The row column to list. It names a row column, not a config key. */
  dataKey: string;
  /** The column header. */
  header: string;
  /** How number and `Date` cells print. */
  format?: ValueFormat | XFormat;
};

/** Where a TableColumn renders: in the header row, or in the body row of one slot. */
type TableRowValue = { readonly kind: "header" } | { readonly kind: "row"; readonly slot: number };

const ChartTableRowContext = createContext<TableRowValue | null>(null);

/** Above this many rows the table pages by calendar period, after CONTRACT section 9.6. */
const PAGE_ROWS = 500;

/** The calendar period one page holds at each interval, the coarsest whose largest instance fits. */
const PAGE_PERIOD = {
  second: "minute",
  minute: "hour",
  "quarter-hour": "day",
  hour: "week",
  day: "year",
  week: "year",
  month: "year",
  year: "year",
} as const satisfies { readonly [I in Interval]: Interval };

/** The label each page period prints in the status, such as `uke 2`. */
const PAGE_LABEL = {
  minute: "time",
  hour: "hour",
  day: "date",
  week: "week",
  year: "year",
} as const satisfies { readonly [I in (typeof PAGE_PERIOD)[Interval]]: TimePreset };

/** One page: its key, the page period's start or the first row's position, and its slots. */
/** One table page with its key, its slots, and its period as the pagination shows and speaks it. */
type Page = {
  readonly key: number;
  readonly slots: readonly number[];
  readonly label: string;
  readonly spoken: string;
};

/** The words a twin cell shows and speaks. */
function Twin({ text }: { readonly text: FormattedText }): ReactNode {
  if (text.text === text.spoken) return text.text;
  return (
    <>
      <span aria-hidden="true">{text.text}</span>
      <span className="sr-only">{text.spoken}</span>
    </>
  );
}

/** The slots the table lists: every slot that holds a reading or a missing reading in some series. */
function tableSlots(context: Pick<ChartRootContextValue, "model">): number[] {
  const { series, domain } = context.model;
  const count = domain.kind === "time" ? domain.starts.length : domain.names.length;
  const slots: number[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    if (series.some(({ readings }) => readings[slot]?.kind !== "pending")) slots.push(slot);
  }
  return slots;
}

/** The table's pages: one for 500 rows or fewer, else one per calendar period or per 500 categories. */
function tablePages(
  context: Pick<ChartRootContextValue, "model" | "locale">,
  slots: readonly number[]
): Page[] {
  const { domain } = context.model;
  const strings = CHART_STRINGS[context.locale];
  if (slots.length <= PAGE_ROWS) return [{ key: 0, slots, label: "", spoken: "" }];
  if (domain.kind === "category") {
    const pages: Page[] = [];
    for (let from = 0; from < slots.length; from += PAGE_ROWS) {
      const page = slots.slice(from, from + PAGE_ROWS);
      const range = strings.rowRange(String(from + 1), String(from + page.length));
      pages.push({ key: from, slots: page, label: range, spoken: range });
    }
    return pages;
  }
  const period = PAGE_PERIOD[domain.interval];
  const pages = new Map<number, number[]>();
  for (const slot of slots) {
    const start = slotStart(domain.starts[slot] ?? 0, period, domain.timeZone);
    const page = pages.get(start);
    if (page === undefined) pages.set(start, [slot]);
    else page.push(slot);
  }
  return [...pages].map(([key, list]) => {
    const label = formatSlot(context.locale, domain.timeZone, key, period, PAGE_LABEL[period], "full");
    return { key, slots: list, label: label.text, spoken: label.spoken };
  });
}

/** The caption: the chart name and the period the rows span. */
function captionText(context: ChartRootContextValue, slots: readonly number[]): string {
  const { domain } = context.model;
  const first = slots[0] ?? 0;
  const last = slots.at(-1) ?? first;
  let period: string;
  if (domain.kind === "category") {
    period = CHART_STRINGS[context.locale].valueRange(domain.names[first] ?? "", domain.names[last] ?? "");
  } else {
    const options: Intl.DateTimeFormatOptions =
      domain.interval === "year"
        ? { year: "numeric" }
        : domain.interval === "month"
          ? { month: "long", year: "numeric" }
          : { day: "numeric", month: "long", year: "numeric" };
    const label = (slot: number) =>
      formatSlot(context.locale, domain.timeZone, domain.starts[slot] ?? 0, domain.interval, options, "full")
        .text;
    const from = label(first);
    const to = label(last);
    period = from === to ? from : CHART_STRINGS[context.locale].valueRange(from, to);
  }
  return context.name === undefined ? period : `${context.name}, ${period}`;
}

/** The first column's header, which the interval picks. */
function xHeaderText(context: ChartRootContextValue): string {
  const strings = CHART_STRINGS[context.locale];
  const { domain } = context.model;
  if (domain.kind === "category") return strings.xHeaderCategory;
  switch (domain.interval) {
    case "second":
    case "minute":
    case "quarter-hour":
    case "hour":
      return strings.xHeaderTime;
    case "day":
      return strings.xHeaderDay;
    case "week":
      return strings.xHeaderWeek;
    case "month":
      return strings.xHeaderMonth;
    case "year":
      return strings.xHeaderYear;
  }
}

/** A series column's header, the label followed by the format's unit. */
function seriesHeader(context: ChartRootContextValue, key: string): FormattedText {
  const label = seriesLabel(context, key);
  const unit = formatUnitLabel(context.locale, context.config[key]?.format ?? {});
  if (unit === null) return label;
  return { text: `${label.text} (${unit.text})`, spoken: `${label.spoken} (${unit.spoken})` };
}

/**
 * One series cell: the unitless value with its quality and projection words, or the missing dash.
 * The space before each word sits outside the word's muted span, because accessible-name rules
 * that join inline children drop a space inside it, and a reader would hear "0,42(estimert)".
 */
function SeriesCell({
  context,
  seriesIndex,
  slot,
  rows,
}: {
  readonly context: ChartRootContextValue;
  readonly seriesIndex: number;
  readonly slot: number;
  /** How many rows the cell spans, more than 1 for a coarse series' slot. */
  readonly rows: number;
}): ReactNode {
  const strings = CHART_STRINGS[context.locale];
  const series = context.model.series[seriesIndex];
  const reading = series?.readings[slot];
  const span = rows > 1 ? { rowSpan: rows } : {};
  if (series === undefined || reading === undefined || reading.kind === "pending") {
    return (
      <Table.Cell {...span}>
        <span className="sr-only">{strings.pending}</span>
      </Table.Cell>
    );
  }
  if (reading.kind === "missing") {
    return (
      <Table.Cell {...span}>
        <Twin text={{ text: "–", spoken: strings.missing }} />
      </Table.Cell>
    );
  }
  const value = formatUnitless(context.locale, reading.value, context.config[series.key]?.format ?? {});
  const words = qualityWords(context.locale, reading.quality, slot >= series.projectedFrom);
  return (
    <Table.Cell {...span}>
      <Twin text={value} />
      {words.map((word) => (
        <Fragment key={word}>
          {" "}
          <span data-quality="">{`(${word})`}</span>
        </Fragment>
      ))}
    </Table.Cell>
  );
}

/** One stack's total cell: the sum of the present parts, with the incomplete word for a missing part. */
function TotalCell({
  context,
  keys,
  slot,
}: {
  readonly context: ChartRootContextValue;
  readonly keys: readonly string[];
  readonly slot: number;
}): ReactNode {
  const strings = CHART_STRINGS[context.locale];
  const sum = stackTotalAt(context.model, keys, slot);
  if (sum === null) {
    return (
      <Table.Cell>
        <Twin text={{ text: "–", spoken: strings.missing }} />
      </Table.Cell>
    );
  }
  const value = formatUnitless(context.locale, sum.total, context.config[keys[0] ?? ""]?.format ?? {});
  return (
    <Table.Cell>
      <Twin text={value} />
      {sum.incomplete ? (
        <>
          {" "}
          <span data-quality="">{`(${strings.incomplete})`}</span>
        </>
      ) : null}
    </Table.Cell>
  );
}

/**
 * A "Vis som tabell" button and the chart's data as a table, which stays in the accessibility tree
 * while it is visually collapsed. The table lists every slot of the full data, pages past 500 rows
 * by calendar period, and carries one column per series and per multi-series stack total. Its
 * `TableColumn` children render once in the header row and once in each body row.
 *
 * @beta
 */
export function ChartTable(props: ChartTableProps): ReactElement {
  return usePendingOr(props, ChartTableBody);
}

function ChartTableBody({
  caption,
  xHeader,
  showLabel,
  hideLabel,
  className,
  style,
  children,
}: ChartTableProps): ReactElement {
  const context = useChartRoot("Chart.Table");
  const strings = CHART_STRINGS[context.locale];
  const tableStrings = useLocalizedStrings(dataTableStrings);
  const [shown, setShown] = useState(false);
  const [pageKey, setPageKey] = useState<number | null>(null);
  const table = useRef<HTMLTableElement>(null);
  const focusTable = useRef(false);
  useEffect(() => {
    if (!focusTable.current) return;
    focusTable.current = false;
    table.current?.focus();
  }, [shown]);
  // The slots and pages read the whole domain, so they wait for a new model or locale.
  const { model, locale } = context;
  const slots = useMemo(() => tableSlots({ model }), [model]);
  const pages = useMemo(() => tablePages({ model, locale }, slots), [model, locale, slots]);
  // A vanished page period clamps to the nearest remaining one.
  let index = 0;
  if (pageKey !== null) {
    let distance = Number.POSITIVE_INFINITY;
    pages.forEach((page, position) => {
      const gap = Math.abs(page.key - pageKey);
      if (gap < distance) {
        distance = gap;
        index = position;
      }
    });
  }
  const page = pages[index] ?? { key: 0, slots: [], label: "", spoken: "" };
  const spans = new Map(
    context.model.series.flatMap(({ key, coarse }) =>
      coarse === undefined ? [] : [[key, rowSpans(page.slots, coarse)] as const]
    )
  );
  if (context.model.empty) return <></>;
  const id = `${context.id}-rows`;
  const stacks = context.model.stacks;
  const status = pageStatus(index, { kind: "known", pageCount: pages.length });
  const statusText = strings.pageStatus(String(index + 1), String(pages.length), page.label);
  const go = (next: number): void => {
    const target = pages[next];
    if (target === undefined || next === index) return;
    setPageKey(target.key);
    // The status region reads the spoken period, such as `week 41` for the visible `W41`.
    context.store.announce(strings.pageStatus(String(next + 1), String(pages.length), target.spoken));
  };
  const hiddenClass = shown ? undefined : cn("sr-only");
  const controlTab = shown ? undefined : -1;
  // Each move's target page, after the data table's pagination moves.
  const moves = [
    { key: "first", label: "goToFirstPage", Icon: CaretDoubleLeft, target: 0, enabled: status.canPrevious },
    {
      key: "previous",
      label: "goToPreviousPage",
      Icon: CaretLeft,
      target: index - 1,
      enabled: status.canPrevious,
    },
    { key: "next", label: "goToNextPage", Icon: CaretRight, target: index + 1, enabled: status.canNext },
    {
      key: "last",
      label: "goToLastPage",
      Icon: CaretDoubleRight,
      target: pages.length - 1,
      enabled: status.canNext,
    },
  ] as const;
  return (
    <div data-slot="chart-table" className={className} style={style}>
      <Button
        data-slot="chart-table-toggle"
        variant="outline"
        size="xs"
        aria-controls={id}
        onClick={() => {
          focusTable.current = !shown;
          setShown(!shown);
        }}>
        {shown ? (hideLabel ?? strings.hideTable) : (showLabel ?? strings.showTable)}
      </Button>
      {/* Shown, the table takes a Tab stop, so a keyboard can scroll a table wider than its box. */}
      <Table.Root
        id={id}
        ref={table}
        tabIndex={shown ? 0 : -1}
        data-slot="chart-table-content"
        className={hiddenClass}>
        <Table.Caption>{caption ?? captionText(context, slots)}</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head scope="col">{xHeader ?? xHeaderText(context)}</Table.Head>
            {context.model.series.map(({ key }) => (
              <Table.Head key={key} scope="col">
                <Twin text={seriesHeader(context, key)} />
              </Table.Head>
            ))}
            {stacks.map(({ id: stack }) => (
              <Table.Head key={`total-${stack}`} scope="col">
                {stacks.length > 1 ? `${strings.total} ${stack}` : strings.total}
              </Table.Head>
            ))}
            <ChartTableRowContext value={{ kind: "header" }}>{children}</ChartTableRowContext>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {page.slots.map((slot, row) => (
            <Table.Row key={context.update.keys[slot] ?? slot}>
              <Table.Head scope="row">
                <Twin text={slotLabel(context, slot)} />
              </Table.Head>
              {context.model.series.map(({ key, seriesIndex }) => {
                // A coarse cell spans the rows of its slot, so each coarse value appears once.
                const rows = spans.get(key)?.[row] ?? 1;
                return rows === 0 ? null : (
                  <SeriesCell key={key} context={context} seriesIndex={seriesIndex} slot={slot} rows={rows} />
                );
              })}
              {stacks.map(({ id: stack, keys }) => (
                <TotalCell key={`total-${stack}`} context={context} keys={keys} slot={slot} />
              ))}
              <ChartTableRowContext value={{ kind: "row", slot }}>{children}</ChartTableRowContext>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {pages.length > 1 ? (
        <div data-slot="chart-table-pagination" className={hiddenClass}>
          {moves.map(({ key, label, Icon, target, enabled }) => (
            <Fragment key={key}>
              {key === "next" ? <span>{statusText}</span> : null}
              <Button
                variant="outline"
                size="icon-xs"
                aria-label={tableStrings.format(label)}
                tabIndex={controlTab}
                disabled={!enabled}
                onClick={() => {
                  go(target);
                }}>
                <Icon aria-hidden="true" />
              </Button>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The interval a time preset names, so a `Date` cell reads the slot that contains it. */
const PRESET_INTERVAL = {
  hour: "hour",
  "hour-range": "hour",
  time: "minute",
  "time-seconds": "second",
  "time-range": "quarter-hour",
  day: "day",
  weekday: "day",
  date: "day",
  week: "week",
  month: "month",
  "month-year": "month",
  year: "year",
} as const satisfies { readonly [P in TimePreset]: Interval };

/** The Intl date-time option names, which tell an `XFormat` object from Intl number options. */
const DATE_FIELDS = new Set([
  "dateStyle",
  "timeStyle",
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "hour12",
  "hourCycle",
]);

/** Whether a format names a time preset. Every ValueFormat is an object, so a string is a preset. */
function isPreset(format: ValueFormat | XFormat): format is TimePreset {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: a TableColumn format is a preset string or an options object
  return typeof format === "string";
}

/** Whether a TableColumn format is an `XFormat`, a time preset or Intl date-time options. */
function isTimeFormat(format: ValueFormat | XFormat): format is XFormat {
  return isPreset(format) || Object.keys(format).some((field) => DATE_FIELDS.has(field));
}

/** The development throw or production warning of `table-column-format`, once per Root. */
function formatMismatch(context: ChartRootContextValue): void {
  const error = new ChartDataError(
    "Chart.TableColumn",
    "table-column-format",
    DATA_MESSAGES["table-column-format"]
  );
  if (isChartDevelopment()) throw error;
  context.warnOnce("table-column-format", error.message);
}

/** A TableColumn cell's text. */
function columnCell(
  context: ChartRootContextValue,
  cell: ChartScalar,
  format: ValueFormat | XFormat | undefined
): FormattedText {
  const time = format !== undefined && isTimeFormat(format);
  if (cell instanceof Date) {
    if (format !== undefined && !time) formatMismatch(context);
    const zone = context.model.domain.kind === "time" ? context.model.domain.timeZone : "UTC";
    const preset: XFormat = format !== undefined && time ? format : "date";
    const interval = isPreset(preset) ? PRESET_INTERVAL[preset] : "second";
    return formatSlot(context.locale, zone, cell.getTime(), interval, preset, "full");
  }
  const number = numberOf(cell);
  if (number !== undefined && Number.isFinite(number)) {
    if (time) formatMismatch(context);
    const value = format !== undefined && !time ? format : {};
    return formatValue(context.locale, number, value, "full");
  }
  const text = stringOf(cell);
  if (text !== undefined) return { text, spoken: text };
  return { text: "–", spoken: CHART_STRINGS[context.locale].missing };
}

/**
 * A table column for a row column that the chart does not plot, such as a change percentage or the
 * hour of a day's peak. Number cells print through a `ValueFormat`, `Date` cells through an
 * `XFormat` in Root's zone, strings verbatim, and every other cell as `–`. A format that does not
 * fit its cells throws `table-column-format` in development, and a column no row holds warns
 * `absent-column` there.
 *
 * @beta
 */
export function ChartTableColumn(props: ChartTableColumnProps): ReactElement {
  return usePendingOr(props, ChartTableColumnBody);
}

function ChartTableColumnBody({
  dataKey,
  header,
  format,
  className,
  style,
}: ChartTableColumnProps): ReactElement {
  const context = useChartRoot("Chart.TableColumn");
  const row = use(ChartTableRowContext);
  if (row?.kind === "header") {
    if (isChartDevelopment() && !context.rows.some((entry) => Object.hasOwn(entry, dataKey))) {
      context.warnOnce(
        "absent-column",
        `Chart.TableColumn lists ${JSON.stringify(dataKey)}, a column no row holds, so every cell prints –. Check the dataKey against the rows.`
      );
    }
    return (
      <Table.Head scope="col" className={className} style={style}>
        <span data-slot="chart-table-column">{header}</span>
      </Table.Head>
    );
  }
  if (row === null) return <></>;
  const index = context.model.rowAt[row.slot];
  const cell = index === undefined ? undefined : context.rows[index]?.[dataKey];
  return (
    <Table.Cell className={className} style={style}>
      <span data-slot="chart-table-column">
        <Twin text={columnCell(context, cell, format)} />
      </span>
    </Table.Cell>
  );
}

Object.assign(ChartTable, { displayName: "Chart.Table" });
Object.assign(ChartTableColumn, { displayName: "Chart.TableColumn" });
