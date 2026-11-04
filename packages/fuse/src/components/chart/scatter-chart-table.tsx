"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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
import type { ChartLayerProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { pointOf } from "./layout/scatter-model";
import { useScatterRoot } from "./scatter-chart-context";
import { axisNames, countPoints, scatterSeriesLabel, xValueText, yValueText } from "./scatter-chart-text";

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

/** Above this many rows the table pages, after CONTRACT section 9.6. */
const PAGE_ROWS = 500;

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
  const { model, locale, id, store } = context;
  const strings = CHART_STRINGS[locale];
  const tableStrings = useLocalizedStrings(dataTableStrings);
  const [shown, setShown] = useState(false);
  const [page, setPage] = useState(0);
  const table = useRef<HTMLTableElement>(null);
  const focusTable = useRef(false);
  useEffect(() => {
    if (!focusTable.current) return;
    focusTable.current = false;
    table.current?.focus();
  }, [shown]);
  if (model.empty) return <></>;
  const pages = Math.max(1, Math.ceil(model.count / PAGE_ROWS));
  // A data update that drops pages clamps to the last one.
  const index = Math.min(page, pages - 1);
  const from = index * PAGE_ROWS;
  const to = Math.min(model.count, from + PAGE_ROWS);
  const names = axisNames(context);
  const status = pageStatus(index, { kind: "known", pageCount: pages });
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
  const hiddenClass = shown ? undefined : cn("sr-only");
  const controlTab = shown ? undefined : -1;
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
      target: pages - 1,
      enabled: status.canNext,
    },
  ] as const;
  const rows = Array.from({ length: to - from }, (_, offset) => model.order[from + offset] ?? 0);
  const tableId = `${id}-rows`;
  return (
    <div data-slot="chart-table" className={className} style={style}>
      <Button
        data-slot="chart-table-toggle"
        variant="outline"
        size="xs"
        aria-controls={tableId}
        onClick={() => {
          focusTable.current = !shown;
          setShown(!shown);
        }}>
        {shown ? (hideLabel ?? strings.hideTable) : (showLabel ?? strings.showTable)}
      </Button>
      {/* Shown, the table takes a Tab stop, so a keyboard can scroll a table wider than its box. */}
      <Table.Root
        id={tableId}
        ref={table}
        tabIndex={shown ? 0 : -1}
        data-slot="chart-table-content"
        className={hiddenClass}>
        <Table.Caption>
          {caption ?? [context.name, countPoints(locale, model.count)].filter(Boolean).join(", ")}
        </Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head scope="col">{strings.seriesHeader}</Table.Head>
            <Table.Head scope="col">{names.x}</Table.Head>
            <Table.Head scope="col">{names.y}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((point) => {
            const { key, x, y } = pointOf(model, point);
            return (
              <Table.Row key={point}>
                <Table.Head scope="row">
                  <Twin text={scatterSeriesLabel(context, key)} />
                </Table.Head>
                <Table.Cell>
                  <Twin text={xValueText(context, x, "full")} />
                </Table.Cell>
                <Table.Cell>
                  <Twin text={yValueText(context, key, y, "full")} />
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
      {pages > 1 ? (
        <div data-slot="chart-table-pagination" className={hiddenClass}>
          {moves.map(({ key, label, Icon, target, enabled }) => (
            <Fragment key={key}>
              {key === "next" ? (
                <span>{strings.pageStatus(String(index + 1), String(pages), range(from, to))}</span>
              ) : null}
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

Object.assign(ScatterChartTable, { displayName: "ScatterChart.Table" });
