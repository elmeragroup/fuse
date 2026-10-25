/**
 * Meter, as one component set: each of its four modes at each level of the docs Modes demo, 16
 * cells, with columns by level. A cell's tone and icon come from `meterToneCell`, the table Meter
 * reads, so a designer picks what the meter means and how full it is, and the color and icon follow.
 *
 * - The root is Base UI's `<div data-slot="meter">`, a `flex flex-col gap-1` column. No docs demo
 *   gives it a width, so the kit draws it 256px wide, `w-64`, the width a container gives it, which
 *   the block-level root fills.
 * - The header is a `<div>` with no `data-slot`. It fills the column's width and puts the label at
 *   its start and the value at its end, at least 8px apart.
 * - The label `Storage used` is 14/20 Medium, and the `Label` text property sets it.
 * - The value is the level's share as Base UI shows it, `50%`, `85%`, `100%` and `100%`, at 14/20
 *   Regular in the tone's color. Each cell shows its own text, which no property sets, since a text
 *   property holds one default. The tone's Warning or CheckCircle icon sits before it, with the
 *   space the markup holds between them.
 * - The bar fills the column's width, a 6px `muted` pill.
 * - Base UI's `MeterIndicator` gives the fill `inset-inline-start: 0; height: inherit; width: <share>%`
 *   in a style attribute over its classes, so the fill is an absolute layer at the bar's top left
 *   that keeps its share of the bar's width as the bar stretches, in the tone's color.
 */
import { cn, METER_CONSTANTS, meterToneCell, meterVariants } from "@elmeragroup/fuse/recipe-catalog";

import type {
  Cell,
  ComponentDefinition,
  IconSlot,
  InlineDeclaration,
  PartDefinition,
} from "./component-spec";
import { always } from "./popup-facts";

/** The width a container gives a meter in the kit's previews and the compare host, `w-64`. */
export const METER_PREVIEW_WIDTH = 256;

/** The label every cell shows, which starts the `Label` text property. */
export const METER_LABEL = "Storage used";

const { MODES, LEVELS } = METER_CONSTANTS;

type MeterMode = Parameters<typeof meterToneCell>[0];

/**
 * A level of the docs Modes demo: the value and maximum Meter takes, and the Meter level they
 * render. 130 of 120 exceeds the maximum.
 */
type Sample = {
  readonly value: number;
  readonly max: number;
  readonly level: Parameters<typeof meterToneCell>[1];
};

/** The docs Modes demo's samples, by the `level` axis value, the lowest first. */
const SAMPLES: ReadonlyMap<string, Sample> = new Map([
  ["low", { value: 50, max: 100, level: LEVELS.LOW }],
  ["medium", { value: 85, max: 100, level: LEVELS.MEDIUM }],
  ["full", { value: 100, max: 100, level: LEVELS.FULL }],
  ["exceeded", { value: 130, max: 120, level: LEVELS.EXCEEDED_MAX_VALUE }],
]);

/** The Fuse icon each status glyph of the tone table draws, by its name there. */
const STATUS_ICONS = { warning: "Warning", success: "CheckCircle" } as const;

/**
 * A cell's sample.
 *
 * @param cell - A `meter` cell.
 * @returns The value, maximum and level its `level` names.
 * @throws When the cell names no level the set declares, a defect in the caller's cell.
 */
export function sampleFor(cell: Cell): Sample {
  const sample = cell.level === undefined ? undefined : SAMPLES.get(cell.level);
  if (sample === undefined) {
    throw new Error(`Meter has no level ${cell.level ?? ""}`);
  }
  return sample;
}

/**
 * A cell's mode.
 *
 * @param cell - A `meter` cell.
 * @returns The mode its `mode` names.
 * @throws When the cell names no mode Meter has, a defect in the caller's cell.
 */
export function modeFor(cell: Cell): MeterMode {
  const mode = Object.values(MODES).find((candidate) => candidate === cell.mode);
  if (mode === undefined) {
    throw new Error(`Meter has no mode ${cell.mode ?? ""}`);
  }
  return mode;
}

/**
 * The share of the bar a cell fills, in percent, as Base UI computes it from the value: clamped to
 * 0 and 100, so a value past the maximum fills the bar.
 */
function shareOf(cell: Cell): number {
  const { value, max } = sampleFor(cell);
  return Math.min(100, Math.max(0, (value * 100) / max));
}

/**
 * The value a cell shows: its share as Base UI's `Meter.Value` formats it for `en-US`, the locale the
 * docs set.
 *
 * @param cell - A `meter` cell.
 * @returns The text, such as `85%`.
 */
export function valueTextFor(cell: Cell): string {
  return `${shareOf(cell)}%`;
}

/** The tone table's cell for a Meter cell: the recipe's tone and the status glyph. */
function toneOf(cell: Cell) {
  return meterToneCell(modeFor(cell), sampleFor(cell).level);
}

/** The recipe's slots in a cell's tone. */
function slotsFor(cell: Cell) {
  return meterVariants({ tone: toneOf(cell).tone });
}

/** The status icon before the value, which the tone table names, or none. */
function statusIcons(cell: Cell): readonly IconSlot[] {
  const { icon } = toneOf(cell);
  return icon === "none"
    ? []
    : [
        {
          key: "icon",
          name: "icon",
          side: "start",
          direct: true,
          dataIcon: undefined,
          icon: STATUS_ICONS[icon],
          swapProperty: undefined,
          classes: slotsFor(cell).icon(),
        },
      ];
}

/**
 * The style attribute Base UI's `MeterIndicator` writes on the fill, in its order.
 *
 * @param cell - A `meter` cell.
 * @returns The declarations.
 */
export function fillStyleFor(cell: Cell): readonly InlineDeclaration[] {
  return [
    { property: "inset-inline-start", value: "0" },
    { property: "height", value: "inherit" },
    { property: "width", value: `${shareOf(cell)}%` },
  ];
}

/** The label, Base UI's `Meter.Label`. */
const LABEL: PartDefinition = {
  key: "label",
  slot: "meter-label",
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).label(),
  label: { key: "label", name: "label", characters: METER_LABEL, textProperty: "Label", shownIn: always },
  iconsFor: () => [],
};

/** The value: the status icon, a space, and the share. */
const VALUE: PartDefinition = {
  key: "value",
  slot: "meter-value",
  shownIn: always,
  classesFor: (cell) => {
    const slots = slotsFor(cell);
    return cn(slots.labelValue(), slots.value());
  },
  label: { key: "value", name: "value", charactersFor: valueTextFor, shownIn: always, leadingSpace: true },
  iconsFor: statusIcons,
};

/** The row that holds the label and the value, which carries no `data-slot`. */
const HEADER: PartDefinition = {
  key: "header",
  slot: undefined,
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).labelContainer(),
  label: undefined,
  iconsFor: () => [],
  parts: [LABEL, VALUE],
};

/** The fill, Base UI's `Meter.Indicator`, with the style it writes. */
const FILL: PartDefinition = {
  key: "fill",
  slot: "meter-bar-fill",
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).barFill(),
  styleFor: fillStyleFor,
  label: undefined,
  iconsFor: () => [],
};

/** The bar, Base UI's `Meter.Track`, which holds the fill. */
const BAR: PartDefinition = {
  key: "bar",
  slot: "meter-bar",
  shownIn: always,
  classesFor: (cell) => slotsFor(cell).bar(),
  label: undefined,
  iconsFor: () => [],
  parts: [FILL],
};

/** A meter, as `<Meter label="Storage used" mode value maxValue />` in a 256px container. */
export const METER: ComponentDefinition = {
  key: "meter",
  name: "Meter",
  slot: "meter",
  axes: [
    { name: "mode", values: Object.values(MODES) },
    { name: "level", values: [...SAMPLES.keys()] },
  ],
  columnAxis: "level",
  previewWidth: METER_PREVIEW_WIDTH,
  classesFor: (cell) => slotsFor(cell).root(),
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  omittedMedia: new Map([
    ["forced-colors", "the kit draws the normal colors, not the system colors a forced-colors mode paints"],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER, BAR],
  swapProperties: [],
};
