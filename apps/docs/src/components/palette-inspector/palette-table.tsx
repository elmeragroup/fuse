"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import {
  columnFacetingFeature,
  columnVisibilityFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import {
  createDataTableFilterFn,
  DataTableFilter,
  defineFilterFields,
} from "@elmeragroup/fuse/data-table-filter";
import { Empty } from "@elmeragroup/fuse/empty";
import { Circle, MagnifyingGlass, Stack, SquaresFour } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";

import { alphaPercent, GRADE_LABELS, PALETTE_GROUPS } from "../../lib/palettes";
import type {
  ColorRoleName,
  ContrastGrade,
  PaletteGroup,
  PaletteView,
  PairView,
  ToneView,
} from "../../lib/palettes";
import { GradeBadge, Swatch } from "./color-readout";

const paletteTable = tv({
  slots: {
    root: "flex min-w-0 flex-col gap-3",
    controls: "sm:flex-row sm:items-center flex min-w-0 flex-col gap-2",
    search: "sm:w-64 w-full flex-none",
    bar: "min-w-0 flex-1",
    role: "flex items-center gap-2",
    roleText: "flex min-w-0 flex-col",
    // Names wrap at their hyphens, against the cell's nowrap, only when the table runs out of room, so the long
    // `--selection-*` roles do not widen the whole column.
    roleName: "text-xs font-mono whitespace-normal",
    alias: "text-xs font-mono whitespace-normal text-muted-foreground",
    toneNote: "text-xs whitespace-nowrap text-muted-foreground",
    nowrap: "font-mono whitespace-nowrap",
    values: "flex flex-col",
    // A chromatic literal wraps between its components rather than run past the panel.
    value: "text-xs font-mono whitespace-normal tabular-nums",
    secondaryValue: "text-xs font-mono whitespace-nowrap text-muted-foreground tabular-nums",
    muted: "text-xs whitespace-nowrap text-muted-foreground tabular-nums",
    contrast: "flex flex-col items-start gap-0.5",
    counterpart: "text-xs whitespace-normal text-muted-foreground",
  },
});

const styles = paletteTable();

/** Whether a role's tone is shared with another role. */
type Sharing = "shared" | "own";

/** A role's weakest pair grade, or `none` for a role in no graded pair. */
type RowGrade = ContrastGrade | "none";

/** One row of the Detailed view: a role and its values in the inspected theme and scheme. */
type RoleRow = {
  readonly name: ColorRoleName;
  readonly group: PaletteGroup;
  readonly tone: ToneView;
  readonly step: number;
  readonly oklch: string;
  readonly hex: string;
  readonly alias: string | undefined;
  readonly sharing: Sharing;
  readonly sharesWith: readonly ColorRoleName[];
  readonly grade: RowGrade;
  readonly weakestPair: PairView | undefined;
};

const SHARING_OPTIONS = [
  { value: "shared", label: "Shared tone" },
  { value: "own", label: "Own tone" },
] as const satisfies readonly { value: Sharing; label: string }[];

const GRADE_OPTIONS = [
  { value: "AAA", label: GRADE_LABELS.AAA },
  { value: "AA", label: GRADE_LABELS.AA },
  { value: "below-aa", label: GRADE_LABELS["below-aa"] },
  { value: "none", label: "In no pair" },
] as const satisfies readonly { value: RowGrade; label: string }[];

const GROUP_OPTIONS = PALETTE_GROUPS.map((group) => ({ value: group.id, label: group.label }));

const ROLE_FILTERS = defineFilterFields<RoleRow>()({
  group: { kind: "option", label: "Group", icon: <SquaresFour />, options: GROUP_OPTIONS },
  sharing: { kind: "option", label: "Tone", icon: <Stack />, options: SHARING_OPTIONS },
  grade: { kind: "option", label: "Contrast", icon: <Circle />, options: GRADE_OPTIONS },
});

const dataTableFilter = createDataTableFilterFn({ timeZone: "UTC" });

const { useAppTable: useRoleTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    columnFacetingFeature,
    columnVisibilityFeature,
    rowSortingFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    sortedRowModel: createSortedRowModel(),
    sortFns,
    filterFns: { dataTableFilter },
  }),
  defaultColumn: { filterFn: "dataTableFilter", enableColumnFilter: false },
  enableSortingRemoval: true,
  getRowId: (row: RoleRow) => row.name,
});

/** A weakest pair's ratio for sorting; a role in no pair sorts after every graded one. */
function sortRatio(row: RoleRow): number {
  return row.weakestPair?.ratio ?? Number.POSITIVE_INFINITY;
}

/** Where a role's tone sits in the palette, and whether another role shares it. */
function toneNote(row: RoleRow): string {
  const step = `Tone ${String(row.step)}`;
  return row.sharesWith.length === 0
    ? `${step}, own`
    : `${step}, shared by ${String(row.sharesWith.length + 1)}`;
}

const columns = createAppColumnHelper<RoleRow>();
const COLUMNS = columns.columns([
  columns.accessor("name", {
    header: ({ header }) => <header.SortButton>Role</header.SortButton>,
    cell: ({ row }) => (
      <span className={styles.role()}>
        <Swatch tone={row.original.tone} />
        <span className={styles.roleText()}>
          <span className={styles.roleName()} data-palette-row-role>
            --{row.original.name}
          </span>
          {row.original.alias === undefined ? null : (
            <span className={styles.alias()}>var({row.original.alias})</span>
          )}
          <span className={styles.toneNote()}>{toneNote(row.original)}</span>
        </span>
      </span>
    ),
  }),
  columns.accessor("grade", {
    id: "grade",
    header: ({ header }) => <header.SortButton>Weakest pair</header.SortButton>,
    enableColumnFilter: true,
    sortFn: (left, right) => sortRatio(left.original) - sortRatio(right.original),
    cell: ({ row }) => {
      const pair = row.original.weakestPair;
      if (pair === undefined) {
        return <span className={styles.muted()}>In no pair</span>;
      }
      const other = pair.foreground === row.original.name ? pair.background : pair.foreground;
      const relation = pair.foreground === row.original.name ? "on" : "under";
      return (
        <span className={styles.contrast()}>
          <GradeBadge grade={pair.grade} ratio={pair.ratio} />
          <span className={styles.counterpart()}>
            {relation} <span className={styles.nowrap()}>--{other}</span>
          </span>
        </span>
      );
    },
  }),
  // One column for both notations, last, since a chromatic literal is the widest cell. The table
  // fits the docs column on a desktop and scrolls sideways on a phone.
  columns.accessor("oklch", {
    header: "Value",
    enableSorting: false,
    cell: ({ row }) => {
      const alpha = alphaPercent(row.original.tone);
      return (
        <span className={styles.values()}>
          <span className={styles.value()}>{row.original.oklch}</span>
          <span className={styles.secondaryValue()}>
            {row.original.hex}
            {alpha === undefined ? null : ` · ${alpha}`}
          </span>
        </span>
      );
    },
  }),
  // Filter-only columns: the Role cell states the tone, and the Default view groups the roles.
  columns.accessor("sharing", { header: "Tone", enableColumnFilter: true, enableSorting: false }),
  columns.accessor("group", { header: "Group", enableColumnFilter: true, enableSorting: false }),
]);

function roleRows(view: PaletteView): RoleRow[] {
  return view.roles.map((role) => ({
    name: role.name,
    group: role.group,
    tone: role.tone,
    step: role.tone.step,
    oklch: role.tone.oklch,
    hex: role.tone.hex,
    alias: role.alias,
    sharing: role.sharesWith.length === 0 ? "own" : "shared",
    sharesWith: role.sharesWith,
    grade: role.weakestPair?.grade ?? "none",
    weakestPair: role.weakestPair,
  }));
}

/** Whether a row matches every word of a search, in its name, alias or values. */
function matchesSearch(row: RoleRow, words: readonly string[]): boolean {
  const haystack = [row.name, `--${row.name}`, row.alias ?? "", row.oklch, row.hex].join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * The inspector's Detailed view: one row per color role with its OKLCH and hex values, its tone
 * and whether another role shares it, and its weakest graded pair. The search matches a role's
 * name, the custom property it points at, and its values; the filter narrows by group, shared
 * tone and contrast level.
 */
export function PaletteTable({ view }: { view: PaletteView }): ReactElement {
  const [search, setSearch] = useState("");
  const words = useMemo(() => search.toLowerCase().split(/\s+/u).filter(Boolean), [search]);
  const rows = useMemo(() => roleRows(view), [view]);
  // The search narrows the rows the table holds, so the filter's counts count what it shows.
  const data = useMemo(() => rows.filter((row) => matchesSearch(row, words)), [rows, words]);
  // The filter-only columns stay hidden, so the table fits the docs column on a desktop.
  const table = useRoleTable({
    columns: COLUMNS,
    data,
    initialState: { columnVisibility: { group: false, sharing: false } },
  });

  return (
    <table.AppTable>
      <DataTableFilter.Root table={table} fields={ROLE_FILTERS} timeZone="UTC">
        <div className={styles.root()}>
          <div className={styles.controls()}>
            <InputGroup.Root className={styles.search()}>
              <InputGroup.Addon>
                <MagnifyingGlass aria-hidden />
              </InputGroup.Addon>
              <InputGroup.Input
                type="search"
                aria-label="Search roles"
                placeholder="Role, hex or oklch…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </InputGroup.Root>
            <DataTableFilter.Bar aria-label="Role filters" className={styles.bar()} />
          </div>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <table.Content
            aria-label={`Color roles of ${view.slug}, ${view.scheme}`}
            empty={
              <Empty.Root>
                <Empty.Header>
                  <Empty.Title>No roles match</Empty.Title>
                  <Empty.Description>Try another name or value, or clear the filters.</Empty.Description>
                </Empty.Header>
                <Empty.Content>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      table.resetColumnFilters();
                    }}>
                    Clear search and filters
                  </Button>
                </Empty.Content>
              </Empty.Root>
            }
          />
        </div>
      </DataTableFilter.Root>
    </table.AppTable>
  );
}
