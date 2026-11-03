"use client";

import { useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  tableFeatures,
} from "@tanstack/react-table";
import type { ColumnFiltersState, Updater } from "@tanstack/react-table";
import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import {
  createDataTableFilterFn,
  DataTableFilter,
  defineFilterFields,
  parseColumnFilters,
} from "@elmeragroup/fuse/data-table-filter";
import { Empty } from "@elmeragroup/fuse/empty";
import { Circle, MagnifyingGlass, SquaresFour } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Table } from "@elmeragroup/fuse/table";

import { COLLECTION_GROUPS, GRADE_LABELS } from "../../lib/palettes";
import type {
  BrandColumn,
  ContrastGrade,
  PaletteAxes,
  PaletteCollection,
  PairRow,
  PrimitiveRow,
  TokenRow,
  ValueFormat,
} from "../../lib/palettes";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import type { CopyFeedback } from "./color-readout";
import { CopyStatus, Swatch } from "./color-readout";
import { PairCellView, PinnedCellView, primitiveValue, tokenValue, ValueCellView } from "./palette-cells";
import { useCellGrid } from "./use-cell-grid";

const paletteTable = tv({
  slots: {
    pane: "flex min-w-0 flex-1 flex-col",
    toolbar: "flex flex-wrap items-center gap-2 border-b border-border p-2",
    search: "@2xl:ms-auto @2xl:w-64 w-full",
    bar: "min-w-0 flex-1",
    // The table scrolls inside the pane, as in Figma's variables panel, so the header and the name
    // column stay in view. Fuse's table container is the scroll box, and the selectors below reach
    // it, its header cells and its first column. The scroll padding keeps a focused cell clear of
    // the sticky header and column. The column width is fixed. `use-cell-grid.ts` measures the
    // header height, because a generated ramp's badge makes the header taller. Each brand column
    // fits a ramp step's pill or a hex value, so five brands fit beside the side nav at 1440px.
    scroller:
      "min-w-0 outline-none *:data-[slot=table-container]:max-h-[min(44rem,calc(100dvh-12rem))] *:data-[slot=table-container]:scroll-ps-44 *:data-[slot=table-container]:scroll-pt-[var(--grid-header-height,2.75rem)] *:data-[slot=table-container]:overflow-auto [&_table]:table-fixed [&_tbody_td]:p-0 [&_tbody_td]:align-middle [&_tbody_tr:not([data-group-row])>td:first-child]:sticky [&_tbody_tr:not([data-group-row])>td:first-child]:start-0 [&_tbody_tr:not([data-group-row])>td:first-child]:z-10 [&_tbody_tr:not([data-group-row])>td:first-child]:bg-background [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th]:bg-background [&_thead_th:first-child]:start-0 [&_thead_th:first-child]:z-30 [&_tr:not([data-group-row])>*:first-child]:w-44 [&_tr:not([data-group-row])>*:not(:first-child)]:w-36",
    // A long pair name wraps at its hyphens rather than widening the sticky column.
    name: "text-sm block px-3 py-1.5 font-mono break-words whitespace-normal",
    nameOn: "font-sans text-muted-foreground",
    groupCell: "text-sm font-semibold bg-background",
    footer:
      "text-xs flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-muted-foreground tabular-nums",
    failing: "font-medium text-error",
    groupLabel: "sticky start-0 inline-block px-3 pt-4 pb-1.5",
    // The name wraps beside the swatch, and a generated ramp's badge sits below the name, so the
    // header keeps to the fixed column width.
    header: "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 whitespace-normal",
    generated: "font-normal col-start-2 justify-self-start",
  },
});

const styles = paletteTable();

/** A row of any collection, flattened for the table: its name, its filter values and itself. */
type TableRow = {
  readonly id: string;
  readonly group: string;
  readonly grades: readonly ContrastGrade[];
  readonly row: TokenRow | PairRow | PrimitiveRow;
};

/** A collection's rows as table rows. */
export function tableRows(rows: readonly (TokenRow | PairRow | PrimitiveRow)[]): readonly TableRow[] {
  return rows.map((row) => ({
    id: row.id,
    group: row.group,
    grades: row._tag === "pair" ? row.grades : [],
    row,
  }));
}

const GRADE_OPTIONS = (["AAA", "AA", "below-aa"] as const).map((grade) => ({
  value: grade,
  label: GRADE_LABELS[grade],
}));

/** The filter fields: the section, and in the Contrast collection the grades a pair reaches. */
function filterFields(collection: PaletteCollection) {
  const group = {
    kind: "option",
    label: "Section",
    icon: <SquaresFour />,
    options: COLLECTION_GROUPS[collection].map((entry) => ({ value: entry.id, label: entry.label })),
  } as const;
  return collection === "contrast"
    ? defineFilterFields<TableRow>()({
        group,
        grades: { kind: "multiOption", label: "Contrast", icon: <Circle />, options: GRADE_OPTIONS },
      })
    : defineFilterFields<TableRow>()({ group });
}

/**
 * The one section the filters narrow to, which the rail marks, read through the filter's own parse
 * boundary from TanStack's untyped state.
 *
 * @param filters - The table's column filters.
 * @param collection - The collection whose fields the filters belong to.
 * @returns The section, or `undefined` when the filters hold none or several.
 */
export function filteredSection(
  filters: ColumnFiltersState,
  collection: PaletteCollection
): string | undefined {
  const group = parseColumnFilters(filters, filterFields(collection)).find((entry) => entry.id === "group");
  if (group?.value.kind !== "option" || group.value.operator !== "is") {
    return undefined;
  }
  return group.value.values[0];
}

const SCHEME_NAMES = { light: "light", dark: "dark" } as const;

type TableFooterProps = {
  readonly visible: readonly TableRow[];
  readonly collection: PaletteCollection;
  readonly axes: PaletteAxes;
  readonly copy: CopyFeedback;
};

/** The band below the table: what it shows, the copy status, and the cells below AA. */
function TableFooter({ visible, collection, axes, copy }: TableFooterProps): ReactElement {
  const failing = visible.reduce(
    (sum, entry) =>
      sum +
      (entry.row._tag === "pair"
        ? entry.row.cells.filter((cell) => cell._tag === "value" && cell.grade === "below-aa").length
        : 0),
    0
  );
  return (
    <div className={styles.footer()}>
      <span>
        {visible.length} rows · {VARIANT_LABELS[axes.variant].toLowerCase()} ·{" "}
        {SEGMENT_LABELS[axes.segment].toLowerCase()} · {SCHEME_NAMES[axes.scheme]}
      </span>
      <CopyStatus copy={copy} />
      {collection === "contrast" ? (
        <span className={failing > 0 ? styles.failing() : undefined} data-failing-count>
          {failing === 1 ? "1 cell below AA" : `${String(failing)} cells below AA`}
        </span>
      ) : null}
    </div>
  );
}

const dataTableFilter = createDataTableFilterFn({ timeZone: "UTC" });

const { useAppTable: usePaletteTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    columnFacetingFeature,
    columnVisibilityFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    filterFns: { dataTableFilter },
  }),
  defaultColumn: { filterFn: "dataTableFilter", enableColumnFilter: false },
  getRowId: (row: TableRow) => row.id,
});

const columns = createAppColumnHelper<TableRow>();

/** A brand column's header: the brand's color, its name, and a marker on a generated ramp. */
function BrandHeader({
  column,
  collection,
}: {
  column: BrandColumn;
  collection: PaletteCollection;
}): ReactElement {
  return (
    <span className={styles.header()} data-brand-header>
      <Swatch tone={column.brand.accent} />
      <span>{column.brand.name}</span>
      {collection === "ramps" && column.brand.rampOrigin === "generated" ? (
        <Badge size="sm" variant="outline" className={styles.generated()}>
          generated
        </Badge>
      ) : null}
    </span>
  );
}

/** The columns: the name, the two filter values, then one per brand or the primitives' value. */
function tableColumns(collection: PaletteCollection, brands: readonly BrandColumn[]) {
  const values =
    collection === "primitives"
      ? [columns.display({ id: "value", header: "Value" })]
      : brands.map((column) =>
          columns.display({
            id: `brand-${column.brand.code}`,
            header: () => <BrandHeader column={column} collection={collection} />,
          })
        );
  return columns.columns([
    columns.display({ id: "name", header: "Name" }),
    columns.accessor("group", { header: "Section", enableColumnFilter: true }),
    columns.accessor("grades", {
      header: "Contrast",
      enableColumnFilter: true,
      getUniqueValues: (row) => [...row.grades],
    }),
    ...values,
  ]);
}

/** A row's name: the token, the pair, a ramp step's number or the primitive. */
function RowName({ row }: { row: TokenRow | PairRow | PrimitiveRow }): ReactElement {
  switch (row._tag) {
    case "token":
      return (
        <span className={styles.name()} data-palette-row={row.name}>
          {row.group === "neutral" || row.group === "shade"
            ? row.name.replace(/^brand-[a-z]+-/u, "")
            : row.name}
        </span>
      );
    case "pair":
      return (
        <span className={styles.name()} data-palette-row={row.id}>
          {row.pair.foreground} <span className={styles.nameOn()}>on</span> {row.pair.background}
        </span>
      );
    case "primitive":
      return (
        <span className={styles.name()} data-palette-row={row.primitive.name}>
          {row.primitive.name}
        </span>
      );
  }
}

type RowCellsProps = {
  readonly row: TokenRow | PairRow | PrimitiveRow;
  readonly brands: readonly BrandColumn[];
  readonly format: ValueFormat;
  readonly copy: CopyFeedback;
};

/** A row's value cells: one per brand, or the primitive's one value. */
function RowCells({ row, brands, format, copy }: RowCellsProps): ReactNode {
  if (row._tag === "primitive") {
    return (
      <Table.Cell role="gridcell">
        <ValueCellView value={primitiveValue(row.primitive)} format={format} copy={copy} />
      </Table.Cell>
    );
  }
  return brands.map((column, index) => {
    const cell = row.cells[index];
    let content: ReactNode = null;
    if (cell?._tag === "pinned") {
      content = <PinnedCellView cell={cell} column={index} />;
    } else if (cell !== undefined && row._tag === "token" && "tone" in cell) {
      content = (
        <ValueCellView
          value={tokenValue(row.name, cell, index, column.brand.name)}
          format={format}
          copy={copy}
        />
      );
    } else if (cell !== undefined && row._tag === "pair" && "ratio" in cell) {
      content = (
        <PairCellView pair={row.pair} cell={cell} column={index} brand={column.brand.name} copy={copy} />
      );
    }
    return (
      <Table.Cell key={column.brand.code} role="gridcell">
        {content}
      </Table.Cell>
    );
  });
}

type PaletteTableProps = {
  readonly collection: PaletteCollection;
  readonly rows: readonly TableRow[];
  readonly brands: readonly BrandColumn[];
  readonly format: ValueFormat;
  readonly copy: CopyFeedback;
  readonly search: string;
  readonly onSearch: (search: string) => void;
  readonly columnFilters: ColumnFiltersState;
  readonly onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => void;
  /** The theme switches, which the toolbar holds before the search. */
  readonly switches: ReactNode;
  /** The variant, segment and scheme the columns show, which the footer names. */
  readonly axes: PaletteAxes;
};

/**
 * The variables table: a Fuse DataTable whose rows are a collection's tokens, pairs or primitives
 * under their group rows, and whose columns are the brands. The toolbar searches names and values
 * and filters by section and contrast grade. The table is an ARIA grid: each row's name is its
 * row header, one cell is the tab stop, and the arrow keys move between cells (`use-cell-grid.ts`).
 */
export function PaletteTable({
  collection,
  rows,
  brands,
  format,
  copy,
  search,
  onSearch,
  columnFilters,
  onColumnFiltersChange,
  switches,
  axes,
}: PaletteTableProps): ReactElement {
  const fields = useMemo(() => filterFields(collection), [collection]);
  const tableColumnDefs = useMemo(() => tableColumns(collection, brands), [collection, brands]);
  const table = usePaletteTable({
    columns: tableColumnDefs,
    data: rows,
    state: { columnFilters, columnVisibility: { group: false, grades: false } },
    onColumnFiltersChange,
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const visible = table.getRowModel().rows;
  const grid = useCellGrid(gridRef, visible);
  const groups: readonly { readonly id: string; readonly label: string }[] = COLLECTION_GROUPS[collection];
  const groupLabel = (id: string) => groups.find((group) => group.id === id)?.label ?? id;

  return (
    <table.AppTable>
      <DataTableFilter.Root table={table} fields={fields} timeZone="UTC">
        <div className={styles.pane()}>
          <div className={styles.toolbar()}>
            {switches}
            <InputGroup.Root className={styles.search()}>
              <InputGroup.Addon>
                <MagnifyingGlass aria-hidden />
              </InputGroup.Addon>
              <InputGroup.Input
                type="search"
                aria-label="Search tokens"
                placeholder="Search tokens or values"
                value={search}
                onChange={(event) => {
                  onSearch(event.target.value);
                }}
              />
            </InputGroup.Root>
            <DataTableFilter.Bar aria-label="Table filters" className={styles.bar()} />
          </div>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <div ref={gridRef} className={styles.scroller()} {...grid} data-palette-grid>
            <table.Content
              role="grid"
              aria-label="Palette tokens"
              empty={
                <Empty.Root>
                  <Empty.Header>
                    <Empty.Title>No tokens match</Empty.Title>
                    <Empty.Description>Try another name or value, or clear the filters.</Empty.Description>
                  </Empty.Header>
                  <Empty.Content>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onSearch("");
                        table.resetColumnFilters();
                      }}>
                      Clear search and filters
                    </Button>
                  </Empty.Content>
                </Empty.Root>
              }>
              {(row) => {
                // A group row heads the first row of each group that survives the search and filters.
                const rendered = table.getRowModel().rows;
                const previous = rendered[rendered.indexOf(row) - 1];
                const opensGroup = previous === undefined || previous.original.group !== row.original.group;
                return (
                  <>
                    {opensGroup ? (
                      <Table.Row data-group-row>
                        <Table.Cell
                          role="rowheader"
                          colSpan={1 + (collection === "primitives" ? 1 : brands.length)}
                          className={styles.groupCell()}>
                          <span className={styles.groupLabel()}>{groupLabel(row.original.group)}</span>
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                    <Table.Row data-table-row={row.original.id}>
                      <Table.Cell role="rowheader">
                        <RowName row={row.original.row} />
                      </Table.Cell>
                      <RowCells row={row.original.row} brands={brands} format={format} copy={copy} />
                    </Table.Row>
                  </>
                );
              }}
            </table.Content>
          </div>
          <TableFooter
            visible={visible.map((row) => row.original)}
            collection={collection}
            axes={axes}
            copy={copy}
          />
        </div>
      </DataTableFilter.Root>
    </table.AppTable>
  );
}
