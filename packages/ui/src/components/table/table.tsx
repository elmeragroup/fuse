import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import { Skeleton } from "../skeleton/skeleton";
import { TableCell } from "./table-cell";
import { verticalTableCellText } from "./vertical-table-cell-text";
import { VerticalTableHeader } from "./vertical-table-header";
import { VerticalTableKey } from "./vertical-table-key";

export type TableRootProps = ComponentProps<"table">;
export type TableHeaderProps = ComponentProps<"thead">;
export type TableBodyProps = ComponentProps<"tbody">;
export type TableFooterProps = ComponentProps<"tfoot">;
export type TableRowProps = ComponentProps<"tr">;
export type TableHeadProps = ComponentProps<"th">;
export type TableCellProps = ComponentProps<"td">;
export type TableCaptionProps = ComponentProps<"caption">;

export type VerticalTableItem = {
  label: ReactNode;
  value: ReactNode;
  fontWeight?: "normal" | "bold";
  isLoading?: boolean;
  text?: "default" | "truncate";
};

export type VerticalTableRootProps = ComponentProps<"div"> & {
  /**
   * Facts-sheet look. `"non-bordered-compact"` drops the wrapper border/background
   * and tightens cell padding via descendant `data-variant` selectors (table.md §4).
   */
  variant?: "default" | "non-bordered-compact";
};

export type { VerticalTableHeaderProps } from "./vertical-table-header";

export type VerticalTableBodyProps = ComponentProps<"div"> & {
  /**
   * Key/value rows rendered before `children`. Each item becomes a
   * `VerticalTable.Row` with `Key` then `Value`.
   */
  data?: VerticalTableItem[];
  /**
   * Inner `<table>` (`Table.Root`) props. Association attributes such as
   * `aria-labelledby` belong here — Body's own props, including `aria-*`, stay
   * on the wrapper only (table.md §8.3). `className` merges with `table-fixed`.
   */
  tableProps?: TableRootProps;
};

export type VerticalTableRowProps = ComponentProps<"tr"> & {
  /**
   * Weight token consumed by `Key`/`Value` via the row group scope.
   */
  fontWeight?: "normal" | "bold";
  /**
   * Hides the row with the `hidden` class when true.
   */
  isHidden?: boolean;
};

export type { VerticalTableKeyProps } from "./vertical-table-key";

export type VerticalTableValueProps = ComponentProps<"td"> & {
  /**
   * `"truncate"` clips overflowing text; `"default"` wraps (`whitespace-normal`).
   */
  text?: "default" | "truncate";
  /**
   * Replaces children with a `Skeleton` (`h-4 w-full max-w-24`).
   */
  isLoading?: boolean;
};

/**
 * Semantic `<table>` composite (table.md §2/§7). Server compound — it owns no state,
 * no handlers, and no browser APIs (performance.md §RSC classification). `Header` and
 * `Key` on `VerticalTable` are client `useRender` islands so other outline levels and
 * row-header hosts stay possible without flipping this module to a client boundary.
 */
function TableRoot({ className, ...props }: TableRootProps): ReactElement {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn(
          "text-sm w-full caption-bottom in-data-[slot=frame]:border-separate in-data-[slot=frame]:border-spacing-0",
          className
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: TableHeaderProps): ReactElement {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b in-data-[slot=frame]:**:[th]:h-9 in-data-[slot=frame]:*:[tr]:border-none in-data-[slot=frame]:*:[tr]:hover:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: TableBodyProps): ReactElement {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "before:shadow-[0_1px_--theme(--color-black/6%)] in-data-[slot=frame]:shadow-xs/5 relative before:pointer-events-none before:absolute before:inset-px before:rounded-[calc(var(--radius-xl)-1px)] not-in-data-[slot=frame]:before:hidden in-data-[slot=frame]:rounded-xl [&_tr:last-child]:border-0 in-data-[slot=frame]:*:[tr]:border-0 in-data-[slot=frame]:*:[tr]:*:[td]:border-b in-data-[slot=frame]:*:[tr]:*:[td]:bg-background in-data-[slot=frame]:*:[tr]:*:[td]:bg-clip-padding in-data-[slot=frame]:*:[tr]:first:*:[td]:first:rounded-ss-xl in-data-[slot=frame]:*:[tr]:*:[td]:first:border-s in-data-[slot=frame]:*:[tr]:first:*:[td]:border-t in-data-[slot=frame]:*:[tr]:last:*:[td]:last:rounded-ee-xl in-data-[slot=frame]:*:[tr]:*:[td]:last:border-e in-data-[slot=frame]:*:[tr]:first:*:[td]:last:rounded-se-xl in-data-[slot=frame]:*:[tr]:last:*:[td]:first:rounded-es-xl in-data-[slot=frame]:*:[tr]:hover:*:[td]:bg-transparent in-data-[slot=frame]:*:[tr]:data-[state=selected]:*:[td]:bg-muted/72",
        className
      )}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: TableFooterProps): ReactElement {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "font-medium border-t bg-muted/72 in-data-[slot=frame]:border-none in-data-[slot=frame]:bg-transparent in-data-[slot=frame]:*:[tr]:hover:bg-transparent [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: TableRowProps): ReactElement {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/72 in-data-[slot=frame]:hover:bg-transparent data-[state=selected]:bg-muted/72 in-data-[slot=frame]:data-[state=selected]:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: TableHeadProps): ReactElement {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "font-medium h-10 px-2 text-left align-middle leading-none whitespace-nowrap text-muted-foreground has-[[role=checkbox]]:w-px has-[[role=checkbox]]:pe-0",
        className
      )}
      scope="col"
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: TableCaptionProps): ReactElement {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-sm mt-4 text-muted-foreground in-data-[slot=frame]:my-4", className)}
      {...props}
    />
  );
}

function VerticalTableRoot({
  children,
  className,
  variant = "default",
  ...props
}: VerticalTableRootProps): ReactElement {
  return (
    <div
      data-slot="vertical-table-root"
      data-variant={variant}
      className={cn("space-y-3", className)}
      {...props}>
      {children}
    </div>
  );
}

function VerticalTableBody({
  children,
  className,
  data,
  tableProps,
  ...props
}: VerticalTableBodyProps): ReactElement {
  const { className: tableClassName, ...innerTableProps } = tableProps ?? {};
  return (
    <div
      data-slot="vertical-table"
      className={cn(
        "overflow-hidden rounded-md border bg-background in-data-[variant=non-bordered-compact]:border-none in-data-[variant=non-bordered-compact]:bg-inherit",
        className
      )}
      {...props}>
      <Table.Root className={cn("table-fixed", tableClassName)} {...innerTableProps}>
        <tbody data-slot="vertical-table-body">
          {data && data.length > 0
            ? data.map(
                ({ label, value, fontWeight = "normal", isLoading = false, text = "truncate" }, index) => (
                  <VerticalTableRow key={`vertical-table-row-label-${index}`} fontWeight={fontWeight}>
                    <VerticalTableKey text={text}>{label}</VerticalTableKey>
                    <VerticalTableValue text={text} isLoading={isLoading}>
                      {value}
                    </VerticalTableValue>
                  </VerticalTableRow>
                )
              )
            : null}
          {children}
        </tbody>
      </Table.Root>
    </div>
  );
}

function VerticalTableRow({
  children,
  className,
  fontWeight = "normal",
  isHidden = false,
  ...props
}: VerticalTableRowProps): ReactElement {
  return (
    <TableRow
      data-font-weight={fontWeight}
      className={cn(
        "group/vertical-table-row-item *:border-border hover:bg-transparent [&>:not(:last-child)]:border-r",
        "in-data-[variant=non-bordered-compact]:border-none",
        { hidden: isHidden },
        className
      )}
      {...props}>
      {children}
    </TableRow>
  );
}

function VerticalTableValue({
  children,
  className,
  text = "truncate",
  isLoading = false,
  ...props
}: VerticalTableValueProps): ReactElement {
  return (
    <TableCell
      className={cn(
        "text-sm *:text-sm **:text-sm group-data-[font-weight=bold]/vertical-table-row-item:font-medium group-data-[font-weight=normal]/vertical-table-row-item:font-normal py-2",
        "in-data-[variant=non-bordered-compact]:border-none in-data-[variant=non-bordered-compact]:bg-inherit in-data-[variant=non-bordered-compact]:p-1",
        verticalTableCellText(text),
        className
      )}
      {...props}>
      {isLoading ? (
        <Skeleton className="h-4 w-full max-w-24 in-data-[variant=non-bordered-compact]:h-lh" />
      ) : (
        children
      )}
    </TableCell>
  );
}

TableRoot.displayName = "Table.Root";
TableHeader.displayName = "Table.Header";
TableBody.displayName = "Table.Body";
TableFooter.displayName = "Table.Footer";
TableRow.displayName = "Table.Row";
TableHead.displayName = "Table.Head";
TableCaption.displayName = "Table.Caption";
VerticalTableRoot.displayName = "VerticalTable.Root";
VerticalTableBody.displayName = "VerticalTable.Body";
VerticalTableRow.displayName = "VerticalTable.Row";
VerticalTableValue.displayName = "VerticalTable.Value";

export const Table = {
  Root: TableRoot,
  Header: TableHeader,
  Body: TableBody,
  Footer: TableFooter,
  Row: TableRow,
  Head: TableHead,
  Cell: TableCell,
  Caption: TableCaption,
};

export const VerticalTable = {
  Root: VerticalTableRoot,
  Header: VerticalTableHeader,
  Body: VerticalTableBody,
  Row: VerticalTableRow,
  Key: VerticalTableKey,
  Value: VerticalTableValue,
};
