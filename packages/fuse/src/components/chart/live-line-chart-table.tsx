"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { countOf } from "../../intl/count-of";
import { Table } from "../table/table";
import { ChartTableShell, PAGE_ROWS, Twin, useTableDisclosure } from "./chart-table-shell";
import type { ChartLayerProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { useLiveRoot, useShownFeed } from "./live-line-chart-context";
import { latestWindow, liveName, liveTimeText, liveValueText } from "./live-line-chart-text";

/**
 * Props for `LiveLineChart.Table`, a closed part.
 *
 * @beta
 */
export type LiveLineChartTableProps = ChartLayerProps & {
  /** Replaces the generated caption, the chart's name and its reading count. */
  caption?: string;
  /** Replaces the dictionary's "Vis som tabell". */
  showLabel?: string;
  /** Replaces the dictionary's "Skjul tabell". */
  hideLabel?: string;
};

/** One row's cells: the time and the value, each in both forms. */
type ReadingRow = { readonly time: FormattedText; readonly value: FormattedText };

/**
 * A "Vis som tabell" button and the window's readings as a table, which stays in the accessibility
 * tree while it is visually collapsed. It holds the readings of one window back from the latest,
 * newest first, as a live log reads, so its first row is always the latest reading. Its columns are
 * the time and the value, headed by the dictionary's "Tidspunkt" and Root's `label`. Past 500
 * readings it pages by row range.
 *
 * @beta
 */
export function LiveLineChartTable({
  caption,
  showLabel,
  hideLabel,
  className,
  style,
}: LiveLineChartTableProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Table");
  const { text, id, announce } = context;
  // The table lists what the plot shows, so a paused chart's table holds still with it.
  const { points, duration } = useShownFeed(context);
  const strings = CHART_STRINGS[text.locale];
  const disclosure = useTableDisclosure();
  const [page, setPage] = useState(0);
  const span = latestWindow(points, duration);
  const count = span.end - span.first;
  const pages = Math.max(1, Math.ceil(count / PAGE_ROWS));
  // A data update that drops pages clamps to the last one.
  const index = Math.min(page, pages - 1);
  const from = index * PAGE_ROWS;
  const to = Math.min(count, from + PAGE_ROWS);
  // The shown page formats once per page, reading or format change, so the clock formats nothing.
  const rows = useMemo(
    () =>
      // Newest first: the page's first row is the reading `from` places back from the latest.
      points
        .slice(Math.max(0, span.end - to), span.end - from)
        .reverse()
        .map((point): ReadingRow => ({
          time: liveTimeText(text, point.time, "full"),
          value: liveValueText(text, point.value, "full"),
        })),
    [points, span.end, text, from, to]
  );
  if (count === 0) return <></>;
  const range = (start: number, end: number) => strings.rowRange(String(start + 1), String(end));
  const go = (next: number): void => {
    if (next < 0 || next >= pages || next === index) return;
    setPage(next);
    const start = next * PAGE_ROWS;
    announce(
      strings.pageStatus(String(next + 1), String(pages), range(start, Math.min(count, start + PAGE_ROWS)))
    );
  };
  return (
    <ChartTableShell
      disclosure={disclosure}
      tableId={`${id}-rows`}
      showLabel={showLabel ?? strings.showTable}
      hideLabel={hideLabel ?? strings.hideTable}
      className={className}
      style={style}
      caption={
        caption ?? [context.name, countOf(text.locale, count, strings.points)].filter(Boolean).join(", ")
      }
      head={
        <>
          <Table.Head scope="col">{strings.xHeaderTime}</Table.Head>
          <Table.Head scope="col">{liveName(text)}</Table.Head>
        </>
      }
      pages={{
        index,
        count: pages,
        status: strings.pageStatus(String(index + 1), String(pages), range(from, to)),
        go,
      }}>
      {rows.map((row, offset) => (
        // Rows key by their place on the page, so a new reading updates them in place.
        <Table.Row key={offset}>
          <Table.Head scope="row">
            <Twin text={row.time} />
          </Table.Head>
          <Table.Cell>
            <Twin text={row.value} />
          </Table.Cell>
        </Table.Row>
      ))}
    </ChartTableShell>
  );
}

Object.assign(LiveLineChartTable, { displayName: "LiveLineChart.Table" });
