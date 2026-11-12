import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import {
  frameTableBodyShellClass,
  frameTableContainerShellClass,
  frameVerticalTableShellClass,
} from "../../styles/inner-corner/frame";
import { Skeleton } from "../skeleton/skeleton";
import { TableCell } from "./table-cell";
import { TABLE_EDGE_PADDING_CLASSES } from "./table-cell-classes";
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

/** One key/value row of `VerticalTable.Body`'s `data`. */
export type VerticalTableItem = {
  /**
   * The row's identity, used as its React key. Set it when the list can be filtered, reordered
   * or have rows inserted, so a stateful `value` (an open popover, an uncontrolled input) stays
   * with its own item. Defaults to the item's position.
   */
  id?: string | number;
  label: ReactNode;
  value: ReactNode;
  fontWeight?: "normal" | "bold";
  isLoading?: boolean;
  text?: "default" | "truncate";
};

export type VerticalTableRootProps = ComponentProps<"div"> & {
  /**
   * Facts-sheet look. `"default"` draws a bordered box in the `panel` fill and states it as
   * `--surface`. `"non-bordered-compact"` drops the wrapper border/background, keeps the
   * surface of its host, and tightens cell padding via descendant `data-variant` selectors.
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
   * on the wrapper only. `className` merges with `table-fixed`.
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
 * Semantic `<table>` composite. Server compound — it owns no state,
 * no handlers, and no browser APIs. `Header` and
 * `Key` on `VerticalTable` are client `useRender` islands so other outline levels and
 * row-header hosts stay possible without flipping this module to a client boundary.
 */
function TableRoot({ className, ...props }: TableRootProps): ReactElement {
  return (
    <div
      data-slot="table-container"
      className={cn(frameTableContainerShellClass, "relative w-full overflow-x-auto")}>
      <table
        data-slot="table"
        className={cn(
          "text-sm w-full caption-bottom framed-table:border-separate framed-table:border-spacing-0",
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
        // oxlint-disable-next-line fuse/state-face -- table rows are not controls and have no disabled state
        "[&_tr]:border-b framed-table:*:[tr]:border-none framed-table:*:[tr]:hover:bg-transparent framed-table:*:[tr]:hover:[--table-row-foreground:currentColor]",
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
        frameTableBodyShellClass,
        // A framed cell pairs its `panel` fill with `panel-foreground`. The body writes its text
        // through one plain `text-(color:--table-body-foreground)`, and the framed arm sets only
        // the property, so a `text-*` in `className` replaces the utility in every state. Cells
        // inherit the body's and row's colour, so a cell's own colour wins too.
        // oxlint-disable-next-line fuse/state-face -- table rows are not controls and have no disabled state
        "before:shadow-[0_1px_--theme(--color-black/6%)] relative text-(color:--table-body-foreground) [--table-body-foreground:currentColor] before:pointer-events-none before:absolute before:inset-px not-framed-table:before:hidden framed-table:shadow-[shadow:0_var(--frame-shadow-y,1px)_var(--frame-shadow-blur,2px)_0_black]/5 framed-table:[--table-body-foreground:--theme(--color-panel-foreground)] [&_tr:last-child]:border-0 framed-table:*:[tr]:border-0 framed-table:*:[tr]:*:[td]:border-b framed-table:*:[tr]:*:[td]:bg-panel framed-table:*:[tr]:*:[td]:bg-clip-padding framed-table:*:[tr]:*:[td]:[--surface-muted-foreground:--theme(--color-muted-foreground)] framed-table:*:[tr]:*:[td]:[--surface:--theme(--color-panel)] framed-table:*:[tr]:*:[td]:first:border-s framed-table:*:[tr]:first:*:[td]:border-t framed-table:*:[tr]:*:[td]:last:border-e framed-table:*:[tr]:hover:*:[td]:bg-transparent framed-table:*:[tr]:data-[state=selected]:*:[td]:bg-muted/72",
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
        // oxlint-disable-next-line fuse/state-face -- table rows are not controls and have no disabled state
        "font-medium border-t bg-muted/72 framed-table:border-none framed-table:bg-transparent framed-table:*:[tr]:hover:bg-transparent framed-table:*:[tr]:hover:[--table-row-foreground:currentColor] [&>tr]:last:border-b-0",
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
        // A hovered or selected row shows `muted`, in its own fill or through a framed cell's, so
        // its text takes `foreground`, the gated pair on `muted`; at rest it keeps the text around
        // it. The state arms set only `--table-row-foreground`, which one plain text utility reads,
        // so a `text-*` in `className` replaces it in every state.
        // oxlint-disable-next-line fuse/state-face -- table rows are not controls and have no disabled state
        "border-b text-(color:--table-row-foreground) transition-colors [--table-row-foreground:currentColor] hover:bg-muted/72 hover:[--table-row-foreground:--theme(--color-foreground)] data-[state=selected]:bg-muted/72 data-[state=selected]:[--table-row-foreground:--theme(--color-foreground)] framed-table:hover:bg-transparent framed-table:data-[state=selected]:bg-transparent",
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
        TABLE_EDGE_PADDING_CLASSES,
        "font-medium box-border h-(--row-h-header) text-start align-middle leading-none whitespace-nowrap text-muted-foreground has-[[role=checkbox]]:w-px",
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
      className={cn(
        "text-sm mt-4 px-[var(--table-edge-px,0px)] [text-align:var(--table-caption-align,revert)] text-muted-foreground framed-table:my-4",
        className
      )}
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
        frameVerticalTableShellClass,
        // The compact box keeps the text around it. Its arm sets only the property the one plain
        // text utility reads, so a `text-*` in `className` replaces that utility in both variants.
        "overflow-hidden rounded-md border bg-panel text-(color:--vertical-table-foreground) [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-panel)] [--vertical-table-foreground:--theme(--color-panel-foreground)] in-data-[variant=non-bordered-compact]:border-none in-data-[variant=non-bordered-compact]:bg-inherit in-data-[variant=non-bordered-compact]:[--surface-muted-foreground:inherit] in-data-[variant=non-bordered-compact]:[--surface:inherit] in-data-[variant=non-bordered-compact]:[--vertical-table-foreground:currentColor]",
        className
      )}
      {...props}>
      <Table.Root className={cn("table-fixed", tableClassName)} {...innerTableProps}>
        {/* The box's own border closes the last row, so the row drops its bottom border. */}
        <tbody data-slot="vertical-table-body" className="*:last:border-b-0">
          {data && data.length > 0
            ? data.map(
                (
                  { id, label, value, fontWeight = "normal", isLoading = false, text = "truncate" },
                  index
                ) => (
                  <VerticalTableRow
                    key={
                      id === undefined ? `vertical-table-row-label-${index}` : `vertical-table-row-id-${id}`
                    }
                    fontWeight={fontWeight}>
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
        // oxlint-disable-next-line fuse/state-face -- table rows are not controls and have no disabled state
        "group/vertical-table-row-item *:border-border hover:bg-transparent hover:[--table-row-foreground:currentColor] [&>:not(:last-child)]:border-e",
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
        "text-sm *:text-sm **:text-sm group-data-[font-weight=bold]/vertical-table-row-item:font-medium group-data-[font-weight=normal]/vertical-table-row-item:font-normal",
        "in-data-[variant=non-bordered-compact]:border-none in-data-[variant=non-bordered-compact]:bg-inherit in-data-[variant=non-bordered-compact]:py-1 in-data-[variant=non-bordered-compact]:[--table-cell-pe:--spacing(1)] in-data-[variant=non-bordered-compact]:[--table-cell-ps:--spacing(1)]",
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
