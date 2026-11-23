"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";

import { countOf } from "../../intl/count-of";
import { Table } from "../table/table";
import { ChartTableShell, Twin, useRowPages, useTableDisclosure } from "./chart-table-shell";
import type { ChartLayerProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { POINT_WORDS } from "./format/point-words";
import { SCATTER_STRINGS } from "./format/scatter-strings";
import { seriesLabel } from "./format/series-label";
import { pointOf } from "./layout/scatter-model";
import { useScatterRoot } from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";
import { axisNames, xValueText, yValueText } from "./scatter-chart-text";

/**
 * Props for `ScatterChart.Table`, a closed part.
 *
 * @beta
 */
export type ScatterChartTableProps = ChartLayerProps & {
  /** Replaces the generated caption, the chart's name and its point count. */
  caption?: string;
  /**
   * Replaces the dictionary's "Vis som tabell". The button shows the table and moves focus to it.
   * While collapsed the table stays out of the Tab order and stays in the accessibility tree. Past
   * 500 points it pages by row range.
   */
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
      series: seriesLabel(context, key),
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
  const pages = useRowPages(model.count, strings, store.announce);
  const { from, to } = pages;
  // The shown page's rows format once per page, data, format or locale change, so a render for
  // anything else, such as a live update's tick while the table is collapsed, formats none.
  const rows = useMemo(
    () => pageRows({ model, config, locale, xFormat, valueFormat }, from, to),
    [model, config, locale, xFormat, valueFormat, from, to]
  );
  if (model.empty) return <></>;
  const names = axisNames(context);
  return (
    <ChartTableShell
      disclosure={disclosure}
      tableId={`${id}-rows`}
      showLabel={showLabel ?? strings.showTable}
      hideLabel={hideLabel ?? strings.hideTable}
      className={className}
      style={style}
      caption={
        caption ??
        [context.name, countOf(locale, model.count, POINT_WORDS[locale])].filter(Boolean).join(", ")
      }
      head={
        <>
          <Table.Head scope="col">{SCATTER_STRINGS[locale].seriesHeader}</Table.Head>
          <Table.Head scope="col">{names.x}</Table.Head>
          <Table.Head scope="col">{names.y}</Table.Head>
        </>
      }
      pages={pages}>
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
