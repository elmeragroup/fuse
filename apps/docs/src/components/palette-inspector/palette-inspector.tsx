"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import type { FilterValue } from "@elmeragroup/fuse/data-table-filter";
import { Moon, Sun } from "@elmeragroup/fuse/icons";
import { Select } from "@elmeragroup/fuse/select";
import { THEME_SEGMENTS, THEME_VARIANTS, useColorScheme } from "@elmeragroup/fuse/theme";
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
import { COLOR_SCHEME_LABELS, SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import { usePreviewTheme } from "../preview-theme";
import { SingleToggle } from "../single-toggle";
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

const SCHEME_LABELS = {
  light: (
    <>
      <Sun aria-hidden />
      {COLOR_SCHEME_LABELS.light}
    </>
  ),
  dark: (
    <>
      <Moon aria-hidden />
      {COLOR_SCHEME_LABELS.dark}
    </>
  ),
};

const FORMAT_LABELS = { hex: "Hex", oklch: "OKLCH" } as const satisfies Record<ValueFormat, string>;

/** The brands whose ramps Fuse generates, which the rail names below the ramp scales. */
const GENERATED_RAMP_BRANDS = new Intl.ListFormat("en", { type: "conjunction" }).format(
  PALETTE_CATALOG.brands.flatMap((brand) => (brand.rampOrigin === "generated" ? [brand.name] : []))
);

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

/** The toolbar's switches: variant, segment, scheme and the value format. */
function Switches({ axes, onAxes, format, onFormat }: SwitchesProps): ReactElement {
  return (
    <Toolbar.Root aria-label="Theme" className={styles.switches()}>
      <SingleToggle
        label="Variant"
        size="sm"
        options={THEME_VARIANTS}
        labels={VARIANT_LABELS}
        value={axes.variant}
        onValueChange={(variant) => onAxes({ ...axes, variant })}
      />
      <SingleToggle
        label="Segment"
        size="sm"
        options={THEME_SEGMENTS}
        labels={SEGMENT_LABELS}
        value={axes.segment}
        onValueChange={(segment) => onAxes({ ...axes, segment })}
      />
      <SingleToggle
        label="Color scheme"
        size="sm"
        options={["light", "dark"]}
        labels={SCHEME_LABELS}
        value={axes.scheme}
        onValueChange={(scheme) => onAxes({ ...axes, scheme })}
      />
      <Toolbar.Separator />
      <SingleToggle
        label="Value format"
        size="sm"
        options={["hex", "oklch"]}
        labels={FORMAT_LABELS}
        value={format}
        onValueChange={onFormat}
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
              <p className={styles.railNote()}>{GENERATED_RAMP_BRANDS} are generated from the brand color.</p>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** A collection's row count per group. */
function groupCount(collection: PaletteCollection): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  // A row's group comes from the catalog alone, so rows without columns count the same.
  for (const row of collectionRows(collection, [])) counts.set(row.group, (counts.get(row.group) ?? 0) + 1);
  return counts;
}

/** Each collection's row count per group, for the rail. No switch changes them. */
const GROUP_COUNTS: RailProps["counts"] = {
  roles: groupCount("roles"),
  contrast: groupCount("contrast"),
  ramps: groupCount("ramps"),
  primitives: groupCount("primitives"),
};

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
  const root = useRef<HTMLElement>(null);

  // Stamps the inspector once it is live, as `DemoHydrationMarker` stamps a demo frame: the table
  // hydrates after the docs shell, and a switch pressed before then changes nothing. The passive
  // effect proves the inspector's own effects have run. Browser tests wait for the attribute.
  useEffect(() => {
    const element = root.current;
    element?.setAttribute("data-palette-hydrated", "");
    return () => element?.removeAttribute("data-palette-hydrated");
  }, []);

  const columns = useMemo(
    () => brandColumns(PALETTE_CATALOG, { variant, segment, scheme }),
    [variant, segment, scheme]
  );
  const collected = useMemo(() => collectionRows(collection, columns), [collection, columns]);
  const rows = useMemo(
    () => tableRows(collected.filter((row) => matchesSearch(row, search))),
    [collected, search]
  );
  const section = filteredSection(columnFilters, collection);

  const pick = (next: PaletteCollection, nextSection: string | undefined): void => {
    setCollection(next);
    setColumnFilters(sectionFilter(nextSection));
  };

  return (
    <Tooltip.Provider delay={0}>
      <section ref={root} aria-label="Token inspector" className={styles.window()} data-palette-inspector>
        <Rail collection={collection} section={section} counts={GROUP_COUNTS} onPick={pick} />
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
                  if (next !== null) pick(next, undefined);
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
