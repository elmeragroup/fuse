"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { Table } from "../table/table";
import { ChartTableShell, PAGE_ROWS, Twin, useTableDisclosure } from "./chart-table-shell";
import type { ChartLayerProps } from "./chart-types";
import { CHART_STRINGS, countOf } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { pointOf } from "./layout/scatter-model";
import { useScatterRoot } from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";
import { axisNames, scatterSeriesLabel, xValueText, yValueText } from "./scatter-chart-text";

/**
 * Props for `ScatterChart.Table`, a closed part.
 *
 * @beta
 */
export type ScatterChartTableProps = ChartLayerProps & {
  /** Replaces the generated caption, the chart's name and its point count. */
  caption?: string;
  /** Replaces the dictionary's "Vis som tabell". */
  showLabel?: string;
  /** Replaces the dictionary's "Skjul tabell". */
  hideLabel?: string;
};

/** One row's cells: the series, x and y, each in both forms. */
type PointRow = { readonly series: FormattedText; readonly x: FormattedText; readonly y: FormattedText };

/** The rows of one page, from walk place `from` up to `to`, in their formats. */
function pageRows(
  context: Pick<ScatterRootContextValue, "model" | "config" | "locale" | "xFormat" | "valueFormat">,
  from: number,
  to: number
): PointRow[] {
  const { model } = context;
  return Array.from({ length: to - from }, (_, offset) => {
    const { key, x, y } = pointOf(model, model.order[from + offset] ?? 0);
    return {
      series: scatterSeriesLabel(context, key),
      x: xValueText(context, x, "full"),
      y: yValueText(context, key, y, "full"),
    };
  });
}

/**
 * A "Vis som tabell" button and every point as a table, which stays in the accessibility tree while
 * it is visually collapsed. One row per point, in the walk order: by x, then y, then series. Its
 * columns are the series, x and y, headed by Root's `xLabel` and `yLabel`. Past 500 points it pages
 * by row range.
 *
 * @beta
 */
export function ScatterChartTable({
  caption,
  showLabel,
  hideLabel,
  className,
  style,
}: ScatterChartTableProps): ReactElement {
  const context = useScatterRoot("ScatterChart.Table");
  const { model, config, locale, xFormat, valueFormat, id, store } = context;
  const strings = CHART_STRINGS[locale];
  const disclosure = useTableDisclosure();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(model.count / PAGE_ROWS));
  // A data update that drops pages clamps to the last one.
  const index = Math.min(page, pages - 1);
  const from = index * PAGE_ROWS;
  const to = Math.min(model.count, from + PAGE_ROWS);
  // The shown page's rows format once per page, data, format or locale change, so a render for
  // anything else, such as a live update's tick while the table is collapsed, formats none.
  const rows = useMemo(
    () => pageRows({ model, config, locale, xFormat, valueFormat }, from, to),
    [model, config, locale, xFormat, valueFormat, from, to]
  );
  if (model.empty) return <></>;
  const names = axisNames(context);
  const range = (start: number, end: number) => strings.rowRange(String(start + 1), String(end));
  const go = (next: number): void => {
    if (next < 0 || next >= pages || next === index) return;
    setPage(next);
    const start = next * PAGE_ROWS;
    store.announce(
      strings.pageStatus(
        String(next + 1),
        String(pages),
        range(start, Math.min(model.count, start + PAGE_ROWS))
      )
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
        caption ?? [context.name, countOf(locale, model.count, strings.points)].filter(Boolean).join(", ")
      }
      head={
        <>
          <Table.Head scope="col">{strings.seriesHeader}</Table.Head>
          <Table.Head scope="col">{names.x}</Table.Head>
          <Table.Head scope="col">{names.y}</Table.Head>
        </>
      }
      pages={{
        index,
        count: pages,
        status: strings.pageStatus(String(index + 1), String(pages), range(from, to)),
        go,
      }}>
      {rows.map((row, offset) => (
        // Rows key by their place on the page, so a page or data change updates them in place.
        <Table.Row key={offset}>
          <Table.Head scope="row">
            <Twin text={row.series} />
          </Table.Head>
          <Table.Cell>
            <Twin text={row.x} />
          </Table.Cell>
          <Table.Cell>
            <Twin text={row.y} />
          </Table.Cell>
        </Table.Row>
      ))}
    </ChartTableShell>
  );
}

Object.assign(ScatterChartTable, { displayName: "ScatterChart.Table" });
