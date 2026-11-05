"use client";

/**
 * The polar Root kernel: what PieChart, RadialChart and RadarChart share under their own model.
 * It owns the store, the follower registry, the motion loop and its entrance, the selection, the
 * highlight and the warnings, and renders the figure: the description, the instructions, the
 * aspect-locked cell with its listbox, the parts and the status region, in CONTRACT section 9.2's
 * order. A family hands it a `PolarModel`, which carries the family's geometry, words, pick, table
 * and readout, so the kernel never reads a family's data.
 *
 * First paint (D18): with JavaScript on, every polar mark stays hidden behind the tracks and grid
 * until the chart comes into view and its entrance starts, which writes `data-drawn` on the
 * figure. With JavaScript off, and in print, the stylesheet shows the full chart.
 */
import { use, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode, Ref } from "react";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { definedProps } from "../../internal/defined-props";
import type { SupportedLocale } from "../../intl/locale-context";
import { writeAttribute } from "./chart-dom";
import { openDrawingSoon, useClientMount } from "./chart-draw-gate";
import { useEntrance } from "./chart-entrance";
import { createChartFollowers } from "./chart-followers";
import type { ActiveSlot } from "./chart-followers";
import { StatusRegion } from "./chart-listbox";
import { BROWSER_FRAMES, createChartMotion } from "./chart-motion";
import type { ChartMotion } from "./chart-motion";
import { ChartOwnScope } from "./chart-own-scope";
import { PolarContext } from "./chart-polar-context";
import type { PolarContextValue, PolarKernel, PolarModel, PolarUpdate } from "./chart-polar-context";
import { PolarSurface } from "./chart-polar-surface";
import { ChartReadoutContext, ChartSelectionContext } from "./chart-readout-port";
import type { PointerSlot } from "./chart-readout-port";
import { createChartStore, useChartStore } from "./chart-store";
import type { ChartSnapshot, ChartStore } from "./chart-store";
import type { ChartChangeEventDetails, ChartFigureProps, ChartSelectionChangeReason } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { issueKey } from "./layout/errors";
import type { ChartDataRule, ChartHintRule } from "./layout/errors";
import { sweepBox } from "./layout/polar-angle";

/** The figure's slot per family, which the stylesheet and the density roles read. */
const SLOTS = {
  pie: { "data-slot": "pie-chart" },
  radial: { "data-slot": "radial-chart" },
  radar: { "data-slot": "radar-chart" },
} as const;

/** The props every polar Root takes beside its data. */
export type PolarRootProps = {
  readonly model: PolarModel;
  /** The figure's own props: its name, `data-intro`, class, style, ref and the rest. */
  readonly figure: ChartFigureProps & {
    readonly "aria-label"?: string;
    readonly "aria-labelledby"?: string;
    readonly "data-intro"?: "none";
  };
  /** The option active before any pointer or key moves, or null. */
  readonly defaultActive: number | null;
  readonly selectedKey: string | null | undefined;
  readonly defaultSelectedKey: string | null | undefined;
  readonly onSelectedKeyChange:
    | ((key: string | null, details: ChartChangeEventDetails<ChartSelectionChangeReason>) => void)
    | undefined;
  /** The label a selection announces for a config key. */
  readonly labelOf: (key: string) => string;
  /** A consumer's `description`, which replaces the generated one verbatim. */
  readonly description: string | undefined;
  readonly locale: SupportedLocale;
  readonly children: ReactNode;
};

/** The active option and series, or null while nothing is active. */
function activeOf(snapshot: ChartSnapshot, count: number): ActiveSlot {
  const { active, near } = snapshot;
  if (active === null || active < 0 || active >= count) return null;
  return { slot: active, near };
}

/** Write the active state onto the figure, where the dim rules read it. */
function markActive(figure: HTMLElement, snapshot: ChartSnapshot, active: ActiveSlot): void {
  writeAttribute(figure, "data-active", active === null ? null : (snapshot.source ?? ""));
  writeAttribute(figure, "data-pinned", snapshot.pinned && active !== null ? "" : null);
  writeAttribute(figure, "data-near", active !== null && snapshot.near !== null ? snapshot.near : null);
  writeAttribute(figure, "data-drawn", snapshot.phase === "started" ? "" : null);
}

/**
 * The Root every polar family renders through, as `usePolarRoot` wires it. It never inspects its
 * children.
 *
 * @param props - The family's model, the figure's props, the selection props and the parts.
 * @returns The figure.
 */
export function PolarRoot(props: PolarRootProps): ReactElement {
  const { model, kernel, motion, entrance, update, figureRef, cellRef, selected, strings, figureProps } =
    usePolarRoot(props);
  const box = useMemo(() => sweepBox(model.sweep), [model.sweep]);
  const labelledBy = props.figure["aria-labelledby"];
  const context = useMemo(
    (): PolarContextValue => ({ model, kernel, motion, box, update, entrance, labelledBy }),
    [model, kernel, motion, box, update, entrance, labelledBy]
  );
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  return (
    <ChartOwnScope>
      <PolarContext value={context}>
        <PolarReadoutScope>
          <ChartSelectionContext value={selected}>
            <figure
              ref={figureRef}
              {...SLOTS[model.family]}
              data-polar=""
              data-selected={selected === null ? undefined : ""}
              {...figureProps}>
              <p id={`${kernel.id}-description`} data-slot="chart-description">
                {props.description ?? model.description}
              </p>
              <p id={`${kernel.id}-instructions`} data-slot="chart-instructions">
                {model.instructions === "polar" ? strings.instructionsPolar : strings.instructionsCartesian}
              </p>
              {/* The selected series' place, which every mark and part in the frame dims against. */}
              <div
                data-slot="chart-polar-frame"
                style={{
                  "--chart-selected": selected === null ? undefined : model.selectable.indexOf(selected),
                }}>
                <div
                  ref={cellRef}
                  data-slot="chart-polar-cell"
                  style={{ "--chart-polar-aspect": `${String(width)} / ${String(height)}` }}>
                  <svg
                    data-slot="chart-polar-plot"
                    aria-hidden="true"
                    focusable="false"
                    viewBox={`${String(box.left)} ${String(box.top)} ${String(width)} ${String(height)}`}
                  />
                  <PolarSurface />
                </div>
                {props.children}
              </div>
              <PolarStatus store={kernel.store} />
            </figure>
          </ChartSelectionContext>
        </PolarReadoutScope>
      </PolarContext>
    </ChartOwnScope>
  );
}

/** The Root's status region, which announces what the store says. */
function PolarStatus({ store }: { readonly store: ChartStore }): ReactElement {
  const text = useChartStore(store, (snapshot) => snapshot.announcement.text);
  const count = useChartStore(store, (snapshot) => snapshot.announcement.count);
  return <StatusRegion text={text} count={count} />;
}

/**
 * Provide the family's readout, which the shared parts read the Root through. It changes with the
 * model alone, so a pointer move renders no part that reads only the readout.
 */
function PolarReadoutScope({ children }: { readonly children: ReactNode }): ReactElement {
  const polar = use(PolarContext);
  const model = polar?.model;
  const kernel = polar?.kernel;
  const readout = useMemo(
    () => (model === undefined || kernel === undefined ? null : model.readout(kernel)),
    [model, kernel]
  );
  return <ChartReadoutContext value={readout}>{children}</ChartReadoutContext>;
}

/** What `usePolarRoot` gives the Root it wires. */
type PolarRootState = {
  readonly model: PolarModel;
  readonly kernel: PolarKernel;
  readonly motion: ChartMotion;
  readonly entrance: boolean;
  readonly update: PolarUpdate;
  readonly figureRef: Ref<HTMLElement>;
  readonly cellRef: { current: HTMLDivElement | null };
  readonly selected: string | null;
  readonly strings: (typeof CHART_STRINGS)[SupportedLocale];
  readonly figureProps: Omit<ChartFigureProps, "ref">;
};

/**
 * Wire a polar Root: its store, followers, loop, entrance, selection, highlight and warnings, and
 * the kernel its family's readout closes over.
 *
 * @param props - The Root's props.
 * @returns What the Root renders with.
 */
export function usePolarRoot(props: PolarRootProps): PolarRootState {
  const { model, locale } = props;
  const { ref, ...figure } = props.figure;
  const figureProps = definedProps(figure);
  const name = props.figure["aria-label"];
  const id = useId();
  const [store] = useState(() => createChartStore(props.defaultActive));
  const [followers] = useState(createChartFollowers);
  const reduced = useReducedMotion();
  const [motion] = useState(() =>
    createChartMotion(BROWSER_FRAMES, reduced, () => {
      followers.refresh();
    })
  );
  const rootRef = useRef<HTMLElement>(null);
  const figureRef = useMergedRefs(rootRef, ref);
  const cellRef = useRef<HTMLDivElement>(null);
  const strings = CHART_STRINGS[locale];

  // A browser mount draws in the render right after its first commit, and a hydrating Root in a
  // microtask after its hydration commit, so its marks render once before the browser paints.
  const clientMount = useClientMount();
  useLayoutEffect(() => {
    if (clientMount) store.drawing.openNow();
    else openDrawingSoon(store.drawing);
  }, [store, clientMount]);
  useLayoutEffect(() => {
    motion.setReduced(reduced);
    followers.refresh();
  }, [motion, reduced, followers]);

  // Which commit produced the model: the first render, or new data, which moves the marks.
  const [seen, setSeen] = useState(model);
  const [update, setUpdate] = useState<PolarUpdate>(() => ({ kind: "initial", keys: model.keys }));
  if (seen !== model) {
    setSeen(model);
    setUpdate({ kind: "data", keys: model.keys });
  }

  // The active option keeps its place across new data while it still exists, and leaves otherwise.
  const countRef = useRef(model.count);
  const paintedRef = useRef<readonly [number | null, number | null]>([null, null]);
  useLayoutEffect(() => {
    countRef.current = model.count;
    const snapshot = store.get();
    if (snapshot.active !== null && snapshot.active >= model.count) {
      store.set({ active: model.count === 0 ? null : model.count - 1 });
    }
    const active = activeOf(store.get(), model.count);
    if (rootRef.current) markActive(rootRef.current, store.get(), active);
    followers.paint(active, "commit");
  }, [model, store, followers]);
  useLayoutEffect(
    () =>
      store.subscribe(() => {
        const snapshot = store.get();
        const active = activeOf(snapshot, countRef.current);
        if (rootRef.current) markActive(rootRef.current, snapshot, active);
        const [was, near] = paintedRef.current;
        if (snapshot.active === was && snapshot.near === near) return;
        paintedRef.current = [snapshot.active, snapshot.near];
        followers.paint(active, "step");
      }),
    [store, followers]
  );

  const entrance = figureProps["data-intro"] !== "none" && !reduced;
  useEntrance(store, motion, rootRef, cellRef, entrance);

  const warned = useRef(new Set<string>());
  const warnOnce = useCallback(
    (rule: ChartDataRule | ChartHintRule, subject: string, message: string): void => {
      const key = issueKey(rule, subject);
      if (warned.current.has(key)) return;
      warned.current.add(key);
      console.warn(message);
    },
    []
  );

  useEffect(() => {
    for (const { rule, subject, message } of model.issues) warnOnce(rule, subject, message);
  }, [model.issues, warnOnce]);

  const [ownSelected, setOwnSelected] = useState<string | null>(props.defaultSelectedKey ?? null);
  const requested = props.selectedKey === undefined ? ownSelected : props.selectedKey;
  // A key that names no selectable key acts as null, and Root calls no callback for it.
  const selected = requested !== null && model.selectable.includes(requested) ? requested : null;
  const selection = useRef({
    selected,
    onSelectedKeyChange: props.onSelectedKeyChange,
    labelOf: props.labelOf,
    locale,
  });
  useLayoutEffect(() => {
    selection.current = {
      selected,
      onSelectedKeyChange: props.onSelectedKeyChange,
      labelOf: props.labelOf,
      locale,
    };
  });
  const select = useCallback(
    (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined): void => {
      const latest = selection.current;
      if (key === latest.selected) return;
      setOwnSelected(key);
      latest.onSelectedKeyChange?.(key, { reason, event });
      const words = CHART_STRINGS[latest.locale];
      store.announce(key === null ? words.selectionCleared : words.selected(latest.labelOf(key)));
    },
    [store]
  );
  const toggleGroups = useRef(0);
  const registerToggleGroup = useCallback((): (() => void) => {
    toggleGroups.current += 1;
    return () => {
      toggleGroups.current -= 1;
    };
  }, []);
  const hasToggles = useCallback((): boolean => toggleGroups.current > 0, []);
  const getRoot = useCallback((): HTMLElement | null => rootRef.current, []);
  const keysRef = useRef(model.selectable);
  useLayoutEffect(() => {
    keysRef.current = model.selectable;
  });
  const highlight = useCallback((key: string | null): void => {
    const root = rootRef.current;
    if (root === null) return;
    const index = key === null ? -1 : keysRef.current.indexOf(key);
    writeAttribute(root, "data-highlight", index === -1 ? null : "");
    root.style.setProperty("--chart-highlight", index === -1 ? "" : String(index));
  }, []);
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    modelRef.current = model;
  });
  const usePick = useCallback(() => polarPick(id, modelRef), [id]);
  const kernel = useMemo(
    (): PolarKernel => ({
      id,
      name,
      locale,
      root: getRoot,
      store,
      followers,
      select,
      registerToggleGroup,
      hasToggles,
      highlight,
      warnOnce,
      usePick,
    }),
    [
      id,
      name,
      locale,
      getRoot,
      store,
      followers,
      select,
      registerToggleGroup,
      hasToggles,
      highlight,
      warnOnce,
      usePick,
    ]
  );
  return {
    model,
    kernel,
    motion,
    entrance,
    update,
    figureRef,
    cellRef,
    selected,
    strings,
    figureProps,
  };
}

/**
 * The pick over a polar cell: a client point maps through the listbox's client box, which spans the
 * cell and so the sweep's box, into units of the outer radius from the centre.
 *
 * @param id - The Root's id prefix.
 * @param model - The latest model.
 * @returns The pick, null before the listbox mounts.
 */
function polarPick(
  id: string,
  model: { readonly current: PolarModel }
): (clientX: number, clientY: number) => PointerSlot | null {
  return (clientX, clientY) => {
    const surface = document.getElementById(`${id}-surface`);
    if (surface === null) return null;
    const rect = surface.getBoundingClientRect();
    const box = sweepBox(model.current.sweep);
    const width = box.right - box.left;
    if (!(rect.width > 0) || !(width > 0)) return null;
    const scale = rect.width / width;
    const point = { x: box.left + (clientX - rect.left) / scale, y: box.top + (clientY - rect.top) / scale };
    return model.current.pick(point, { scale, dpr: window.devicePixelRatio || 1 });
  };
}

Object.assign(PolarRoot, { displayName: "PolarChart.Root" });
