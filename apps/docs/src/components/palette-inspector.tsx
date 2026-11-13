"use client";

import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { Moon, Sun } from "@elmeragroup/fuse/icons";
import { Table } from "@elmeragroup/fuse/table";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { useColorScheme } from "@elmeragroup/fuse/theme";
import { THEME_AXES } from "@elmeragroup/fuse/theme-catalog";
import { Toolbar } from "@elmeragroup/fuse/toolbar";

import { PALETTE_CATALOG } from "../generated/palette-catalog";
import { brandColumns, formatRatio, pairRows, rampRows, roleRows } from "../lib/palettes";
import type {
  BrandColumn,
  ContrastGrade,
  PairValue,
  PalettePairKind,
  PaletteAxes,
  PinnedCell,
  RampValue,
  RoleValue,
} from "../lib/palettes";
import { COLOR_SCHEME_LABELS, IDENTITY_LABELS, SEGMENT_LABELS } from "../lib/theme";
import { usePreviewTheme } from "./preview-theme";
import { SingleToggle } from "./single-toggle";

const paletteInspector = tv({
  slots: {
    root: "not-prose flex min-w-0 flex-col gap-3",
    switches: "flex-wrap",
    // The region is the table's scroller, one tab stop a keyboard scrolls with the arrow keys. Fuse's
    // own table container stops clipping, so the sticky row names stick to this box. The ring is
    // inset, so no ancestor clips it.
    scroller:
      "overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring *:data-[slot=table-container]:overflow-visible",
    // From `sm` the row names stay in view while the brands scroll. Below it they scroll away with
    // the row, since a pinned name would cover most of a phone's width.
    table:
      "sm:[&_tbody_th]:sticky sm:[&_tbody_th]:start-0 sm:[&_tbody_th]:z-10 sm:[&_tbody_th]:bg-background",
    // A long pair name wraps at its hyphens within a fixed width rather than widening the column.
    rowName:
      "text-sm font-normal w-44 min-w-44 text-start font-mono [overflow-wrap:anywhere] whitespace-normal",
    group: "text-sm font-semibold pt-5 text-start",
    groupNote: "font-normal ms-2 text-muted-foreground",
    brandHead: "min-w-36 text-start",
    cell: "min-w-36 align-top",
    value: "flex items-center gap-2",
    hex: "text-sm font-mono tabular-nums",
    // The checker shows only through a translucent tone, so its alpha reads at a glance.
    swatch:
      "palette-checker relative size-4 flex-none overflow-hidden rounded-sm border border-foreground/15 after:absolute after:inset-0 after:bg-(--swatch)",
    link: "text-xs mt-1 flex items-center gap-1 font-mono text-muted-foreground",
    pinned: "text-xs palette-hatch flex min-h-8 items-center rounded-sm px-2 text-muted-foreground",
    sample:
      "text-xs font-semibold flex h-6 w-7 flex-none items-center justify-center rounded-sm border border-foreground/15 bg-(--pair-bg) text-(--pair-fg)",
    footer: "text-sm text-muted-foreground tabular-nums",
  },
});

const styles = paletteInspector();

const SCHEMES = ["light", "dark"] as const;

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
} as const satisfies Record<(typeof SCHEMES)[number], ReactNode>;

/** How each group of contrast pairs reads, and what Fuse's tests hold of it. */
const PAIR_GROUPS = [
  {
    kind: "text-grade",
    label: "Text-grade pairs",
    note: "Fuse's contrast gate holds each at 4.5:1 in every theme and scheme.",
  },
  {
    kind: "held",
    label: "Held in some themes",
    note: "Fuse's contrast gate holds each at 4.5:1 in some schemes or identities only.",
  },
  {
    kind: "unchecked",
    label: "Unchecked pairs",
    note: "No Fuse contrast gate measures these.",
  },
] as const satisfies readonly {
  readonly kind: PalettePairKind;
  readonly label: string;
  readonly note: string;
}[];

type SwitchesProps = {
  readonly axes: PaletteAxes;
  readonly onAxes: (axes: PaletteAxes) => void;
};

/**
 * The theme switches: one per theme axis but the brand, which the columns spread out, then the
 * color scheme.
 */
function Switches({ axes, onAxes }: SwitchesProps): ReactElement {
  return (
    <Toolbar.Root aria-label="Theme" className={styles.switches()}>
      {THEME_AXES.map((axis) => {
        switch (axis.name) {
          case "identity":
            return (
              <SingleToggle
                key={axis.name}
                label="Identity"
                size="sm"
                options={axis.values}
                labels={IDENTITY_LABELS}
                value={axes.identity}
                onValueChange={(identity) => onAxes({ ...axes, identity })}
              />
            );
          case "segment":
            return (
              <SingleToggle
                key={axis.name}
                label="Segment"
                size="sm"
                options={axis.values}
                labels={SEGMENT_LABELS}
                value={axes.segment}
                onValueChange={(segment) => onAxes({ ...axes, segment })}
              />
            );
          case "brand":
            return null;
        }
      })}
      <SingleToggle
        label="Color scheme"
        size="sm"
        options={SCHEMES}
        labels={SCHEME_LABELS}
        value={axes.scheme}
        onValueChange={(scheme) => onAxes({ ...axes, scheme })}
      />
    </Toolbar.Root>
  );
}

/** A color's swatch, painted with the color itself over a checker its alpha lets through. */
function Swatch({ hex }: { hex: string }): ReactElement {
  return <span aria-hidden className={styles.swatch()} style={{ "--swatch": hex }} />;
}

/** A pinned brand's cell: the segment it allows, over a hatch. */
function PinnedCellView({ cell }: { cell: PinnedCell }): ReactElement {
  return <span className={styles.pinned()}>{`${SEGMENT_LABELS[cell.only]} only`}</span>;
}

type BrandTableProps = {
  /** The table's name, and its scroller's. */
  readonly label: string;
  /** The heading of the row names' column. */
  readonly head: string;
  readonly columns: readonly BrandColumn[];
  readonly children: ReactNode;
};

/**
 * A table with one column per brand, in a horizontal scroller that is a named region with one
 * tab stop, so a keyboard reaches the brands past the viewport with the arrow keys in every engine.
 */
function BrandTable({ label, head, columns, children }: BrandTableProps): ReactElement {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={styles.scroller()}>
      <Table.Root aria-label={label} className={styles.table()}>
        <Table.Header>
          <Table.Row>
            <Table.Head>{head}</Table.Head>
            {columns.map((column) => (
              <Table.Head key={column.brand.code} className={styles.brandHead()}>
                {column.brand.name}
              </Table.Head>
            ))}
          </Table.Row>
        </Table.Header>
        {children}
      </Table.Root>
    </div>
  );
}

/** A group's header row inside a table body. */
function GroupRow({ span, children }: { span: number; children: ReactNode }): ReactElement {
  return (
    <Table.Row>
      <Table.Head scope="rowgroup" colSpan={span} className={styles.group()}>
        {children}
      </Table.Head>
    </Table.Row>
  );
}

type BrandRowProps<Value> = {
  /** The row's `data-palette-row` id. */
  readonly id: string;
  /** The row's name, its row header. */
  readonly name: string;
  readonly columns: readonly BrandColumn[];
  readonly cells: readonly (PinnedCell | Value)[];
  /** Draws a theme's cell. A pinned brand's cell shows the segment it allows. */
  readonly children: (cell: Value) => ReactNode;
};

/** One row: its name, then each brand's cell. */
function BrandRow<Value extends { readonly _tag: "value" }>({
  id,
  name,
  columns,
  cells,
  children,
}: BrandRowProps<Value>): ReactElement {
  return (
    <Table.Row data-palette-row={id}>
      <Table.Head scope="row" className={styles.rowName()}>
        {name}
      </Table.Head>
      {cells.map((cell, index) => (
        <Table.Cell key={columns[index]?.brand.code} className={styles.cell()}>
          {cell._tag === "pinned" ? <PinnedCellView cell={cell} /> : children(cell)}
        </Table.Cell>
      ))}
    </Table.Row>
  );
}

/** A ramp step's cell: its color, whether it holds the seed, and the step it points at. */
function RampCellView({ cell }: { cell: RampValue }): ReactElement {
  return (
    <>
      <span className={styles.value()}>
        <Swatch hex={cell.hex} />
        <span className={styles.hex()}>{cell.hex}</span>
        {cell.seed ? (
          <Badge size="sm" variant="outline">
            seed
          </Badge>
        ) : null}
      </span>
      {cell.alias === null ? null : <LinkLine kind="alias" token={cell.alias} />}
    </>
  );
}

/** The line under a value that names the token it points at or the ramp step it equals. */
function LinkLine({ kind, token }: { kind: "alias" | "equals"; token: string }): ReactElement {
  return (
    <span className={styles.link()}>
      <span aria-hidden>{kind === "alias" ? "→" : "="}</span>
      <span className="sr-only">{kind === "alias" ? "points at" : "equals"}</span>
      <span>{token}</span>
    </span>
  );
}

/** A role's cell: its color, and the token it points at or the ramp step it equals. */
function RoleCellView({ cell }: { cell: RoleValue }): ReactElement {
  return (
    <>
      <span className={styles.value()}>
        <Swatch hex={cell.hex} />
        <span className={styles.hex()}>{cell.hex}</span>
      </span>
      {cell.link._tag === "none" ? null : <LinkLine kind={cell.link._tag} token={cell.link.token} />}
    </>
  );
}

/** How each grade reads in a cell, and the badge it takes. */
const GRADES = {
  AAA: { label: "AAA", badge: "soft-success" },
  AA: { label: "AA", badge: "soft-success" },
  "below-aa": { label: "Below AA", badge: "soft-destructive" },
} as const satisfies Record<
  ContrastGrade,
  { readonly label: string; readonly badge: "soft-success" | "soft-destructive" }
>;

/** A pair's cell: an "Aa" sample in the pair's own colors, the truncated ratio and the grade. */
function PairCellView({ cell }: { cell: PairValue }): ReactElement {
  return (
    <span className={styles.value()}>
      <span
        aria-hidden
        className={styles.sample()}
        style={{ "--pair-fg": cell.foreground, "--pair-bg": cell.background }}>
        Aa
      </span>
      <span className={styles.hex()}>{formatRatio(cell.ratio)}</span>
      <Badge size="sm" variant={GRADES[cell.grade].badge}>
        {GRADES[cell.grade].label}
      </Badge>
    </span>
  );
}

/** The brand palettes table: each ramp scale's steps, one column per brand. */
function RampTable({ columns }: { columns: readonly BrandColumn[] }): ReactElement {
  const rows = rampRows(PALETTE_CATALOG, columns);
  return (
    <BrandTable label="Brand palettes" head="Step" columns={columns}>
      {PALETTE_CATALOG.ramps.map(({ scale }) => (
        <Table.Body key={scale}>
          <GroupRow span={columns.length + 1}>{`brand-${scale}`}</GroupRow>
          {rows
            .filter((row) => row.scale === scale)
            .map((row) => (
              <BrandRow key={row.token} id={row.token} name={row.token} columns={columns} cells={row.cells}>
                {(cell) => <RampCellView cell={cell} />}
              </BrandRow>
            ))}
        </Table.Body>
      ))}
    </BrandTable>
  );
}

/** The roles table: each color role, its color and where it points, one column per brand. */
function RoleTable({ columns }: { columns: readonly BrandColumn[] }): ReactElement {
  return (
    <BrandTable label="Color roles" head="Role" columns={columns}>
      <Table.Body>
        {roleRows(PALETTE_CATALOG, columns).map((row) => (
          <BrandRow key={row.name} id={row.name} name={row.name} columns={columns} cells={row.cells}>
            {(cell) => <RoleCellView cell={cell} />}
          </BrandRow>
        ))}
      </Table.Body>
    </BrandTable>
  );
}

/** The contrast table: each graded pair's ratio and grade, one column per brand. */
function ContrastTable({ columns }: { columns: readonly BrandColumn[] }): ReactElement {
  const rows = pairRows(PALETTE_CATALOG, columns);
  const failing = rows
    .flatMap((row) => row.cells)
    .filter((cell) => cell._tag === "value" && cell.grade === "below-aa").length;
  return (
    <>
      <BrandTable label="Contrast pairs" head="Pair" columns={columns}>
        {PAIR_GROUPS.map((group) => (
          <Table.Body key={group.kind}>
            <GroupRow span={columns.length + 1}>
              {group.label}
              <span className={styles.groupNote()}>{group.note}</span>
            </GroupRow>
            {rows
              .filter((row) => row.pair.kind === group.kind)
              .map(({ pair, cells }) => {
                const id = `${pair.foreground}/${pair.background}`;
                return (
                  <BrandRow
                    key={id}
                    id={id}
                    name={`${pair.foreground} on ${pair.background}`}
                    columns={columns}
                    cells={cells}>
                    {(cell) => <PairCellView cell={cell} />}
                  </BrandRow>
                );
              })}
          </Table.Body>
        ))}
      </BrandTable>
      <p className={styles.footer()}>
        {failing === 1 ? "1 cell below AA" : `${String(failing)} cells below AA`}
      </p>
    </>
  );
}

/**
 * The palettes page's tables: each brand's palettes, its color roles and where they point, and
 * its graded contrast pairs, with one column per brand. Identity, segment and scheme switches pick
 * the theme every column shows, and a brand pinned to the other segment shows the one it allows.
 *
 * The identity and segment start on the header picker's preview theme, and the scheme on the
 * page's, until a switch moves them.
 */
export function PaletteInspector(): ReactElement {
  const { theme } = usePreviewTheme();
  const { resolvedColorScheme } = useColorScheme();
  const [picked, setPicked] = useState<PaletteAxes | undefined>(undefined);
  const axes: PaletteAxes = picked ?? {
    identity: theme.identity,
    segment: theme.segment,
    scheme: resolvedColorScheme ?? "light",
  };
  const columns = brandColumns(PALETTE_CATALOG, axes);

  return (
    <section aria-label="Palettes and contrast" className={styles.root()}>
      <Switches axes={axes} onAxes={setPicked} />
      <Tabs.Root defaultValue="palettes">
        <Tabs.List aria-label="Collections">
          <Tabs.Trigger value="palettes">Brand palettes</Tabs.Trigger>
          <Tabs.Trigger value="roles">Roles</Tabs.Trigger>
          <Tabs.Trigger value="contrast">Contrast</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="palettes">
          <RampTable columns={columns} />
        </Tabs.Content>
        <Tabs.Content value="roles">
          <RoleTable columns={columns} />
        </Tabs.Content>
        <Tabs.Content value="contrast">
          <ContrastTable columns={columns} />
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
