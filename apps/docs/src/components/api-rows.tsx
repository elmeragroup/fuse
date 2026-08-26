import type { ComponentProps, ReactElement, SVGProps } from "react";

import { tv } from "tailwind-variants";

const apiRows = tv({
  slots: {
    root: "border-docs-line grid grid-cols-[var(--api-cols)] rounded-[10px] border [--api-cols:minmax(0,1fr)] [contain-intrinsic-height:auto_calc((var(--api-rows,8)_+_1)*(2.5rem_+_1px)_-_1px)] [content-visibility:auto] min-[34rem]:[--api-cols:11rem_minmax(0,1fr)_2.5rem] min-[52rem]:[--api-cols:5fr_7fr_4fr_2.5rem]",
    header:
      "border-docs-line bg-docs-soft col-span-full flex min-h-[2.5rem] items-center rounded-t-[9px] border-b min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center",
    headerCell: "text-docs-sub font-medium px-[0.8rem] text-[0.75rem] tracking-[0.02em] whitespace-nowrap",
    row: "group border-docs-line col-span-full border-b last:border-b-0 min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center min-[34rem]:[&::details-content]:col-span-full min-[34rem]:[&::details-content]:grid min-[34rem]:[&::details-content]:grid-cols-subgrid min-[34rem]:[&::details-content]:items-center",
    summary:
      "hover:bg-docs-code focus-visible:outline-docs-ink flex min-h-[2.5rem] cursor-pointer scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] list-none items-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center [&::-webkit-details-marker]:hidden",
    cell: "[&_code]:font-docs-mono min-w-0 overflow-x-auto px-[0.8rem] py-2 whitespace-nowrap [&_code]:text-[11.5px]",
    panel:
      "border-docs-line bg-docs-code border-t border-dashed min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center",
    panelList:
      "m-0 flex flex-col gap-[0.55rem] px-[0.8rem] py-[0.75rem] text-[0.82rem] min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-center min-[34rem]:gap-0 min-[34rem]:px-0 min-[34rem]:py-2",
    panelItem:
      "min-[34rem]:col-span-full min-[34rem]:grid min-[34rem]:grid-cols-subgrid min-[34rem]:items-baseline min-[34rem]:py-1",
    term: "font-medium text-docs-sub text-[0.72rem] tracking-[0.02em] min-[34rem]:col-start-1 min-[34rem]:px-[0.8rem] min-[34rem]:text-right",
    definition:
      "text-docs-body [&_code]:border-docs-line [&_code]:bg-docs-soft [&_code]:font-docs-mono mt-[0.15rem] min-w-0 leading-[1.6] min-[34rem]:col-start-2 min-[34rem]:col-end-[-1] min-[34rem]:m-0 min-[34rem]:pr-[0.8rem] [&_code]:rounded-[4px] [&_code]:border [&_code]:px-[0.35em] [&_code]:py-[0.1em] [&_code]:text-[11.5px]",
    signature:
      "border-docs-line bg-docs-soft [&_code]:font-docs-mono m-0 overflow-x-auto rounded-[6px] border px-[0.6rem] py-2 [&_code]:border-0 [&_code]:p-0 [&_code]:text-[11.5px] [&_code]:leading-[1.6] [&_code]:wrap-anywhere [&_code]:whitespace-pre-wrap [&_code]:[background:none]",
    chevronCell:
      "text-docs-sub ml-auto flex items-center overflow-visible px-[0.8rem] py-2 min-[34rem]:ml-0 min-[34rem]:justify-center",
    chevron: "[transition:rotate_120ms_ease] group-open:rotate-180 motion-reduce:transition-none",
    required: "text-docs-required relative top-[-0.3em] text-[0.8em]",
    noDefault: "font-docs-mono text-docs-sub text-[11.5px]",
    propLink: "text-inherit",
  },
  variants: {
    headerColumn: {
      prop: {},
      type: { headerCell: "hidden min-[34rem]:block" },
      default: { headerCell: "hidden min-[52rem]:block" },
    },
    cellColumn: {
      name: { cell: "[&_code]:font-medium [&_code]:text-docs-ink block" },
      type: { cell: "[&_code]:text-docs-sub hidden min-[34rem]:block" },
      default: { cell: "[&_code]:text-docs-sub hidden min-[52rem]:block" },
    },
  },
  defaultVariants: {
    headerColumn: "prop",
    cellColumn: "name",
  },
});

export type ApiRowsRootProps = ComponentProps<"div">;
export type ApiRowsHeaderProps = ComponentProps<"div">;
export type ApiRowsHeaderCellProps = ComponentProps<"span"> & {
  column?: "prop" | "type" | "default";
};
export type ApiRowsRowProps = ComponentProps<"details">;
export type ApiRowsSummaryProps = ComponentProps<"summary">;
export type ApiRowsCellProps = ComponentProps<"span"> & {
  column?: "name" | "type" | "default";
};
export type ApiRowsPanelProps = ComponentProps<"div">;
export type ApiRowsPanelListProps = ComponentProps<"dl">;
export type ApiRowsPanelItemProps = ComponentProps<"div">;
export type ApiRowsTermProps = ComponentProps<"dt">;
export type ApiRowsDefinitionProps = ComponentProps<"dd">;
export type ApiRowsSignatureProps = ComponentProps<"pre">;
export type ApiRowsChevronCellProps = ComponentProps<"span">;
export type ApiRowsChevronProps = SVGProps<SVGSVGElement>;
export type ApiRowsRequiredProps = ComponentProps<"sup">;
export type ApiRowsNoDefaultProps = ComponentProps<"span">;
export type ApiRowsPropLinkProps = ComponentProps<"a">;

function ApiRowsRoot({ className, ...props }: ApiRowsRootProps): ReactElement {
  const { root } = apiRows();
  return <div className={root({ className })} {...props} />;
}

function ApiRowsHeader({ className, ...props }: ApiRowsHeaderProps): ReactElement {
  const { header } = apiRows();
  return <div className={header({ className })} {...props} />;
}

function ApiRowsHeaderCell({ className, column = "prop", ...props }: ApiRowsHeaderCellProps): ReactElement {
  const { headerCell } = apiRows({ headerColumn: column });
  return <span className={headerCell({ className })} {...props} />;
}

function ApiRowsRow({ className, ...props }: ApiRowsRowProps): ReactElement {
  const { row } = apiRows();
  return <details className={row({ className })} {...props} />;
}

function ApiRowsSummary({ className, ...props }: ApiRowsSummaryProps): ReactElement {
  const { summary } = apiRows();
  return <summary className={summary({ className })} {...props} />;
}

function ApiRowsCell({ className, column = "name", ...props }: ApiRowsCellProps): ReactElement {
  const { cell } = apiRows({ cellColumn: column });
  return <span className={cell({ className })} {...props} />;
}

function ApiRowsPanel({ className, ...props }: ApiRowsPanelProps): ReactElement {
  const { panel } = apiRows();
  return <div className={panel({ className })} {...props} />;
}

function ApiRowsPanelList({ className, ...props }: ApiRowsPanelListProps): ReactElement {
  const { panelList } = apiRows();
  return <dl className={panelList({ className })} {...props} />;
}

function ApiRowsPanelItem({ className, ...props }: ApiRowsPanelItemProps): ReactElement {
  const { panelItem } = apiRows();
  return <div className={panelItem({ className })} {...props} />;
}

function ApiRowsTerm({ className, ...props }: ApiRowsTermProps): ReactElement {
  const { term } = apiRows();
  return <dt className={term({ className })} {...props} />;
}

function ApiRowsDefinition({ className, ...props }: ApiRowsDefinitionProps): ReactElement {
  const { definition } = apiRows();
  return <dd className={definition({ className })} {...props} />;
}

function ApiRowsSignature({ className, ...props }: ApiRowsSignatureProps): ReactElement {
  const { signature } = apiRows();
  return <pre className={signature({ className })} {...props} />;
}

function ApiRowsChevronCell({ className, ...props }: ApiRowsChevronCellProps): ReactElement {
  const { chevronCell } = apiRows();
  return <span className={chevronCell({ className })} {...props} />;
}

function ApiRowsChevron({ className, ...props }: ApiRowsChevronProps): ReactElement {
  const { chevron } = apiRows();
  return (
    <svg className={chevron({ className })} width="10" height="10" viewBox="0 0 10 10" fill="none" {...props}>
      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function ApiRowsRequired({ className, ...props }: ApiRowsRequiredProps): ReactElement {
  const { required } = apiRows();
  return <sup className={required({ className })} {...props} />;
}

function ApiRowsNoDefault({ className, ...props }: ApiRowsNoDefaultProps): ReactElement {
  const { noDefault } = apiRows();
  return <span className={noDefault({ className })} {...props} />;
}

function ApiRowsPropLink({ className, ...props }: ApiRowsPropLinkProps): ReactElement {
  const { propLink } = apiRows();
  return <a className={propLink({ className })} {...props} />;
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
ApiRowsSignature.displayName = "ApiRows.Signature";
ApiRowsChevronCell.displayName = "ApiRows.ChevronCell";
ApiRowsChevron.displayName = "ApiRows.Chevron";
ApiRowsRequired.displayName = "ApiRows.Required";
ApiRowsNoDefault.displayName = "ApiRows.NoDefault";
ApiRowsPropLink.displayName = "ApiRows.PropLink";

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
  Signature: ApiRowsSignature,
  ChevronCell: ApiRowsChevronCell,
  Chevron: ApiRowsChevron,
  Required: ApiRowsRequired,
  NoDefault: ApiRowsNoDefault,
  PropLink: ApiRowsPropLink,
};
