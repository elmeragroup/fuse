import type { ComponentProps, ReactElement, SVGProps } from "react";

import { tv } from "tailwind-variants";

import { NO_DEFAULT } from "../lib/api-row";

const apiRows = tv({
  slots: {
    root: "grid grid-cols-[var(--api-cols)] overflow-clip rounded-xl border border-border [--api-cols:minmax(0,1fr)] [contain-intrinsic-height:auto_calc((var(--api-rows,8)_+_1)*(2.5rem_+_1px)_-_1px)] [content-visibility:auto] min-[34rem]:[--api-cols:11rem_minmax(0,1fr)_2.5rem] min-[52rem]:[--api-cols:5fr_7fr_4fr_2.5rem]",
    header:
      "col-span-full flex min-h-[2.5rem] items-center border-b border-border bg-card min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center",
    headerCell: "font-medium text-xs tracking-wide px-3 whitespace-nowrap text-muted-foreground",
    row: "group col-span-full border-b border-border last:border-b-0 min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center min-[34rem]:[&::details-content]:col-span-full min-[34rem]:[&::details-content]:grid min-[34rem]:[&::details-content]:grid-cols-subgrid min-[34rem]:[&::details-content]:items-center",
    summary:
      "flex min-h-[2.5rem] cursor-pointer scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] list-none items-center hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center [&::-webkit-details-marker]:hidden",
    // A long value ends in an ellipsis rather than scrolling. A scrolling cell would need a tab stop
    // of its own, nested in the summary's, and the open row's panel prints the full value.
    cell: "block min-w-0 truncate px-3 py-2",
    code: "text-xs",
    panel:
      "border-t border-dashed border-border bg-card min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center",
    panelList:
      "text-sm m-0 flex flex-col gap-2 px-3 py-3 min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center min-[34rem]:gap-0 min-[34rem]:px-0 min-[34rem]:py-2",
    panelItem:
      "min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-baseline min-[34rem]:py-1",
    term: "font-medium text-xs tracking-wide text-muted-foreground min-[34rem]:col-start-1 min-[34rem]:px-3 min-[34rem]:text-right",
    definition:
      "leading-relaxed mt-[0.15rem] min-w-0 text-foreground min-[34rem]:col-start-2 min-[34rem]:col-end-[-1] min-[34rem]:m-0 min-[34rem]:pr-3",
    chevronCell:
      "ml-auto flex items-center overflow-visible px-3 py-2 text-muted-foreground min-[34rem]:ml-0 min-[34rem]:justify-center",
    chevron: "transition-transform duration-120 group-open:rotate-180 motion-reduce:transition-none",
    required: "text-xs relative top-[-0.3em] text-error",
    noDefault: "text-xs font-mono text-muted-foreground",
    // Words only a screen reader hears, in place of the header and the marks a sighted reader
    // sees. `select-none` keeps them out of text a reader copies from a row.
    spoken: "sr-only select-none",
  },
  variants: {
    // A narrow viewport drops columns from view. The header hides its cell, which nothing
    // reads; a row keeps its cell for screen readers, since the summary takes its name from
    // the cells and two rows that differ only in a hidden column would sound the same.
    column: {
      name: { code: "font-medium text-foreground" },
      type: {
        headerCell: "hidden min-[34rem]:block",
        cell: "max-[34rem]:sr-only",
        code: "text-muted-foreground",
      },
      default: {
        headerCell: "hidden min-[52rem]:block",
        cell: "max-[52rem]:sr-only",
        code: "text-muted-foreground",
      },
    },
  },
});

const apiRowSlots = apiRows();

/** A data column: the header names it, and a summary `Cell` renders its value. */
type ApiRowsColumn = "name" | "type" | "default";

/**
 * Each column's heading. A screen reader hears the type and default headings before their
 * values, so a closed row reads as "size, type Union, default ...".
 */
const COLUMN_HEADINGS = {
  name: "Prop",
  type: "Type",
  default: "Default",
} as const satisfies Record<ApiRowsColumn, string>;

type ApiRowsRootProps = ComponentProps<"div">;
type ApiRowsHeaderProps = ComponentProps<"div">;
type ApiRowsHeaderCellProps = Omit<ComponentProps<"span">, "children"> & {
  column: ApiRowsColumn;
};
type ApiRowsRowProps = ComponentProps<"details">;
type ApiRowsSummaryProps = ComponentProps<"summary">;
type ApiRowsCellProps = ComponentProps<"span"> & {
  column: ApiRowsColumn;
  /** The cell's code literal, or `null` when the cell renders no code element. */
  code: string | null;
};
type ApiRowsPanelProps = ComponentProps<"div">;
type ApiRowsPanelListProps = ComponentProps<"dl">;
type ApiRowsPanelItemProps = ComponentProps<"div">;
type ApiRowsTermProps = ComponentProps<"dt">;
type ApiRowsDefinitionProps = ComponentProps<"dd">;
type ApiRowsChevronCellProps = ComponentProps<"span">;
type ApiRowsChevronProps = SVGProps<SVGSVGElement>;
type ApiRowsRequiredProps = Omit<ComponentProps<"sup">, "children">;
type ApiRowsNoDefaultProps = Omit<ComponentProps<"span">, "children">;

function ApiRowsRoot({ className, ...props }: ApiRowsRootProps): ReactElement {
  return <div className={apiRowSlots.root({ className })} {...props} />;
}

function ApiRowsHeader({ className, ...props }: ApiRowsHeaderProps): ReactElement {
  return <div className={apiRowSlots.header({ className })} data-api-rows-header {...props} />;
}

function ApiRowsHeaderCell({ className, column, ...props }: ApiRowsHeaderCellProps): ReactElement {
  const { headerCell } = apiRows({ column });
  return (
    <span className={headerCell({ className })} {...props}>
      {COLUMN_HEADINGS[column]}
    </span>
  );
}

function ApiRowsRow({ className, ...props }: ApiRowsRowProps): ReactElement {
  return <details className={apiRowSlots.row({ className })} {...props} />;
}

function ApiRowsSummary({ className, ...props }: ApiRowsSummaryProps): ReactElement {
  return <summary className={apiRowSlots.summary({ className })} {...props} />;
}

function ApiRowsCell({ className, column, code, children, ...props }: ApiRowsCellProps): ReactElement {
  const { cell, code: codeClass } = apiRows({ column });
  return (
    <span className={cell({ className })} {...props}>
      {column === "name" ? null : (
        <span className={apiRowSlots.spoken()}>{`, ${COLUMN_HEADINGS[column].toLowerCase()} `}</span>
      )}
      {code === null ? null : <code className={codeClass()}>{code}</code>}
      {children}
    </span>
  );
}

function ApiRowsPanel({ className, ...props }: ApiRowsPanelProps): ReactElement {
  return <div className={apiRowSlots.panel({ className })} {...props} />;
}

function ApiRowsPanelList({ className, ...props }: ApiRowsPanelListProps): ReactElement {
  return <dl className={apiRowSlots.panelList({ className })} {...props} />;
}

function ApiRowsPanelItem({ className, ...props }: ApiRowsPanelItemProps): ReactElement {
  return <div className={apiRowSlots.panelItem({ className })} {...props} />;
}

function ApiRowsTerm({ className, ...props }: ApiRowsTermProps): ReactElement {
  return <dt className={apiRowSlots.term({ className })} {...props} />;
}

function ApiRowsDefinition({ className, ...props }: ApiRowsDefinitionProps): ReactElement {
  return <dd className={apiRowSlots.definition({ className })} {...props} />;
}

function ApiRowsChevronCell({ className, ...props }: ApiRowsChevronCellProps): ReactElement {
  return <span className={apiRowSlots.chevronCell({ className })} {...props} />;
}

function ApiRowsChevron({ className, ...props }: ApiRowsChevronProps): ReactElement {
  return (
    <svg
      className={apiRowSlots.chevron({ className })}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/**
 * The mark after a required prop's name. A sighted reader sees an asterisk with a "Required"
 * tooltip, and a screen reader hears "required".
 */
function ApiRowsRequired({ className, ...props }: ApiRowsRequiredProps): ReactElement {
  return (
    <>
      <sup className={apiRowSlots.required({ className })} title="Required" aria-hidden {...props}>
        *
      </sup>
      <span className={apiRowSlots.spoken()}>, required</span>
    </>
  );
}

/**
 * What a row shows in place of a default, in the closed row and the open panel alike. A sighted
 * reader sees a dash, and a screen reader hears "none".
 */
function ApiRowsNoDefault({ className, ...props }: ApiRowsNoDefaultProps): ReactElement {
  return (
    <>
      <span className={apiRowSlots.noDefault({ className })} aria-hidden {...props}>
        {NO_DEFAULT}
      </span>
      <span className={apiRowSlots.spoken()}>none</span>
    </>
  );
}

ApiRowsRoot.displayName = "ApiRows.Root";
ApiRowsHeader.displayName = "ApiRows.Header";
ApiRowsHeaderCell.displayName = "ApiRows.HeaderCell";
ApiRowsRow.displayName = "ApiRows.Row";
ApiRowsSummary.displayName = "ApiRows.Summary";
ApiRowsCell.displayName = "ApiRows.Cell";
ApiRowsPanel.displayName = "ApiRows.Panel";
ApiRowsPanelList.displayName = "ApiRows.PanelList";
ApiRowsPanelItem.displayName = "ApiRows.PanelItem";
ApiRowsTerm.displayName = "ApiRows.Term";
ApiRowsDefinition.displayName = "ApiRows.Definition";
ApiRowsChevronCell.displayName = "ApiRows.ChevronCell";
ApiRowsChevron.displayName = "ApiRows.Chevron";
ApiRowsRequired.displayName = "ApiRows.Required";
ApiRowsNoDefault.displayName = "ApiRows.NoDefault";

export const ApiRows = {
  Root: ApiRowsRoot,
  Header: ApiRowsHeader,
  HeaderCell: ApiRowsHeaderCell,
  Row: ApiRowsRow,
  Summary: ApiRowsSummary,
  Cell: ApiRowsCell,
  Panel: ApiRowsPanel,
  PanelList: ApiRowsPanelList,
  PanelItem: ApiRowsPanelItem,
  Term: ApiRowsTerm,
  Definition: ApiRowsDefinition,
  ChevronCell: ApiRowsChevronCell,
  Chevron: ApiRowsChevron,
  Required: ApiRowsRequired,
  NoDefault: ApiRowsNoDefault,
};
