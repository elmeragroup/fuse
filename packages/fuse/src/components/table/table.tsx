import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import { frameTableBodyShellClass, frameVerticalTableShellClass } from "../../styles/inner-corner/frame";
import { Skeleton } from "../skeleton/skeleton";
import { TableCell } from "./table-cell";
import { TABLE_EDGE_PADDING_CLASSES } from "./table-cell-classes";
import { TableContainer } from "./table-container";
import { verticalTableCellText } from "./vertical-table-cell-text";
import { VerticalTableHeader } from "./vertical-table-header";
import { VerticalTableKey } from "./vertical-table-key";

/** Props for `Table.Root`, a native `table`'s props. */
export type TableRootProps = Omit<ComponentProps<"table">, "aria-label" | "tabIndex"> & {
  /**
   * The table's accessible name. When the table leaves `tabIndex` unset and the box around it,
   * `table-viewport`, can scroll sideways, the box is a tab stop that the browser's scrolling keys
   * scroll. The stop is a group named by the table's `aria-labelledby` and `aria-label`, else by its
   * `Table.Caption`. Name a table that may scroll with `aria-label`, `aria-labelledby` or a
   * `Table.Caption`, since the stop of an unnamed table has no name.
   */
  "aria-label"?: ComponentProps<"table">["aria-label"];
  /**
   * The table's own tab index. Set it when the table handles its own focus. The box around the
   * table then adds no stop, and the browser's scrolling keys scroll it while the table has focus.
   */
  tabIndex?: ComponentProps<"table">["tabIndex"];
};
/** Props for `Table.Header`, a native `thead`'s props. */
export type TableHeaderProps = ComponentProps<"thead">;
/** Props for `Table.Body`, a native `tbody`'s props. */
export type TableBodyProps = ComponentProps<"tbody">;
/** Props for `Table.Footer`, a native `tfoot`'s props. */
export type TableFooterProps = ComponentProps<"tfoot">;
/** Props for `Table.Row`, a native `tr`'s props. */
export type TableRowProps = ComponentProps<"tr"> & {
  /**
   * The row's cells. The table never marks a row selected. Set `data-state="selected"` on the row
   * when the row model selects it, and the row takes the muted fill.
   */
  children?: ComponentProps<"tr">["children"];
};
/** Props for `Table.Head`, a native `th`'s props. */
export type TableHeadProps = ComponentProps<"th">;
/** Props for `Table.Cell`, a native `td`'s props. */
export type TableCellProps = ComponentProps<"td">;
/** Props for `Table.Caption`, a native `caption`'s props. */
export type TableCaptionProps = ComponentProps<"caption">;

/** One key/value row of `VerticalTable.Body`'s `data`. */
export type VerticalTableItem = {
  /**
   * The row's identity, used as its React key. Set it when the list can be filtered, reordered
   * or have rows inserted, so a stateful `value`, such as an open popover or an uncontrolled input,
   * stays with its own item. Defaults to the item's position.
   */
  id?: string | number;
  /** The key cell's content. */
  label: ReactNode;
  /** The value cell's content. */
  value: ReactNode;
  /** The row's text weight, as `VerticalTable.Row`'s `fontWeight`. */
  fontWeight?: "normal" | "bold";
  /** Shows a skeleton in place of the value, as `VerticalTable.Value`'s `isLoading`. */
  isLoading?: boolean;
  /** Whether both cells clip or wrap their text, as `VerticalTable.Value`'s `text`. */
  text?: "default" | "truncate";
};

/** Props for `VerticalTable.Root`, a native `div`'s props and the facts sheet's look. */
export type VerticalTableRootProps = ComponentProps<"div"> & {
  /**
   * The facts sheet's look. `"default"` draws a bordered box in the `panel` fill.
   * `"non-bordered-compact"` drops the border and the fill, keeps the fill of the surface around
   * it, and tightens the cell padding.
   */
  variant?: "default" | "non-bordered-compact";
};

export type { VerticalTableHeaderProps } from "./vertical-table-header";

/** Props for `VerticalTable.Body`, a native `div`'s props, the rows as data and the inner table's props. */
export type VerticalTableBodyProps = ComponentProps<"div"> & {
  /**
   * Key/value rows rendered before `children`. Each item becomes a `VerticalTable.Row` with a
   * `VerticalTable.Key` and a `VerticalTable.Value`.
   */
  data?: VerticalTableItem[];
  /**
   * The inner `Table.Root`'s props. Put association attributes such as `aria-labelledby` here,
   * since the Body's own props, `aria-*` included, stay on the wrapper `div`. A `className` here merges
   * with `table-fixed`.
   */
  tableProps?: TableRootProps;
};

/** Props for `VerticalTable.Row`, a native `tr`'s props, its text weight and whether it hides. */
export type VerticalTableRowProps = ComponentProps<"tr"> & {
  /** The text weight of the row's `VerticalTable.Key` and `VerticalTable.Value`. */
  fontWeight?: "normal" | "bold";
  /** Whether the row is hidden. */
  isHidden?: boolean;
};

export type { VerticalTableKeyProps } from "./vertical-table-key";

/** Props for `VerticalTable.Value`, a native `td`'s props, its text wrapping and a loading state. */
export type VerticalTableValueProps = ComponentProps<"td"> & {
  /** `"truncate"` clips text that overflows the cell; `"default"` wraps it. */
  text?: "default" | "truncate";
  /** Shows a skeleton in place of the children while the value loads. */
  isLoading?: boolean;
};

/**
 * A semantic `<table>` in a container that scrolls sideways. This module has no state, no handlers
 * and no browser APIs, so it stays server-safe. The container renders in its own client module,
 * which measures the overflow. `VerticalTable.Header` and `VerticalTable.Key` are client `useRender`
 * parts, so a host can pick another outline level or a row-header cell without turning this module
 * into a client boundary.
 */
function TableRoot({ className, ...props }: TableRootProps): ReactElement {
  return (
    <TableContainer
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      tableTabIndex={props.tabIndex}>
      <table
        data-slot="table"
        className={cn(
          "text-sm w-full caption-bottom framed-table:border-separate framed-table:border-spacing-0",
          className
        )}
        {...props}
      />
    </TableContainer>
  );
}

function TableHeader({ className, ...props }: TableHeaderProps): ReactElement {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        // In forced colors a selected or focused row draws its frame and outline on a positioned
        // pseudo-element, which would paint over a header a consumer makes sticky with no
        // z-index. The z-index lifts a positioned header above it, and does nothing otherwise.
        "forced-colors:z-1",
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
        // inherit the body's and row's color, so a cell's own color wins too.
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
        // Forced colors replace the selected fill. A fill in `Highlight` would cover what the
        // cells draw themselves, such as a Meter's bar, a sticky cell's background or a text
        // selection, so a selected row draws a 2px `Highlight` frame on its edge instead. Under
        // keyboard focus it draws a 2px `CanvasText` outline 4px in, inside the frame and inside
        // the scrolling container, which clips anything drawn outside the row. Both paint on a
        // pseudo-element over the cells, so a sticky cell without a `z-index` does not cover them
        // as it covers the row's own outline.
        "forced-colors:data-[state=selected]:relative forced-colors:data-[state=selected]:after:pointer-events-none forced-colors:data-[state=selected]:after:absolute forced-colors:data-[state=selected]:after:inset-0 forced-colors:data-[state=selected]:after:border-2 forced-colors:data-[state=selected]:after:border-[Highlight]",
        "forced-colors:focus-visible:relative forced-colors:focus-visible:after:pointer-events-none forced-colors:focus-visible:after:absolute forced-colors:focus-visible:after:inset-0 forced-colors:focus-visible:after:outline-2 forced-colors:focus-visible:after:-outline-offset-6 forced-colors:focus-visible:after:outline-[CanvasText]",
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
