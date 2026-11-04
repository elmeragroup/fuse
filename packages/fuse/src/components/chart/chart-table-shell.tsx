"use client";

/**
 * The table disclosure every chart family shares: the "Vis som tabell" toggle, the table that stays
 * in the accessibility tree while it is visually collapsed, and the pagination past 500 rows. A
 * family's table passes its caption, header cells, rows and pages. The module reads no Root
 * context, so a scatter route ships no cartesian module through it.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode, RefObject } from "react";

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
import type { FormattedText } from "./format/formatted-text";

/** Above this many rows a chart's table pages, after CONTRACT section 9.6. */
export const PAGE_ROWS = 500;

/**
 * The words a twin cell shows and speaks.
 *
 * @param props - The cell's text in both forms.
 */
export function Twin({ text }: { readonly text: FormattedText }): ReactNode {
  if (text.text === text.spoken) return text.text;
  return (
    <>
      <span aria-hidden="true">{text.text}</span>
      <span className="sr-only">{text.spoken}</span>
    </>
  );
}

/** A paged table's place: the shown page, the page count, the status it prints, and the move. */
export type TablePages = {
  readonly index: number;
  readonly count: number;
  /** The status between the back and forward buttons, such as `Side 1 av 2 · Rad 1 til 500`. */
  readonly status: string;
  /** Show a page by its index. A page outside the pages or the shown one does nothing. */
  readonly go: (index: number) => void;
};

/** Whether a table shows, and the toggle that shows or hides it and focuses it when shown. */
export type TableDisclosure = {
  readonly shown: boolean;
  readonly toggle: () => void;
  readonly table: RefObject<HTMLTableElement | null>;
};

/**
 * A table's disclosure, which a family's table holds above its empty state, so a chart whose data
 * empties and fills again keeps its table shown or hidden.
 *
 * @returns The disclosure, collapsed at first.
 */
export function useTableDisclosure(): TableDisclosure {
  const [shown, setShown] = useState(false);
  const table = useRef<HTMLTableElement>(null);
  const focusTable = useRef(false);
  useEffect(() => {
    if (!focusTable.current) return;
    focusTable.current = false;
    table.current?.focus();
  }, [shown]);
  return {
    shown,
    toggle: () => {
      focusTable.current = !shown;
      setShown(!shown);
    },
    table,
  };
}

/** What a family's table passes the shell. */
export type ChartTableShellProps = {
  /** The family's disclosure, from `useTableDisclosure`. */
  readonly disclosure: TableDisclosure;
  /** The table's id, which the toggle controls. */
  readonly tableId: string;
  /** The toggle's text while the table is collapsed. */
  readonly showLabel: string;
  /** The toggle's text while the table shows. */
  readonly hideLabel: string;
  readonly className: string | undefined;
  readonly style: CSSProperties | undefined;
  readonly caption: ReactNode;
  /** The header row's cells. */
  readonly head: ReactNode;
  /** The body rows. */
  readonly children: ReactNode;
  /** The pages, which the pagination shows when there are more than one. */
  readonly pages: TablePages;
};

/**
 * The pagination: first, back, the status, forward and last, after the data table's moves. While
 * the table is collapsed it is visually hidden and its buttons take no Tab stop.
 */
function TablePagination({
  pages,
  shown,
}: {
  readonly pages: TablePages;
  readonly shown: boolean;
}): ReactElement {
  const tableStrings = useLocalizedStrings(dataTableStrings);
  const { index, count, status, go } = pages;
  const state = pageStatus(index, { kind: "known", pageCount: count });
  // Each move's target page.
  const moves = [
    { key: "first", label: "goToFirstPage", Icon: CaretDoubleLeft, target: 0, enabled: state.canPrevious },
    {
      key: "previous",
      label: "goToPreviousPage",
      Icon: CaretLeft,
      target: index - 1,
      enabled: state.canPrevious,
    },
    { key: "next", label: "goToNextPage", Icon: CaretRight, target: index + 1, enabled: state.canNext },
    { key: "last", label: "goToLastPage", Icon: CaretDoubleRight, target: count - 1, enabled: state.canNext },
  ] as const;
  return (
    <div data-slot="chart-table-pagination" className={shown ? undefined : cn("sr-only")}>
      {moves.map(({ key, label, Icon, target, enabled }) => (
        <Fragment key={key}>
          {key === "next" ? <span>{status}</span> : null}
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={tableStrings.format(label)}
            tabIndex={shown ? undefined : -1}
            disabled={!enabled}
            onClick={() => {
              go(target);
            }}>
            <Icon aria-hidden="true" />
          </Button>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * A "Vis som tabell" button and a table, which stays in the accessibility tree while it is
 * visually collapsed. Showing it moves focus to the table, which then takes a Tab stop, so a
 * keyboard can scroll a table wider than its box. Past one page it adds the pagination.
 *
 * @param props - The family's caption, header cells, rows and pages.
 */
export function ChartTableShell({
  disclosure,
  tableId,
  showLabel,
  hideLabel,
  className,
  style,
  caption,
  head,
  children,
  pages,
}: ChartTableShellProps): ReactElement {
  const { shown, toggle, table } = disclosure;
  return (
    <div data-slot="chart-table" className={className} style={style}>
      <Button
        data-slot="chart-table-toggle"
        variant="outline"
        size="xs"
        aria-controls={tableId}
        onClick={toggle}>
        {shown ? hideLabel : showLabel}
      </Button>
      <Table.Root
        id={tableId}
        ref={table}
        tabIndex={shown ? 0 : -1}
        data-slot="chart-table-content"
        className={shown ? undefined : cn("sr-only")}>
        <Table.Caption>{caption}</Table.Caption>
        <Table.Header>
          <Table.Row>{head}</Table.Row>
        </Table.Header>
        <Table.Body>{children}</Table.Body>
      </Table.Root>
      {pages.count > 1 ? <TablePagination pages={pages} shown={shown} /> : null}
    </div>
  );
}

Object.assign(ChartTableShell, { displayName: "Chart.TableShell" });
Object.assign(Twin, { displayName: "Chart.TableTwin" });
