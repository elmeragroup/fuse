"use client";

/**
 * The contexts a scatter Root provides. The root context changes with data, config and formats,
 * never with the pointer, so marks that read it render only on a data change. It imports no
 * cartesian module, so a scatter route ships none.
 */
import { createContext, use, useMemo, useSyncExternalStore } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { isThresholdColor } from "./chart-paint";
import type { ChartPlot } from "./chart-plot-measure";
import type { ChartColor, ChartConfig, ValueFormat } from "./chart-types";
import { seriesPaint } from "./layout/color-key";
import type { DomainGlide, ScatterDomains } from "./layout/domain-glide";
import { ChartCompositionError } from "./layout/errors";
import type { ScatterFrame } from "./layout/scatter-frame";
import { carryWalk } from "./layout/scatter-model";
import type { ScatterModel, WalkState } from "./layout/scatter-model";
import type { ScatterSnapshot, ScatterStore } from "./scatter-chart-store";
import { useScatterStore } from "./scatter-chart-store";

/** How a part draws a series, which the legend's swatch and the active dot's ring read. */
export type ScatterMark =
  | { readonly kind: "points"; readonly diameter: number; readonly variant: "default" | "quiet" }
  | { readonly kind: "line"; readonly variant: "default" | "dashed" | "flowing" | "quiet" };

/**
 * The marks the mounted parts draw, by config key. A part registers after it mounts, so the
 * server and a hydrating legend read none, and the update the registration triggers draws the
 * swatch the part's mark asks for.
 */
export type ScatterMarks = {
  /** Register a part's mark. The result unregisters it. */
  readonly register: (key: string, mark: ScatterMark) => () => void;
  /** The mark a key draws, its points when a part draws them, else its line, or undefined. */
  readonly of: (key: string) => ScatterMark | undefined;
  readonly subscribe: (listener: () => void) => () => void;
  /** A count that changes on every registration, which a subscriber's snapshot reads. */
  readonly version: () => number;
};

/** Create a Root's mark registry. */
export function createScatterMarks(): ScatterMarks {
  const entries = new Map<object, { readonly key: string; readonly mark: ScatterMark }>();
  const listeners = new Set<() => void>();
  let version = 0;
  const notify = (): void => {
    version += 1;
    for (const listener of listeners) listener();
  };
  return {
    register(key, mark) {
      const token = {};
      entries.set(token, { key, mark });
      notify();
      return () => {
        entries.delete(token);
        notify();
      };
    },
    of(key) {
      // A series that Points and Line both draw reads as points, whose dots the ring circles.
      let line: ScatterMark | undefined;
      for (const entry of entries.values()) {
        if (entry.key !== key) continue;
        if (entry.mark.kind === "points") return entry.mark;
        line ??= entry.mark;
      }
      return line;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    version: () => version,
  };
}

/** What every scatter part reads from Root. */
export type ScatterRootContextValue = {
  readonly model: ScatterModel;
  readonly config: ChartConfig;
  readonly locale: SupportedLocale;
  /** Root's `xFormat`, the x values' format. */
  readonly xFormat: ValueFormat;
  /** Root's `valueFormat`, the y values' format, which a series' config `format` overrides. */
  readonly valueFormat: ValueFormat;
  /** Root's `xLabel`, the x measure's name, or undefined. */
  readonly xLabel: string | undefined;
  /** Root's `yLabel`, the y measure's name, or undefined. */
  readonly yLabel: string | undefined;
  /** The pointer and key rate state. */
  readonly store: ScatterStore;
  /** The id prefix every generated id of this Root starts with. */
  readonly id: string;
  /** Root's `aria-label`, or undefined when `aria-labelledby` names the chart. */
  readonly name: string | undefined;
  /** Root's figure once it has mounted, which bounds the tooltip. */
  readonly root: () => HTMLElement | null;
  /** The marks the mounted parts draw. */
  readonly marks: ScatterMarks;
  /** Whether Root has an entrance, which a mark that mounts after it started skips. */
  readonly entrance: boolean;
  /** The domains the marks and the axes draw under, which glide to new ones on a data update. */
  readonly glide: DomainGlide;
};

export const ScatterRootContext = createContext<ScatterRootContextValue | null>(null);

/** Root's measured plot, or null before the browser measures it. */
export const ScatterPlotContext = createContext<ChartPlot | null>(null);

/**
 * Read the enclosing scatter Root.
 *
 * @param part - The calling part's display name, which the error names.
 * @returns The Root's context.
 * @throws {ChartCompositionError} `part-outside-root` when no `ScatterChart.Root` encloses the part.
 */
export function useScatterRoot(part: string): ScatterRootContextValue {
  const value = use(ScatterRootContext);
  if (value === null) {
    throw new ChartCompositionError(part, "part-outside-root", "must be used within ScatterChart.Root.");
  }
  return value;
}

/**
 * Check that a part names a config key.
 *
 * @param part - The calling part's display name.
 * @param config - The Root's config.
 * @param key - The key the part names.
 * @throws {ChartCompositionError} `unknown-key`, listing the valid keys.
 */
export function assertScatterKey(part: string, config: ChartConfig, key: string): void {
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

/** The draw gate as the server and a hydrating part read it. */
function closedOnServer(): boolean {
  return false;
}

/**
 * The domains the marks and the axes draw under now, which glide on a data update. The server and a
 * hydrating part read the model's own.
 *
 * @param context - The Root.
 * @returns The domains.
 */
export function useScatterDomains(context: ScatterRootContextValue): ScatterDomains {
  const { glide } = context;
  return useSyncExternalStore(glide.subscribe, glide.get, glide.get);
}

/**
 * The frame a plot part draws in: Root's measured plot under the drawn domains, once Root opens its
 * draw gate. The server and a hydrating part read the gate closed, so their HTML matches.
 *
 * @param context - The Root.
 * @returns The frame, or null before the plot is measured and while the part hydrates.
 */
export function useScatterFrame(context: ScatterRootContextValue): ScatterFrame | null {
  const { drawing } = context.store;
  const open = useSyncExternalStore(drawing.subscribe, drawing.open, closedOnServer);
  const measured = use(ScatterPlotContext);
  const plot = open ? measured : null;
  const { x, y } = useScatterDomains(context);
  return useMemo(() => (plot === null ? null : { box: plot.box, x, y }), [plot, x, y]);
}

/** Whether a colour is a role list. */
function isRoleList(color: ChartColor): color is Extract<ChartColor, readonly unknown[]> {
  return Array.isArray(color);
}

/**
 * A series' role from config. A widened config can carry a list, a scale or a threshold, which take
 * a step: a threshold its `below` side.
 */
function roleOf(color: ChartColor | undefined): string {
  if (color === undefined) return "chart-1";
  if (isRoleList(color)) return color[0];
  if (isThresholdColor(color)) return color.below.color;
  if (color === "chart-seq" || color === "chart-diverging") return `${color}-4`;
  return color;
}

/**
 * A series' paint, with the consumer's `--chart-color-<key>` first, which its marks, its swatches
 * and the active dot share.
 *
 * @param config - The Root's config.
 * @param key - A config key.
 * @returns A CSS colour.
 */
export function scatterPaint(config: ChartConfig, key: string): string {
  return seriesPaint(key, roleOf(config[key]?.color));
}

/**
 * The walk's fields in a model: the snapshot's own when it already belongs to it, and otherwise
 * carried there by `carryWalk`, the transition the store's `carry` also runs after a data update.
 * Event handlers and effects read the walk through it, so an id never meets a model it does not
 * belong to. It returns the walk's four fields alone, and a reader writes through the store's
 * transitions, never by spreading what it read.
 *
 * @param snapshot - The store's snapshot.
 * @param model - The model the reader draws.
 * @returns The walk's state in `model`'s ids.
 */
export function walkOf(snapshot: ScatterSnapshot, model: ScatterModel): WalkState {
  return carryWalk(snapshot.model, model, snapshot);
}

/**
 * The walk's state in the Root's current model, for a part's render. It subscribes to the walk's
 * fields alone, so a pointer move that keeps the active point renders nothing.
 *
 * @param context - The Root.
 * @returns The walk's state in the Root's model.
 */
export function useWalk(context: ScatterRootContextValue): WalkState {
  const { store, model } = context;
  const from = useScatterStore(store, (snapshot) => snapshot.model);
  const active = useScatterStore(store, (snapshot) => snapshot.active);
  const place = useScatterStore(store, (snapshot) => snapshot.place);
  const dismissed = useScatterStore(store, (snapshot) => snapshot.dismissed);
  const focus = useScatterStore(store, (snapshot) => snapshot.focus);
  return useMemo(
    () => carryWalk(from, model, { active, place, dismissed, focus }),
    [from, model, active, place, dismissed, focus]
  );
}
