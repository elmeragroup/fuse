"use client";

/**
 * What a polar Root shares with its parts and its family's model: the model's contract, the
 * kernel's, and the context the parts read. A light leaf, so a part reaches its Root without the
 * Root's module.
 */
import { createContext, use } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartFollowers } from "./chart-followers";
import type { ChartMotion } from "./chart-motion";
import type { PolarFollow } from "./chart-polar-follow";
import type { ItemSource } from "./chart-polar-item";
import type { PaintedAngles } from "./chart-polar-painted";
import type { ChartReadout, PointerSlot } from "./chart-readout-port";
import type { SeriesTableContext } from "./chart-series-readout";
import type { ChartStore, EmphasisEntry } from "./chart-store";
import type { OptionOrder, TextContext } from "./chart-text";
import type { ChartSelectionChangeReason, ChartX, ValueFormat } from "./chart-types";
import type { FormattedText } from "./format/formatted-text";
import type { ClockSlots } from "./layout/clock-path";
import { ChartCompositionError } from "./layout/errors";
import type { ChartDataRule, ChartHintRule } from "./layout/errors";
import type { SliceAngles } from "./layout/pie";
import type { PolarPoint, Sweep, SweepBox } from "./layout/polar-angle";
import type { RingBand } from "./layout/rings";

/**
 * What a polar Table builds its table from: a series model's words over its keys, as the radar and
 * the clock list them, or the items with their shares, as a pie and a radial chart list them. The
 * Table part builds it, so a Root with no Table never builds one.
 */
export type PolarTableInput =
  | { readonly kind: "series"; readonly context: SeriesTableContext; readonly keys: readonly string[] }
  | {
      readonly kind: "items";
      readonly source: ItemSource;
      /** Each row's share in percent at some digits, or null where it has none. */
      readonly shares: (digits: number) => (number | null)[];
    };

/** The polar families. */
export type PolarFamily = "pie" | "radial" | "radar" | "clock";

/** A ray from the centre, in degrees and in units of the outer radius. */
export type PolarRay = { readonly angle: number; readonly radius: number };

/** What a polar family hands its Root: its geometry, its words, its pick, its table and its readout. */
export type PolarModel = {
  readonly family: PolarFamily;
  /** The whole sweep, whose box the cell keeps: a gauge's empty part included. */
  readonly sweep: Sweep;
  /** The options the listbox steps through: a pie's items, a radial chart's rings or a radar's spokes. */
  readonly count: number;
  /** Each option's key, which a mark renders and tweens under. */
  readonly keys: readonly string[];
  /** Whether no datum draws, which Empty shows and which leaves the listbox out. */
  readonly empty: boolean;
  /** The generated description, spoken text. */
  readonly description: string;
  /**
   * Which key help the family reads: the pie and radial map, the cartesian map a radar shares, or
   * the clock's, whose PageUp and PageDown move one label unit.
   */
  readonly instructions: "polar" | "cartesian" | "clock";
  /** The listbox's orientation: "vertical" for pie and radial, "horizontal" for radar (section 9.3). */
  readonly orientation: "horizontal" | "vertical";
  /** Whether the arrows wrap past the last option: a pie's and a radar's do, a radial chart's rings do not. */
  readonly wrap: boolean;
  /** How many series the Up and Down focus cycles through after "all series", 0 for none. */
  readonly series: number;
  /**
   * The option PageUp or PageDown reaches from an option, one label unit away, or null for a family
   * whose map lets them propagate.
   */
  readonly page: ((index: number, direction: 1 | -1) => number) | null;
  /** An option's spoken name. */
  readonly optionName: (
    index: number,
    focus: number,
    order: OptionOrder,
    emphasis: { readonly [key: string]: EmphasisEntry }
  ) => string;
  /**
   * The option and series under a point, in units of the outer radius from the centre, or null
   * where nothing picks.
   *
   * @param point - The point.
   * @param pixels - CSS pixels per unit, the device pixel ratio, the slice angles a frame painted
   *   at rest, which the pie picks over, undefined while a mark tweens, and the series the pointer
   *   holds.
   */
  readonly pick: (
    point: PolarPoint,
    pixels: {
      readonly scale: number;
      readonly dpr: number;
      readonly painted?: PaintedAngles | undefined;
      /** The series the pointer holds, which a series pick keeps unless another is clearly nearer. */
      readonly near?: number | null | undefined;
      /** Whether the held series stays while it has a reading, as it does just after it changed. */
      readonly nearFirm?: boolean | undefined;
    }
  ) => PointerSlot | null;
  /** The ray the tooltip rests on for an option and a series, or null when nothing draws there. */
  readonly ray: (index: number, near: number | null) => PolarRay | null;
  /** The config key Enter or a plot press selects under a LegendToggleGroup, or null where none applies. */
  readonly selectKey: (index: number, focus: number) => string | null;
  /** Every config key a selection may name. */
  readonly selectable: readonly string[];
  /** What the family's Table builds the rows it lists from, which only a Table part reads. */
  readonly table: PolarTableInput;
  /** Build the family's readout over the kernel, once per model. */
  readonly readout: (kernel: PolarKernel) => ChartReadout;
  /** The data rules the rows broke, with their production fallback already applied. */
  readonly issues: readonly PolarIssue[];
  /** What the family's marks draw. */
  readonly drawing: PolarDrawing;
};

/**
 * What a family's marks draw: a pie's slices or a radial chart's rings, each with the numbers its
 * centre prints, or nothing yet for a radar.
 */
export type PolarDrawing =
  | { readonly kind: "pie"; readonly pie: PieDrawing; readonly centre: CentreModel }
  | { readonly kind: "radial"; readonly radial: RadialDrawing; readonly centre: CentreModel }
  | { readonly kind: "radar"; readonly radar: RadarDrawing }
  | { readonly kind: "clock"; readonly clock: ClockDrawing };

/** One series a clock draws, in config order. */
export type ClockSeries = {
  readonly key: string;
  /** The series' place among the config keys, which focus, selection and highlight name. */
  readonly index: number;
  /** The series paint: a role, a role list's first stop, a scale's middle step or a threshold's lower side. */
  readonly paint: string;
  /** A role list's stops from the tip to the base (R9). */
  readonly stops: readonly string[] | undefined;
  /**
   * A scale's or a threshold's steps, lowest first, each with the radius where it starts, the first
   * at the hole: a curve's gradient turns hard at each radius (D23). Null for one paint.
   */
  readonly steps: readonly { readonly paint: string; readonly from: number }[] | null;
  /** Each reading's step, 0 for the lowest, which a wedge, a dot or the active dot paints in. */
  readonly stepAt: readonly number[];
  readonly stack: string | undefined;
  readonly slots: ClockSlots;
  /** The numbers the series rests on: 1, then each slot's start and end angle, base radius and tip. */
  readonly rest: readonly number[];
  /** Each slot's reading, or null. */
  readonly values: readonly (number | null)[];
  /** Every slot, which a Column decimates by M4 to the drawn dial's circumference past 2,000. */
  readonly shown: readonly number[];
};

/** One label round a clock dial: where it sits, what it reads and from which width it shows. */
export type ClockLabel = {
  /** Its angle in degrees: an hour's slot start, or the middle of a weekday's or a month's span. */
  readonly angle: number;
  /** Its unit's start instant, which an AngleAxis `format` prints. */
  readonly start: number;
  /** Its unit: an hour, a day or a month. */
  readonly unit: "hour" | "day" | "month";
  readonly text: FormattedText;
  /** The narrowest container width it shows at, "always" for the cycle's first, or "none". */
  readonly visibility: number | "always" | "none";
};

/** What a clock's parts draw: its slots, its radius scale and its series. */
export type ClockDrawing = {
  readonly count: number;
  /** Each slot's start instant. */
  readonly starts: readonly number[];
  /**
   * Each slot's wall clock offset from the cycle's start, a repeated wall clock marked as its second
   * pass, which pairs a slot with its twin on another cycle, so a switch between a 24- and a 25-hour
   * day tweens each hour to its new angle.
   */
  readonly pairs: readonly string[];
  /** The hole's radius as a share of the outer radius. */
  readonly inner: number;
  readonly scale: "radial" | "linear";
  /** The radius domain, its minimum at the hole and its maximum at the rim. */
  readonly domain: readonly [number, number];
  /** The ring values, the domain's own ticks. */
  readonly ticks: readonly number[];
  /** The radius of a value, under the Root's scale, extrapolated past the domain. */
  readonly radius: (value: number) => number;
  /** The radius of 0 when the domain spans it, where the solid zero ring sits, or null. */
  readonly zero: number | null;
  readonly series: readonly ClockSeries[];
  /** The cycle's labels: hours round a day, weekdays round a week, months round a year. */
  readonly labels: readonly ClockLabel[];
  /**
   * The visibility each label takes for texts of its own, in the labels' order, thinned by stride
   * as the cycle's labels are for theirs, which an AngleAxis `format` prints.
   */
  readonly fitLabels: (texts: readonly string[]) => readonly (number | "always" | "none")[];
  /** The angle of Root's `now` and its slot, or null when `now` lies outside the cycle. */
  readonly now: { readonly slot: number; readonly angle: number } | null;
  /** The first series' format, which the RadiusAxis prints its ticks in. */
  readonly format: ValueFormat;
  /** How stacks combine, which decides whether a Line or an Area may paint by value. */
  readonly stackOffset: "diverging" | "expand";
  /** Root's `yBaseline`, which a Column and an Area need at "zero". */
  readonly baseline: "zero" | "none";
  /** The series model and its words, which the value parts read. */
  readonly text: TextContext;
  /** The slot of an x, or -1 when no slot holds it. */
  readonly slotOf: (x: ChartX) => number;
};

/** One series a radar draws, in config order. */
export type RadarSeries = {
  readonly key: string;
  /** The series' place among the config keys, which focus, selection and highlight name. */
  readonly index: number;
  readonly paint: string;
  /** A role list's stops from the tip to the base (R9). */
  readonly stops: readonly string[] | undefined;
  /** Each spoke's reading, or null where it is missing. */
  readonly values: readonly (number | null)[];
  /** Each spoke's quality: an estimated spoke dashes and hatches beside it, a missing one draws nothing (R5). */
  readonly qualities: readonly ("estimated" | "corrected" | "missing" | undefined)[];
};

/** What a radar's parts draw: its spokes, its radius domain and its series. */
export type RadarDrawing = {
  /** The spoke count. */
  readonly count: number;
  /** Each spoke's label. */
  readonly labels: readonly FormattedText[];
  /** The radius domain, its minimum at the centre and its maximum at the rim. */
  readonly domain: readonly [number, number];
  /** The ring values, the domain's own ticks. */
  readonly ticks: readonly number[];
  /** The radius of 0 when the domain reaches below it, where the solid zero ring sits, or null. */
  readonly zero: number | null;
  readonly series: readonly RadarSeries[];
  /** The first series' format, which the RadiusAxis prints its ticks in. */
  readonly format: ValueFormat;
};

/** The numbers a centre prints, per item and with nothing active (CONTRACT section 8.13). */
export type CentreModel = {
  /** An item's visible label from config, Other's for the folded slice, or null past the items. */
  readonly label: (index: number) => string | null;
  /** An item's reading, its sign kept, or null for a missing one. */
  readonly value: (index: number) => number | null;
  /** An item's format. */
  readonly format: (index: number) => ValueFormat;
  /** The total with nothing active, or null when the items' formats differ. */
  readonly total: { readonly value: number; readonly format: ValueFormat } | null;
  /** An item's share in percent at `digits`: a slice in the pie's one set, a ring over its maximum. */
  readonly share: (index: number, digits: number) => number | null;
  /** The share with nothing active: a gauge's total over `max`, the rings' sum over their maxima, or null. */
  readonly totalShare: (digits: number) => number | null;
  /** An item's maximum: a gauge's `max`, a ring's own, or null. */
  readonly max: (index: number) => number | null;
  /** The maximum with nothing active: a gauge's `max`, the sum of the rings' maxima, or null. */
  readonly totalMax: number | null;
};

/** One ring a radial chart draws, the first outermost. */
export type RadialRing = {
  /** The item's key, a category, or `OTHER_KEY` and its place for a category config lacks. */
  readonly key: string;
  readonly paint: string;
  /** A role list's stops from the tip to the base, which paint along the sweep (Q12). */
  readonly stops: readonly string[] | undefined;
  /** The category's place among the config keys, which selection and highlight name, or -1. */
  readonly series: number;
  readonly quality: "estimated" | "corrected" | "missing" | undefined;
  /** The ring's place: its centre line's radius, its band and its stroke at the default fill. */
  readonly band: RingBand;
  /** The angle its value fills at rest, never past the sweep. */
  readonly angle: number;
  /** Whether its value passes an explicit maximum. */
  readonly over: boolean;
};

/** What a radial chart's parts draw. */
export type RadialDrawing = {
  readonly sweep: Sweep;
  /** The hole's radius as a share of the outer radius. */
  readonly innerRadius: number;
  readonly rings: readonly RadialRing[];
};

/** One slice a pie draws: a kept category or Other, in sweep order. */
export type PieSlice = {
  /** The item's key, a category or `OTHER_KEY`. */
  readonly key: string;
  readonly label: FormattedText;
  /** The colour role the slice paints with, which decides whether its label fits inside. */
  readonly role: string;
  /** The slice's paint, the consumer's per-key property first. */
  readonly paint: string;
  /** A role list's stops from the tip to the base, which paint from the rim to the hole (Q12). */
  readonly stops: readonly string[] | undefined;
  /** The category's place among the config keys, which selection and highlight name, or -1. */
  readonly series: number;
  /** The slice's angles at rest, before the rim floor, or null where it draws no arc. */
  readonly angles: SliceAngles | null;
  /** The reading's quality: an estimated slice draws hatched, and a missing one draws no arc. */
  readonly quality: "estimated" | "corrected" | "missing" | undefined;
};

/** What a pie's parts draw and print. */
export type PieDrawing = {
  /** The whole sweep, which the Track fills. */
  readonly track: Sweep;
  /** The sweep the slices fill: the whole sweep, or a gauge's total's share of it. */
  readonly fill: Sweep;
  /** The hole's radius as a share of the outer radius. */
  readonly innerRadius: number;
  readonly slices: readonly PieSlice[];
  /** Whether a gauge's total passes its maximum. */
  readonly over: boolean;
  /** A slice's share in the pie's one largest-remainder set at `digits`, or null. */
  readonly share: (index: number, digits: number) => number | null;
  /** The slice a category draws in: its own key, or `OTHER_KEY` when it folds. */
  readonly sliceOf: (category: string) => string;
};

/** One data rule a polar Root's rows broke, which production warns once per subject. */
export type PolarIssue = {
  readonly rule: ChartDataRule;
  readonly subject: string;
  readonly message: string;
};

/** What the kernel hands a family's readout: the Root's own state and actions. */
export type PolarKernel = {
  readonly id: string;
  readonly name: string | undefined;
  readonly locale: SupportedLocale;
  readonly root: () => HTMLElement | null;
  readonly store: ChartStore;
  readonly followers: ChartFollowers;
  /** The angle follower that turns the hand, the active dots and the tooltip's lane offset. */
  readonly follow: PolarFollow;
  readonly select: (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined) => void;
  readonly registerToggleGroup: () => () => void;
  readonly hasToggles: () => boolean;
  readonly highlight: (key: string | null) => void;
  readonly warnOnce: (rule: ChartDataRule | ChartHintRule, subject: string, message: string) => void;
  /**
   * The pick a pointer makes over the cell, a hook with the same calls for the Root's life. Given
   * the option and series the pointer holds, it keeps them across a pick's edge.
   */
  readonly usePick: () => PolarPickAt;
};

/**
 * A pick at a client point. `held` is what the pointer holds now: within 2 CSS px of it, along the
 * pointer's arc or its radius, the pick keeps the held option, and it keeps the held series unless
 * another lies nearer by more than 0.06 of the outer radius.
 */
export type PolarPickAt = (clientX: number, clientY: number, held?: PolarHeld | null) => PointerSlot | null;

/** What a pointer holds: its option and series, and whether its series changed a moment ago. */
export type PolarHeld = PointerSlot & { readonly firm: boolean };

/** What produced the current model: the first render, or new data. */
export type PolarUpdate = { readonly kind: "initial" | "data" };

/** What a polar part reads from its Root. */
export type PolarContextValue = {
  readonly model: PolarModel;
  readonly kernel: PolarKernel;
  readonly motion: ChartMotion;
  /** The sweep's box in units of the outer radius, which the cell's aspect ratio follows. */
  readonly box: SweepBox;
  readonly update: PolarUpdate;
  /** Whether the Root plays an entrance: `data-intro` is not "none" and the reader allows motion. */
  readonly entrance: boolean;
  /** Root's `aria-labelledby`, which the listbox's name joins. */
  readonly labelledBy: string | undefined;
};

/**
 * The enclosing polar Root, or null outside one. Every Root's own scope resets it, so a polar part
 * under a cartesian or scatter Root nested in a polar chart reaches no Root of its own and throws
 * `part-outside-root`, and each polar Root sets it again inside its scope.
 */
export const PolarContext = createContext<PolarContextValue | null>(null);

/**
 * Read the enclosing polar Root.
 *
 * @param part - The calling part's display name, which the error names.
 * @param families - The families the part belongs to.
 * @returns The Root's polar context.
 * @throws {ChartCompositionError} `part-outside-root` when no Root of the family encloses the part.
 */
export function usePolarContext(part: string, families: readonly PolarFamily[]): PolarContextValue {
  const value = use(PolarContext);
  if (value === null || !families.includes(value.model.family)) {
    const roots = families.map((name) => `${ROOTS[name]}`).join(" or ");
    throw new ChartCompositionError(
      part,
      "part-outside-root",
      `must be used within ${roots}. Wrap the chart's parts in it.`
    );
  }
  return value;
}

/** Each family's Root, as an error names it. */
const ROOTS = {
  pie: "PieChart.Root",
  radial: "RadialChart.Root",
  radar: "RadarChart.Root",
  clock: "ClockChart.Root",
} as const;

/**
 * A pie's drawing, which only a pie model holds.
 *
 * @param model - The Root's model.
 * @returns The drawing, or null under a family that draws no pie, where a shared part renders nothing.
 */
export function pieDrawingOf(model: PolarModel): PieDrawing | null {
  return model.drawing.kind === "pie" ? model.drawing.pie : null;
}

/**
 * A pie's drawing, for a part only a pie holds.
 *
 * @param model - The Root's model, a pie's, as `usePolarContext` admitted the part under a pie only.
 * @param part - The part, which a defect names.
 * @returns The drawing.
 * @throws When the model holds no pie, a defect.
 */
export function pieDrawingIn(model: PolarModel, part: string): PieDrawing {
  const pie = pieDrawingOf(model);
  if (pie === null) throw new Error(`${part} read a ${model.family} model, which holds no pie.`);
  return pie;
}

/**
 * A radial chart's drawing, which only a radial model holds.
 *
 * @param model - The Root's model.
 * @returns The drawing, or null under another family.
 */
export function radialDrawingOf(model: PolarModel): RadialDrawing | null {
  return model.drawing.kind === "radial" ? model.drawing.radial : null;
}

/**
 * The numbers a pie's or a radial chart's centre prints.
 *
 * @param model - The Root's model.
 * @returns The centre's numbers, or null under a family with no centre.
 */
export function centreOf(model: PolarModel): CentreModel | null {
  return model.drawing.kind === "pie" || model.drawing.kind === "radial" ? model.drawing.centre : null;
}

/**
 * A clock's drawing, for a part only a clock holds.
 *
 * @param model - The Root's model, a clock's, as `usePolarContext` admitted the part.
 * @param part - The part, which a defect names.
 * @returns The drawing.
 * @throws When the model holds no clock, a defect.
 */
export function clockDrawingIn(model: PolarModel, part: string): ClockDrawing {
  if (model.drawing.kind !== "clock")
    throw new Error(`${part} read a ${model.family} model, which holds no clock.`);
  return model.drawing.clock;
}

/**
 * A radar's drawing, for a part only a radar holds.
 *
 * @param model - The Root's model, a radar's, as `usePolarContext` admitted the part.
 * @param part - The part, which a defect names.
 * @returns The drawing.
 * @throws When the model holds no radar, a defect.
 */
export function radarDrawingIn(model: PolarModel, part: string): RadarDrawing {
  if (model.drawing.kind !== "radar")
    throw new Error(`${part} read a ${model.family} model, which holds no radar.`);
  return model.drawing.radar;
}

/**
 * A radial chart's drawing, for a part only a radial chart holds.
 *
 * @param model - The Root's model, a radial chart's, as `usePolarContext` admitted the part.
 * @param part - The part, which a defect names.
 * @returns The drawing.
 * @throws When the model holds no rings, a defect.
 */
export function radialDrawingIn(model: PolarModel, part: string): RadialDrawing {
  const radial = radialDrawingOf(model);
  if (radial === null) throw new Error(`${part} read a ${model.family} model, which holds no rings.`);
  return radial;
}
