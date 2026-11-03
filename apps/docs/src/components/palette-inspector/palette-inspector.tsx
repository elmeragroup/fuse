"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import type { FilterValue } from "@elmeragroup/fuse/data-table-filter";
import { Moon, Sun } from "@elmeragroup/fuse/icons";
import { Select } from "@elmeragroup/fuse/select";
import { useColorScheme } from "@elmeragroup/fuse/theme";
import type { ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";
import { Toolbar } from "@elmeragroup/fuse/toolbar";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { PALETTE_CATALOG } from "../../generated/palette-catalog";
import {
  brandColumns,
  COLLECTION_GROUPS,
  matchesSearch,
  pairRows,
  primitiveRows,
  tokenRows,
} from "../../lib/palettes";
import type { BrandColumn, PaletteAxes, PaletteCollection, ValueFormat } from "../../lib/palettes";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { usePreviewTheme } from "../preview-theme";
import { useCopyFeedback } from "./color-readout";
import { filteredSection, PaletteTable, tableRows } from "./palette-table";

const paletteInspector = tv({
  slots: {
    window:
      "not-prose shadow-xs @container flex min-w-0 overflow-hidden rounded-xl border border-border bg-background",
    rail: "@3xl:flex hidden w-44 flex-none flex-col gap-0.5 border-e border-border bg-card p-2",
    railHeading: "text-xs font-medium tracking-wide px-2 pt-1 pb-2 text-muted-foreground uppercase",
    railItem: "w-full justify-between",
    railSub: "font-normal w-full justify-between ps-5",
    railCount: "text-xs font-normal text-muted-foreground tabular-nums",
    railNote: "text-xs px-2 pb-2 text-pretty text-muted-foreground",
    phonePicker: "@3xl:hidden w-full",
    switches: "flex-wrap",
  },
});

const styles = paletteInspector();

const COLLECTIONS = [
  { id: "roles", label: "Roles" },
  { id: "contrast", label: "Contrast" },
  { id: "ramps", label: "Brand ramps" },
  { id: "primitives", label: "Primitives" },
] as const satisfies readonly { readonly id: PaletteCollection; readonly label: string }[];

const COLLECTION_LABELS = Object.fromEntries(COLLECTIONS.map((entry) => [entry.id, entry.label]));

const SCHEME_LABELS = { light: "Light", dark: "Dark" } as const satisfies Record<ResolvedColorScheme, string>;

function isCollection(value: string | null): value is PaletteCollection {
  return COLLECTIONS.some((entry) => entry.id === value);
}

/** The section filter a rail item sets, or none for a whole collection. */
function sectionFilter(section: string | undefined): ColumnFiltersState {
  if (section === undefined) {
    return [];
  }
  const value: FilterValue = { kind: "option", operator: "is", values: [section] };
  return [{ id: "group", value }];
}

/** The rows of a collection for the brand columns the switches pick. */
function collectionRows(collection: PaletteCollection, columns: readonly BrandColumn[]) {
  switch (collection) {
    case "roles":
    case "ramps":
      return tokenRows(PALETTE_CATALOG, columns, collection);
    case "contrast":
      return pairRows(PALETTE_CATALOG, columns);
    case "primitives":
      return primitiveRows(PALETTE_CATALOG);
  }
}

type SwitchesProps = {
  readonly axes: PaletteAxes;
  readonly onAxes: (axes: PaletteAxes) => void;
  readonly format: ValueFormat;
  readonly onFormat: (format: ValueFormat) => void;
};

/** One switch of the toolbar: a two-item ToggleGroup that keeps one item pressed. */
function Switch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { readonly value: T; readonly label: string; readonly icon?: ReactElement }[];
  onChange: (value: T) => void;
}): ReactElement {
  return (
    <ToggleGroup.Root
      aria-label={label}
      size="sm"
      variant="outline"
      spacing={0}
      value={[value]}
      onValueChange={(next) => {
        const picked = options.find((option) => option.value === next[0]);
        if (picked !== undefined) onChange(picked.value);
      }}>
      {options.map((option) => (
        <ToggleGroup.Item key={option.value} value={option.value}>
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** The toolbar's switches: variant, segment, scheme and the value format. */
function Switches({ axes, onAxes, format, onFormat }: SwitchesProps): ReactElement {
  const variants: readonly ThemeVariant[] = ["external", "internal"];
  const segments: readonly ThemeSegment[] = ["private", "company"];
  return (
    <Toolbar.Root aria-label="Theme" className={styles.switches()}>
      <Switch
        label="Variant"
        value={axes.variant}
        options={variants.map((variant) => ({ value: variant, label: VARIANT_LABELS[variant] }))}
        onChange={(variant) => onAxes({ ...axes, variant })}
      />
      <Switch
        label="Segment"
        value={axes.segment}
        options={segments.map((segment) => ({ value: segment, label: SEGMENT_LABELS[segment] }))}
        onChange={(segment) => onAxes({ ...axes, segment })}
      />
      <Switch
        label="Color scheme"
        value={axes.scheme}
        options={[
          { value: "light", label: SCHEME_LABELS.light, icon: <Sun aria-hidden /> },
          { value: "dark", label: SCHEME_LABELS.dark, icon: <Moon aria-hidden /> },
        ]}
        onChange={(scheme) => onAxes({ ...axes, scheme })}
      />
      <Toolbar.Separator />
      <Switch
        label="Value format"
        value={format}
        options={[
          { value: "hex", label: "Hex" },
          { value: "oklch", label: "OKLCH" },
        ]}
        onChange={onFormat}
      />
    </Toolbar.Root>
  );
}

type RailProps = {
  readonly collection: PaletteCollection;
  readonly section: string | undefined;
  readonly counts: { readonly [C in PaletteCollection]: ReadonlyMap<string, number> };
  readonly onPick: (collection: PaletteCollection, section: string | undefined) => void;
};

/** The collections rail: each collection with its row count, and its groups below it. */
function Rail({ collection, section, counts, onPick }: RailProps): ReactElement {
  return (
    <nav aria-label="Collections" className={styles.rail()}>
      <p className={styles.railHeading()}>Collections</p>
      {COLLECTIONS.map((entry) => {
        const groups = counts[entry.id];
        const total = [...groups.values()].reduce((sum, count) => sum + count, 0);
        const open = entry.id === collection;
        return (
          <div key={entry.id}>
            <Button
              variant={open && section === undefined ? "secondary" : "ghost"}
              size="sm"
              className={styles.railItem()}
              aria-current={open && section === undefined ? "true" : undefined}
              onClick={() => onPick(entry.id, undefined)}>
              {entry.label}
              <span className={styles.railCount()}>{total}</span>
            </Button>
            {open
              ? COLLECTION_GROUPS[entry.id].map((group) => (
                  <Button
                    key={group.id}
                    variant={section === group.id ? "secondary" : "ghost"}
                    size="sm"
                    className={styles.railSub()}
                    aria-current={section === group.id ? "true" : undefined}
                    onClick={() => onPick(entry.id, group.id)}>
                    {group.label}
                    <span className={styles.railCount()}>{groups.get(group.id) ?? 0}</span>
                  </Button>
                ))
              : null}
            {open && entry.id === "ramps" ? (
              <p className={styles.railNote()}>
                Elmera and Nordic Green Energy are generated from the brand color.
              </p>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** Each collection's row count per group, for the rail. */
function groupCounts(columns: readonly BrandColumn[]): RailProps["counts"] {
  const count = (rows: readonly { readonly group: string }[]) => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
    return counts;
  };
  return {
    roles: count(tokenRows(PALETTE_CATALOG, columns, "roles")),
    contrast: count(pairRows(PALETTE_CATALOG, columns)),
    ramps: count(tokenRows(PALETTE_CATALOG, columns, "ramps")),
    primitives: count(primitiveRows(PALETTE_CATALOG)),
  };
}

/**
 * The palettes page's variables table, laid out as Figma's variables panel: collections in a rail,
 * tokens as rows and the seven brands as columns. Variant, segment and scheme pick which theme
 * each column shows, and a brand pinned to the other segment shows the one it allows. A role sits
 * in a pill when it aliases another token or its value equals a step of its brand's ramps.
 *
 * The variant and segment start on the header picker's preview theme, and the scheme on the
 * page's, until a switch moves them.
 */
export function PaletteInspector(): ReactElement {
  const { theme } = usePreviewTheme();
  const { resolvedColorScheme } = useColorScheme();
  const [picked, setPicked] = useState<Partial<PaletteAxes>>({});
  const variant = picked.variant ?? theme.variant;
  const segment = picked.segment ?? theme.segment;
  const scheme = picked.scheme ?? resolvedColorScheme ?? "light";
  const axes: PaletteAxes = { variant, segment, scheme };
  const [collection, setCollection] = useState<PaletteCollection>("roles");
  const [format, setFormat] = useState<ValueFormat>("hex");
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const copy = useCopyFeedback();

  const columns = useMemo(
    () => brandColumns(PALETTE_CATALOG, { variant, segment, scheme }),
    [variant, segment, scheme]
  );
  const counts = useMemo(() => groupCounts(columns), [columns]);
  const rows = useMemo(
    () => tableRows(collectionRows(collection, columns).filter((row) => matchesSearch(row, search))),
    [collection, columns, search]
  );
  const section = filteredSection(columnFilters, collection);

  const pick = (next: PaletteCollection, nextSection: string | undefined): void => {
    setCollection(next);
    setColumnFilters(sectionFilter(nextSection));
  };

  return (
    <Tooltip.Provider delay={0}>
      <section aria-label="Token inspector" className={styles.window()} data-palette-inspector>
        <Rail collection={collection} section={section} counts={counts} onPick={pick} />
        <PaletteTable
          collection={collection}
          rows={rows}
          brands={columns}
          format={format}
          copy={copy}
          search={search}
          onSearch={setSearch}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          switches={
            <>
              <Select.Root<PaletteCollection>
                items={COLLECTION_LABELS}
                value={collection}
                onValueChange={(next) => {
                  if (isCollection(next)) pick(next, undefined);
                }}>
                <Select.Trigger size="sm" aria-label="Collection" className={styles.phonePicker()}>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {COLLECTIONS.map((entry) => (
                    <Select.Item key={entry.id} value={entry.id}>
                      {entry.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <Switches axes={axes} onAxes={(next) => setPicked(next)} format={format} onFormat={setFormat} />
            </>
          }
          axes={axes}
        />
      </section>
    </Tooltip.Provider>
  );
}
