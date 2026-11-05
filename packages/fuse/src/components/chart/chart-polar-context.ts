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
import type { ChartReadout, ChartTableModel, PointerSlot } from "./chart-readout-port";
import type { ChartStore } from "./chart-store";
import type { OptionOrder } from "./chart-text";
import type { ChartSelectionChangeReason } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
import type { ChartDataRule, ChartHintRule } from "./layout/errors";
import type { PolarPoint, Sweep, SweepBox } from "./layout/polar-angle";

/** The polar families. */
export type PolarFamily = "pie" | "radial" | "radar";

/** A ray from the centre, in degrees and in units of the outer radius. */
export type PolarRay = { readonly angle: number; readonly radius: number };

/** What a polar family hands its Root: its geometry, its words, its pick, its table and its readout. */
export type PolarModel = {
  readonly family: PolarFamily;
  readonly sweep: Sweep;
  /** The options the listbox steps through: a pie's items, a radial chart's rings or a radar's spokes. */
  readonly count: number;
  /** Each option's key, which a mark renders and tweens under. */
  readonly keys: readonly string[];
  /** Whether no datum draws, which Empty shows and which leaves the listbox out. */
  readonly empty: boolean;
  /** The generated description, spoken text. */
  readonly description: string;
  /** Which key help the family reads: the pie and radial map, or the cartesian map a radar shares. */
  readonly instructions: "polar" | "cartesian";
  /** The listbox's orientation: "vertical" for pie and radial, "horizontal" for radar (section 9.3). */
  readonly orientation: "horizontal" | "vertical";
  /** Whether the arrows wrap past the last option: a pie's and a radar's do, a radial chart's rings do not. */
  readonly wrap: boolean;
  /** How many series the Up and Down focus cycles through after "all series", 0 for none. */
  readonly series: number;
  /** An option's spoken name. */
  readonly optionName: (index: number, focus: number, order: OptionOrder) => string;
  /**
   * The option and series under a point, in units of the outer radius from the centre, or null
   * where nothing picks.
   *
   * @param point - The point.
   * @param pixels - CSS pixels per unit and the device pixel ratio, which the pie's rim floor reads.
   */
  readonly pick: (
    point: PolarPoint,
    pixels: { readonly scale: number; readonly dpr: number }
  ) => PointerSlot | null;
  /** The ray the tooltip rests on for an option and a series, or null when nothing draws there. */
  readonly ray: (index: number, near: number | null) => PolarRay | null;
  /** The config key Enter or a plot press selects under a LegendToggleGroup, or null where none applies. */
  readonly selectKey: (index: number, focus: number) => string | null;
  /** Every config key a selection may name. */
  readonly selectable: readonly string[];
  /** The rows the family's Table lists. */
  readonly table: ChartTableModel;
  /** Build the family's readout over the kernel, once per model. */
  readonly readout: (kernel: PolarKernel) => ChartReadout;
  /** The data rules the rows broke, with their production fallback already applied. */
  readonly issues: readonly PolarIssue[];
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
  readonly select: (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined) => void;
  readonly registerToggleGroup: () => () => void;
  readonly hasToggles: () => boolean;
  readonly highlight: (key: string | null) => void;
  readonly warnOnce: (rule: ChartDataRule | ChartHintRule, subject: string, message: string) => void;
  /** The pick a pointer makes over the cell, a hook with the same calls for the Root's life. */
  readonly usePick: () => (clientX: number, clientY: number) => PointerSlot | null;
};

/** What produced the current model: the first render, or new data. */
export type PolarUpdate = { readonly kind: "initial" | "data"; readonly keys: readonly string[] };

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

/** The enclosing polar Root, or null outside one. */
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
const ROOTS = { pie: "PieChart.Root", radial: "RadialChart.Root", radar: "RadarChart.Root" } as const;
