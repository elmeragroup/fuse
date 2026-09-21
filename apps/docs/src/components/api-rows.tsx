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
    cell: "min-w-0 overflow-x-auto px-3 py-2 whitespace-nowrap",
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
  },
  variants: {
    headerColumn: {
      prop: {},
      type: { headerCell: "hidden min-[34rem]:block" },
      default: { headerCell: "hidden min-[52rem]:block" },
    },
    cellColumn: {
      name: { cell: "block", code: "font-medium text-foreground" },
      type: { cell: "hidden min-[34rem]:block", code: "text-muted-foreground" },
      default: { cell: "hidden min-[52rem]:block", code: "text-muted-foreground" },
    },
  },
  defaultVariants: {
    headerColumn: "prop",
    cellColumn: "name",
  },
});

const apiRowSlots = apiRows();

/** The data column a summary `Cell` renders; header cells carry a different axis. */
type ApiRowsColumn = "name" | "type" | "default";

export type ApiRowsRootProps = ComponentProps<"div">;
export type ApiRowsHeaderProps = ComponentProps<"div">;
export type ApiRowsHeaderCellProps = ComponentProps<"span"> & {
  column?: "prop" | "type" | "default";
};
export type ApiRowsRowProps = ComponentProps<"details">;
export type ApiRowsSummaryProps = ComponentProps<"summary">;
export type ApiRowsCellProps = ComponentProps<"span"> & {
  column?: ApiRowsColumn;
  /** The cell's code literal, or `null` when the cell renders no code element. */
  code: string | null;
};
export type ApiRowsPanelProps = ComponentProps<"div">;
export type ApiRowsPanelListProps = ComponentProps<"dl">;
export type ApiRowsPanelItemProps = ComponentProps<"div">;
export type ApiRowsTermProps = ComponentProps<"dt">;
export type ApiRowsDefinitionProps = ComponentProps<"dd">;
export type ApiRowsChevronCellProps = ComponentProps<"span">;
export type ApiRowsChevronProps = SVGProps<SVGSVGElement>;
export type ApiRowsRequiredProps = ComponentProps<"sup">;
export type ApiRowsNoDefaultProps = Omit<ComponentProps<"span">, "children">;

function ApiRowsRoot({ className, ...props }: ApiRowsRootProps): ReactElement {
  return <div className={apiRowSlots.root({ className })} {...props} />;
}

function ApiRowsHeader({ className, ...props }: ApiRowsHeaderProps): ReactElement {
  return <div className={apiRowSlots.header({ className })} data-api-rows-header {...props} />;
}

function ApiRowsHeaderCell({ className, column = "prop", ...props }: ApiRowsHeaderCellProps): ReactElement {
  const { headerCell } = apiRows({ headerColumn: column });
  return <span className={headerCell({ className })} {...props} />;
}

function ApiRowsRow({ className, ...props }: ApiRowsRowProps): ReactElement {
  return <details className={apiRowSlots.row({ className })} {...props} />;
}

function ApiRowsSummary({ className, ...props }: ApiRowsSummaryProps): ReactElement {
  return <summary className={apiRowSlots.summary({ className })} {...props} />;
}

function ApiRowsCell({
  className,
  column = "name",
  code,
  children,
  ...props
}: ApiRowsCellProps): ReactElement {
  const { cell, code: codeClass } = apiRows({ cellColumn: column });
  return (
    <span className={cell({ className })} {...props}>
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

function ApiRowsRequired({ className, ...props }: ApiRowsRequiredProps): ReactElement {
  return <sup className={apiRowSlots.required({ className })} {...props} />;
}

/** The glyph a row shows in place of a default; it is the same mark wherever a default is absent. */
function ApiRowsNoDefault({ className, ...props }: ApiRowsNoDefaultProps): ReactElement {
  return (
    <span className={apiRowSlots.noDefault({ className })} {...props}>
      {NO_DEFAULT}
    </span>
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
