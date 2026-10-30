"use client";

/**
 * The contexts a cartesian Root provides. The root context changes with data, config and the
 * effective window, never with the pointer, so marks that read it render only on a data change.
 * The layout context is the seam Panels plug into. Root provides the default layout, and a Panel
 * provides its own, so a mark reads the nearest layout without knowing which.
 */
import { createContext, use } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartFollowers } from "./chart-followers";
import type { ChartLabels } from "./chart-labels";
import type { ChartMotion } from "./chart-motion";
import type { ChartPaths } from "./chart-paths";
import type { ChartStore, EmphasisEntry } from "./chart-store";
import type { TextContext } from "./chart-text";
import type { ChartConfig, ChartIntro, ChartRow, ChartSelectionChangeReason, XFormat } from "./chart-types";
import type { CartesianModel } from "./layout/cartesian-model";
import { ChartCompositionError } from "./layout/errors";

export { ChartPendingRootContext } from "./chart-pending-root";
import type { ValueDomain } from "./layout/value-domain";

/**
 * What produced Root's current model. "initial" is the first render, "range" a commit that changed
 * `xRange` alone, and "data" any other change, which moves the marks that stay.
 */
export type CommitKind = "initial" | "data" | "range";

/**
 * One change of Root's model. A new object stands for each change, so a mark compares identities
 * to tell a data update it has not drawn yet from a re-render.
 */
export type ChartUpdate = {
  readonly kind: CommitKind;
  /** The key each domain slot's marks render under, by slot index. */
  readonly keys: readonly string[];
  /**
   * Whether a data update relays the plot, as `relaysPlot` decides: it mounts marks at their
   * targets in coordinates the marks that stay share, so every mark snaps with it.
   */
  readonly relays: boolean;
};

/** What every cartesian part reads from Root. */
export type ChartRootContextValue = TextContext & {
  readonly config: ChartConfig;
  readonly locale: SupportedLocale;
  readonly model: CartesianModel;
  readonly xFormat: XFormat | undefined;
  readonly xScale: "band" | "point";
  readonly orientation: "vertical" | "horizontal";
  readonly stackOffset: "diverging" | "expand";
  readonly baseline: "zero" | "none";
  readonly store: ChartStore;
  /** The id prefix every generated id of this Root starts with. */
  readonly id: string;
  /** Root's `aria-label`, or undefined when `aria-labelledby` names the chart. */
  readonly name: string | undefined;
  /** The selected config key, or null. */
  readonly selectedKey: string | null;
  /** Select a key, or clear the selection with null, and announce it. */
  readonly select: (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined) => void;
  /** A LegendToggleGroup registers while it is mounted, and the returned function unregisters it. */
  readonly registerToggleGroup: () => () => void;
  /** Whether a LegendToggleGroup is mounted, so Enter and a plot click select. */
  readonly hasToggles: () => boolean;
  /** Root's figure once it has mounted, which bounds the tooltip. */
  readonly root: () => HTMLElement | null;
  /** Highlight a series through Root's attributes with no React render, or clear it with null. */
  readonly highlight: (key: string | null) => void;
  /** Warn once per Root and rule in production, as a data rule's fallback does. */
  readonly warnOnce: (rule: string, message: string) => void;
  /** Root's `data`, which the Table's extra columns read. */
  readonly rows: readonly ChartRow[];
  /** Root's `data-intro`, the entrance wipe origin. */
  readonly intro: ChartIntro | undefined;
  /** Whether Root mounted in the browser with its entrance on, so marks of its first draw enter. */
  readonly entrance: boolean;
  /** Root's `data-fade`, which dims the marks of past slots. */
  readonly fade: "past" | undefined;
  /** The change that produced the current model. */
  readonly update: ChartUpdate;
  /** Root's animation loop, which every moving mark draws through. */
  readonly motion: ChartMotion;
  /** The marks that follow the active slot. */
  readonly followers: ChartFollowers;
  /** The value reference labels, placed from the guides they label. */
  readonly labels: ChartLabels;
  /** The routes the series paths tween, which their dots, markers and active dots join. */
  readonly paths: ChartPaths;
  /** A Bar registers after it mounts, so Root can warn `bars-overlap`. The result unregisters it. */
  readonly registerBar: (key: string, grouped: boolean) => () => void;
  /** Whether a mounted Bar draws a config key, which a value follower marks before a line. */
  readonly drawsBar: (key: string) => boolean;
  /** A Bar registers its emphasised slots after it mounts, so the option speaks the word. */
  readonly registerEmphasis: (key: string, entry: EmphasisEntry) => () => void;
};

/** One layout: the y domain and the config keys it covers. */
export type ChartLayoutContextValue = {
  readonly keys: readonly string[];
  readonly y: ValueDomain;
  readonly baseline: "zero" | "none";
};

export const ChartRootContext = createContext<ChartRootContextValue | null>(null);
export const ChartLayoutContext = createContext<ChartLayoutContextValue | null>(null);

/**
 * Read the enclosing cartesian Root.
 *
 * @param part - The calling part's display name, which the error names.
 * @returns The Root's context.
 * @throws {ChartCompositionError} `part-outside-root` when no `Chart.Root` encloses the part.
 */
export function useChartRoot(part: string): ChartRootContextValue {
  const value = use(ChartRootContext);
  if (value === null) {
    throw new ChartCompositionError(
      part,
      "part-outside-root",
      "must be used within Chart.Root. Wrap the chart's parts in Chart.Root, or in BarChart.Root, AreaChart.Root or LineChart.Root."
    );
  }
  return value;
}

/**
 * Read the nearest layout, a Panel's or Root's default one.
 *
 * @param part - The calling part's display name.
 * @returns The layout.
 */
export function useChartLayout(part: string): ChartLayoutContextValue {
  const root = useChartRoot(part);
  // Root provides the default layout, so a part inside Root always finds one.
  return (
    use(ChartLayoutContext) ?? { keys: Object.keys(root.config), y: root.model.y, baseline: root.baseline }
  );
}

/**
 * Check that a part names a config key.
 *
 * @param part - The calling part's display name.
 * @param config - The Root's config.
 * @param key - The key the part names.
 * @throws {ChartCompositionError} `unknown-key`, listing the valid keys.
 */
export function assertKnownKey(part: string, config: ChartConfig, key: string): void {
  if (Object.hasOwn(config, key)) return;
  const keys = Object.keys(config)
    .map((name) => JSON.stringify(name))
    .join(", ");
  throw new ChartCompositionError(
    part,
    "unknown-key",
    `received dataKey ${JSON.stringify(key)}, which names no config key. Use one of ${keys}.`
  );
}
