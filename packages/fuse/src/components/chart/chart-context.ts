"use client";

/**
 * The contexts a cartesian Root provides. The root context changes with data, config and the
 * effective window, never with the pointer, so marks that read it render only on a data change.
 * The layout context is the seam Panels plug into. Root provides the default layout, and a Panel
 * provides its own, so a mark reads the nearest layout without knowing which: its value domain,
 * the frame its motion maps under on a resize, and the registry its reference labels stack in.
 */
import { createContext, use, useLayoutEffect } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { ChartFollowers } from "./chart-followers";
import type { ChartLabels } from "./chart-labels";
import type { ChartMotion, FrameOwner } from "./chart-motion";
import type { ChartPaths } from "./chart-paths";
import type { ChartStore, EmphasisEntry } from "./chart-store";
import type { TextContext } from "./chart-text";
import type { ChartConfig, ChartIntro, ChartRow, ChartSelectionChangeReason, XFormat } from "./chart-types";
import type { CartesianModel, LayoutInput } from "./layout/cartesian-model";
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
   * Whether a data update relays the plot, as `relaysPlot` decides for what Root sees: it mounts
   * marks at their targets in coordinates the marks that stay share, so every mark snaps with it.
   */
  readonly relays: boolean;
  /** The value domain each config key drew in before the update. */
  readonly from: ReadonlyMap<string, readonly [number, number]>;
  /** The series whose element-form bars or missing ticks the update mounts. */
  readonly mounted: ReadonlySet<string>;
  /** The config keys whose marks still glide from an earlier domain as the update starts. */
  readonly gliding: ReadonlySet<string>;
  /** What the Panels decide about their own domains, before any mark places. */
  readonly layouts: LayoutReports;
};

/**
 * The decisions the Panels add to a data update while they render. Root sees a Panel's inputs only
 * once it registers, after the marks place, so each Panel, which computes its domain during render,
 * decides whether the update moves that domain, before any mark asks how to place.
 */
export type LayoutReports = {
  /** Whether a Panel relays the plot, which snaps every mark of the Root with Root's own decision. */
  relays: boolean;
  /** The config keys whose Panel's domain the update moves, so their marks glide between two. */
  readonly moved: Set<string>;
};

/**
 * Decide, for a Panel while it renders, whether a data update moves its value domain. A moved
 * domain marks its keys as gliding, and a moved or still gliding domain under which the update
 * mounts a bar relays the plot, as `relaysPlot` rules for Root's default layout.
 *
 * @param update - The update the Panel renders first.
 * @param keys - The Panel's series.
 * @param domain - The Panel's value domain under the update.
 */
export function reportLayoutDomain(
  update: ChartUpdate,
  keys: readonly string[],
  domain: readonly [number, number]
): void {
  if (update.kind !== "data") return;
  const moved = keys.some((key) => {
    const from = update.from.get(key);
    return from !== undefined && (from[0] !== domain[0] || from[1] !== domain[1]);
  });
  if (moved) for (const key of keys) update.layouts.moved.add(key);
  const glides = moved || keys.some((key) => update.gliding.has(key));
  if (glides && keys.some((key) => update.mounted.has(key))) update.layouts.relays = true;
}

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
  /** The routes the series paths tween, which their dots, markers and active dots join. */
  readonly paths: ChartPaths;
  /**
   * A Bar registers after it mounts, with its layout's frame, so Root can warn `bars-overlap` for
   * two loose Bars in one layout. The result unregisters it.
   */
  readonly registerBar: (key: string, grouped: boolean, layout: FrameOwner) => () => void;
  /** Whether a mounted Bar draws a config key, which a value follower marks before a line. */
  readonly drawsBar: (key: string) => boolean;
  /** A Bar registers its emphasised slots after it mounts, so the option speaks the word. */
  readonly registerEmphasis: (key: string, entry: EmphasisEntry) => () => void;
  /** A Panel registers after it mounts, in Panel order. The result unregisters it. */
  readonly registerPanel: (panel: PanelEntry) => () => void;
  /**
   * A plot part that draws in the default layout registers after it mounts, so Root's check of the
   * current tree finds one beside Panels. The result unregisters it.
   */
  readonly registerRootPart: (part: string) => () => void;
  /**
   * Place the span of the Panels' plots that Root's surface covers, from their current positions.
   * A Panel calls it after each of its commits, which can move the plots without rendering Root.
   */
  readonly placeSpan: () => void;
  /**
   * The mounted Panels in Panel order, empty until they register. The server and a hydrating render
   * see none, and the render their registration triggers checks the Panel rules.
   */
  readonly panels: readonly PanelEntry[];
  /** The value domain each config key draws in, its Panel's or the default layout's. */
  readonly domains: ReadonlyMap<string, readonly [number, number]>;
  /**
   * The default layout's colour rule over every config key, or null when it holds. A plot part
   * that draws in the default layout throws it, so a config whose Panels each keep one colour
   * family renders.
   */
  readonly colourRule: ChartCompositionError | null;
};

/** What a mounted Panel tells Root: the layout it draws, and its plot for the pointer's pick. */
export type PanelEntry = {
  /** The Panel's series, baseline and `yInclude`, from which Root computes its domain as the Panel does. */
  readonly layout: LayoutInput;
  /** The Panel's plot element, whose box the pointer's y picks the Panel by. */
  readonly plot: () => HTMLElement | null;
};

/** One layout: the y domain, the config keys it covers, its frame and its reference labels. */
export type ChartLayoutContextValue = {
  /** "root" for Root's default layout, "panel" for a Panel's. */
  readonly kind: "root" | "panel";
  readonly keys: readonly string[];
  readonly y: ValueDomain;
  readonly baseline: "zero" | "none";
  /**
   * A token that names the layout's measured frame for its life. Every motion registration takes
   * it, so a resize of one Panel maps the running tweens of that Panel alone.
   */
  readonly owner: FrameOwner;
  /** The layout's reference labels, which stack against its own plot and no other. */
  readonly labels: ChartLabels;
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
 * @throws {ChartCompositionError} `part-outside-root` when no `Chart.Root` encloses the part.
 */
export function useChartLayout(part: string): ChartLayoutContextValue {
  useChartRoot(part);
  const layout = use(ChartLayoutContext);
  // Root provides the default layout around every part, so a part that found Root finds one.
  if (layout === null) throw new Error(`${part} found Chart.Root but no layout, which Root always provides.`);
  return layout;
}

/**
 * The error of a plot part directly under a Root with Panels.
 *
 * @param part - The part's display name.
 * @returns The `part-outside-panel` error.
 */
export function partOutsidePanel(part: string): ChartCompositionError {
  return new ChartCompositionError(
    part,
    "part-outside-panel",
    "sits directly under a Chart.Root that has Panels, so it has no y domain. Move it into the Chart.Panel whose series it draws."
  );
}

/**
 * Read the layout a plot part draws in. A part in the default layout registers with Root, whose
 * check of the current tree throws `part-outside-panel` when Panels have registered beside it.
 *
 * @param part - The calling part's display name.
 * @returns The layout.
 * @throws {ChartCompositionError} `mixed-sentiment-categorical` when the default layout mixes
 *   colour families.
 */
export function usePlotLayout(part: string): ChartLayoutContextValue {
  const { registerRootPart, colourRule } = useChartRoot(part);
  const layout = useChartLayout(part);
  const inRoot = layout.kind === "root";
  useLayoutEffect(() => (inRoot ? registerRootPart(part) : undefined), [inRoot, part, registerRootPart]);
  if (inRoot && colourRule !== null) throw colourRule;
  return layout;
}

/**
 * Check that a mark inside a Panel draws one of the Panel's series.
 *
 * @param part - The calling part's display name.
 * @param layout - The mark's layout.
 * @param key - The config key the mark draws.
 * @throws {ChartCompositionError} `series-not-in-panel`, listing the Panel's series.
 */
export function assertLayoutKey(part: string, layout: ChartLayoutContextValue, key: string): void {
  if (layout.kind === "root" || layout.keys.includes(key)) return;
  const keys = layout.keys.map((name) => JSON.stringify(name)).join(", ");
  throw new ChartCompositionError(
    part,
    "series-not-in-panel",
    `draws ${JSON.stringify(key)}, which its Chart.Panel's series does not list. Add it to the Panel's series, or move the part to the Panel that lists it: ${keys}.`
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
