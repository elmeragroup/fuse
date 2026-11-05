"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { copyValue, formatRatio, formatTone, toneKey } from "../../lib/palettes";
import type {
  PairCell,
  PalettePair,
  PalettePrimitive,
  PaletteTone,
  PinnedCell,
  TokenCell,
  ValueFormat,
} from "../../lib/palettes";
import { SEGMENT_LABELS } from "../../lib/theme";
import { GradeLabel, isCopied, Readout, Swatch, toneLines } from "./color-readout";
import type { CopyFeedback, ReadoutLine } from "./color-readout";

const paletteCells = tv({
  slots: {
    // The trigger fills its cell edge to edge, and its hit area reaches over the 1px row line, so
    // the pointer is always over a trigger and the tooltip stays open between cells. The focus
    // ring is inset, so the next cell cannot paint over it. Cells that share the focused color get
    // a faint ring and fill. The focused cell itself does not, or the faint ring would replace its
    // focus ring.
    trigger:
      "text-sm relative flex h-full min-h-10 w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-start before:absolute before:inset-x-0 before:-inset-y-px hover:bg-accent/60 focus-visible:ring-inset data-same-tone:not-focus-visible:bg-accent/40 data-same-tone:not-focus-visible:ring-1 data-same-tone:not-focus-visible:ring-foreground/35 data-same-tone:not-focus-visible:ring-inset",
    // The value a role sits on, written once and boxed when it names another token or a step.
    pill: "shadow-xs inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-background px-1.5",
    pillLabel: "truncate",
    value: "truncate font-mono tabular-nums",
    sample:
      "text-xs font-semibold flex h-6 w-7 flex-none items-center justify-center rounded-sm border border-foreground/15 bg-(--pair-bg) text-(--pair-fg)",
    ratio: "font-mono tabular-nums",
    // A pinned cell holds no value, but the arrow keys still stop on it. It shows focus with the
    // same inset ring as a value cell.
    pinned:
      "text-xs palette-hatch flex h-full min-h-10 w-full items-center px-2.5 text-muted-foreground outline-hidden select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
  },
  variants: {
    // A contrast cell below AA.
    failing: { true: { trigger: "bg-error-soft text-error-soft-foreground hover:bg-error-soft" } },
  },
});

const styles = paletteCells();

/**
 * A pinned brand's cell: the segment it allows, over a hatch. It takes focus as the grid moves
 * through the row. It has no value to copy and no tooltip, because its text names the segment.
 */
export function PinnedCellView({ cell, column }: { cell: PinnedCell; column: number }): ReactElement {
  return (
    <span tabIndex={-1} className={styles.pinned()} data-grid-cell data-column={column} data-pinned-cell>
      {`${SEGMENT_LABELS[cell.only]} only`}
    </span>
  );
}

/**
 * What a value cell shows, for a role or ramp step in a brand column and for a primitive alike:
 * a color, and the token it names or the ramp step it sits on.
 */
export type CellValue = {
  /** Unique in the table, so one value at a time reads as copied. */
  readonly key: string;
  /** The readout's title, such as `--primary · Fjordkraft`. */
  readonly title: string;
  readonly tone: PaletteTone;
  /** The custom property the value's declaration names, without its dashes. */
  readonly alias: string | undefined;
  /** The ramp step the value equals, such as `shade-100`. */
  readonly step: string | undefined;
  /** The brand column, from 0, which the same-color outline reads. */
  readonly column: number;
};

/** A role's or ramp step's value in one brand column. */
export function tokenValue(
  name: string,
  cell: Extract<TokenCell, { _tag: "value" }>,
  column: number,
  brand: string
): CellValue {
  return {
    key: `${name}:${String(column)}`,
    title: `--${name} · ${brand}`,
    tone: cell.tone,
    alias: cell.alias,
    step: cell.step,
    column,
  };
}

/** A primitive's one value, the same in every theme. */
export function primitiveValue(primitive: PalettePrimitive): CellValue {
  return {
    key: `primitive:${primitive.name}`,
    title: `--${primitive.name}`,
    tone: primitive.tone,
    alias: primitive.alias ?? undefined,
    step: undefined,
    column: 0,
  };
}

type ValueCellViewProps = {
  readonly value: CellValue;
  readonly format: ValueFormat;
  readonly copy: CopyFeedback;
};

/**
 * A value cell: a pill when the value names another token or sits on a ramp step, otherwise a
 * swatch and the value in the chosen format. Its tooltip gives both formats, the alias and the
 * step, and a press copies the value as a color CSS parses.
 */
export function ValueCellView({ value, format, copy }: ValueCellViewProps): ReactElement {
  const label = value.alias ?? value.step;
  const lines: ReadoutLine[] = [
    ...toneLines(value.tone),
    ...(value.alias === undefined ? [] : [{ term: "Alias", value: `var(--${value.alias})` }]),
    ...(value.step === undefined ? [] : [{ term: "Ramp step", value: `brand-${value.step}` }]),
  ];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<button type="button" tabIndex={-1} />}
        className={styles.trigger()}
        data-grid-cell
        data-column={value.column}
        data-tone={toneKey(value.tone)}
        onClick={() => copy.copy(value.key, copyValue(value.tone, format))}>
        {label === undefined ? (
          <>
            <Swatch tone={value.tone} />
            <span className={styles.value()}>{formatTone(value.tone, format)}</span>
          </>
        ) : (
          <span className={styles.pill()} data-palette-pill>
            <Swatch tone={value.tone} />
            <span className={styles.pillLabel()}>{label}</span>
          </span>
        )}
      </Tooltip.Trigger>
      <Tooltip.Content>
        <Readout title={value.title} lines={lines} copied={isCopied(copy, value.key)} />
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

type PairCellViewProps = {
  readonly pair: PalettePair;
  readonly cell: Extract<PairCell, { _tag: "value" }>;
  readonly column: number;
  readonly brand: string;
  readonly copy: CopyFeedback;
};

/**
 * A pair's contrast in one brand column: an "Aa" chip in the pair's own colors, the ratio truncated
 * to two decimals and the WCAG grade. A cell below AA is tinted with the error-soft role.
 */
export function PairCellView({ pair, cell, column, brand, copy }: PairCellViewProps): ReactElement {
  const key = `${pair.foreground}/${pair.background}:${String(column)}`;
  const ratio = formatRatio(cell.ratio);
  const lines: ReadoutLine[] = [
    { term: "Ratio", value: ratio },
    ...toneLines(cell.foreground, "Text "),
    ...toneLines(cell.background, "Surface "),
  ];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={<button type="button" tabIndex={-1} />}
        className={paletteCells({ failing: cell.grade === "below-aa" }).trigger()}
        data-grid-cell
        data-column={column}
        data-contrast-cell={cell.grade}
        onClick={() => copy.copy(key, ratio)}>
        <span
          aria-hidden
          className={styles.sample()}
          data-pair-sample
          style={{ "--pair-fg": cell.foreground.oklch, "--pair-bg": cell.background.oklch }}>
          Aa
        </span>
        <span className={styles.ratio()}>{ratio}</span>
        <GradeLabel grade={cell.grade} />
      </Tooltip.Trigger>
      <Tooltip.Content>
        <Readout
          title={`--${pair.foreground} on --${pair.background} · ${brand}`}
          lines={lines}
          copied={isCopied(copy, key)}>
          {pair.kind === "text-grade"
            ? "Fuse's contrast gate holds this pair at 4.5:1 in every theme."
            : "Outside the text-grade pairs. Fuse's contrast tests hold some of these pairs to a floor of their own and leave the rest unchecked."}
        </Readout>
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
