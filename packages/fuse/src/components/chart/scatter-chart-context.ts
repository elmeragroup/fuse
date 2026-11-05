"use client";

/**
 * The contexts a scatter Root provides. The root context changes with data, config and formats,
 * never with the pointer, so marks that read it render only on a data change. It imports no
 * cartesian module, so a scatter route ships none.
 */
import { createContext, use, useMemo, useSyncExternalStore } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { useDrawGateOpen } from "./chart-draw-gate";
import type { ChartPlot } from "./chart-plot-measure";
import type { ChartConfig, ValueFormat } from "./chart-types";
import { seriesPaint, singleRole } from "./layout/color-key";
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
 * A mark's dot diameter: a Points part's, or 0 for a line or no mark.
 *
 * @param mark - The mark a series draws, or undefined.
 * @returns The diameter in CSS pixels.
 */
export function dotOf(mark: ScatterMark | undefined): number {
  return mark?.kind === "points" ? mark.diameter : 0;
}

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
};

/** Create a Root's mark registry. */
export function createScatterMarks(): ScatterMarks {
  const entries = new Map<object, { readonly key: string; readonly mark: ScatterMark }>();
  const listeners = new Set<() => void>();
  const notify = (): void => {
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
  /**
   * The model's own domains when the data update that brought the model snaps them, or null when
   * it glides. A snapping update draws under its new domains from its first render, before Root's
   * layout effect snaps the glide, so every path builds once per update.
   */
  readonly snapped: ScatterDomains | null;
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
 * The domains the marks and the axes draw under now: the model's own after an update that snaps
 * them, and otherwise the glide's, which move from the old domains to the new ones. The server and
 * a hydrating part read the model's own.
 *
 * @param context - The Root.
 * @returns The domains.
 */
export function useScatterDomains(context: ScatterRootContextValue): ScatterDomains {
  const { glide } = context;
  const drawn = useSyncExternalStore(glide.subscribe, glide.get, glide.get);
  return context.snapped ?? drawn;
}

/**
 * The frame a plot part draws in: Root's measured plot under the drawn domains, once Root opens its
 * draw gate. The server and a hydrating part read the gate closed, so their HTML matches.
 *
 * @param context - The Root.
 * @returns The frame, or null before the plot is measured and while the part hydrates.
 */
export function useScatterFrame(context: ScatterRootContextValue): ScatterFrame | null {
  const open = useDrawGateOpen(context.store.drawing);
  const measured = use(ScatterPlotContext);
  const plot = open ? measured : null;
  const { x, y } = useScatterDomains(context);
  return useMemo(() => (plot === null ? null : { box: plot.box, x, y }), [plot, x, y]);
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
  return seriesPaint(key, singleRole(config[key]?.color));
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

/**
 * The walk's place and series focus in the Root's current model, for the surface's render. It
 * subscribes to those two alone, since `carryWalk` carries them apart from the active point, so a
 * pointer that moves the active point renders no surface.
 *
 * @param context - The Root.
 * @returns The place and the focus in the Root's model.
 */
export function useWalkPlace(context: ScatterRootContextValue): Pick<WalkState, "place" | "focus"> {
  const { store, model } = context;
  const from = useScatterStore(store, (snapshot) => snapshot.model);
  const place = useScatterStore(store, (snapshot) => snapshot.place);
  const focus = useScatterStore(store, (snapshot) => snapshot.focus);
  return useMemo(() => {
    const walk = carryWalk(from, model, { active: null, place, dismissed: null, focus });
    return { place: walk.place, focus: walk.focus };
  }, [from, model, place, focus]);
}
