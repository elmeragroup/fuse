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
import { writeAttribute, writeStyle } from "./chart-dom";
import { openDrawingSoon, useClientMount } from "./chart-draw-gate";
import { useEntrance } from "./chart-entrance";
import { createChartFollowers } from "./chart-followers";
import type { ActiveSlot } from "./chart-followers";
import { StatusRegion } from "./chart-listbox";
import { BROWSER_FRAMES, createChartMotion } from "./chart-motion";
import type { ChartMotion } from "./chart-motion";
import { ChartOwnScope, useChartDepth } from "./chart-own-scope";
import { PolarContext } from "./chart-polar-context";
import type {
  PolarContextValue,
  PolarKernel,
  PolarModel,
  PolarPickAt,
  PolarUpdate,
} from "./chart-polar-context";
import { createPolarFollow } from "./chart-polar-follow";
import { introPace } from "./chart-polar-motion";
import { paintedOf } from "./chart-polar-painted";
import { PolarSurface } from "./chart-polar-surface";
import { ChartReadoutContext, ChartSelectionContext } from "./chart-readout-port";
import { leapSpring, stepSpring } from "./chart-spring";
import { createChartStore, useChartStore } from "./chart-store";
import type { ChartSnapshot, ChartStore } from "./chart-store";
import type { ChartChangeEventDetails, ChartFigureProps, ChartSelectionChangeReason } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { POLAR_STRINGS } from "./format/polar-strings";
import { issueKey } from "./layout/errors";
import type { ChartDataRule, ChartHintRule } from "./layout/errors";
import { CHART_SPRINGS } from "./layout/motion";
import { sweepBox } from "./layout/polar-angle";
import { entranceSpan } from "./layout/polar-motion";
import type { EntranceItems } from "./layout/polar-motion";
import { springEasing } from "./layout/spring";

/** The figure's slot per family, which the stylesheet and the density roles read. */
const SLOTS = {
  pie: { "data-slot": "pie-chart" },
  radial: { "data-slot": "radial-chart" },
  radar: { "data-slot": "radar-chart" },
  clock: { "data-slot": "clock-chart" },
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

/** The spring settle times a radar's grid entrance takes, sampled once. */
const ENTRANCE_SPRINGS = {
  grow: springEasing(CHART_SPRINGS.grow).duration,
  extend: springEasing(CHART_SPRINGS.extend).duration,
};

/** What an entrance's span counts: the slices, the rings, or a radar's series, rings and spokes. */
function entranceItems(model: PolarModel): EntranceItems {
  const { drawing } = model;
  if (drawing.kind !== "radar") return { family: model.family, items: model.count, rings: 0, spokes: 0 };
  return {
    family: "radar",
    items: drawing.radar.series.length,
    rings: drawing.radar.ticks.length,
    spokes: drawing.radar.count,
  };
}

/** The angle the follower turns to for the active option, or null while none is active. */
function rayAngle(model: PolarModel, active: ActiveSlot): number | null {
  return active === null ? null : (model.ray(active.slot, active.near)?.angle ?? null);
}

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
  // The active option's place, which a pie's slices pop and dim against with no React commit.
  writeStyle(figure, "--chart-active", active === null ? null : String(active.slot));
  // The near series' place, which a radar's series dim against and its nearest fill strengthens by.
  writeStyle(
    figure,
    "--chart-near",
    active === null || snapshot.near === null ? null : String(snapshot.near)
  );
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
  const depth = useChartDepth();
  return (
    <ChartOwnScope>
      <PolarContext value={context}>
        <PolarReadoutScope>
          <ChartSelectionContext value={selected}>
            <figure
              ref={figureRef}
              {...SLOTS[model.family]}
              data-polar=""
              data-chart-depth={depth}
              data-selected={selected === null ? undefined : ""}
              {...figureProps}>
              <p id={`${kernel.id}-description`} data-slot="chart-description">
                {props.description ?? model.description}
              </p>
              <p id={`${kernel.id}-instructions`} data-slot="chart-instructions">
                {model.instructions === "polar"
                  ? strings.instructionsPolar
                  : model.instructions === "clock"
                    ? POLAR_STRINGS[kernel.locale].instructionsClock
                    : strings.instructionsCartesian}
              </p>
              {/* The place of the selected series, which marks dim against, and the aspect every layer keeps. */}
              <div
                data-slot="chart-polar-frame"
                style={{
                  "--chart-selected": selected === null ? undefined : model.selectable.indexOf(selected),
                  "--chart-polar-aspect": `${String(width)} / ${String(height)}`,
                }}>
                <div ref={cellRef} data-slot="chart-polar-cell">
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
function usePolarRoot(props: PolarRootProps): PolarRootState {
  const { model, locale } = props;
  const { ref, ...figure } = props.figure;
  const figureProps = definedProps(figure);
  const name = props.figure["aria-label"];
  const id = useId();
  const [store] = useState(() => createChartStore(props.defaultActive));
  const [followers] = useState(createChartFollowers);
  const reduced = useReducedMotion();
  const entrance = figureProps["data-intro"] !== "none" && !reduced;
  const [motion] = useState(() => {
    const loop = createChartMotion(BROWSER_FRAMES, reduced, () => {
      followers.refresh();
    });
    // The marks place their entrance in their own layout effects, which run before the Root's
    // entrance effect holds the loop, so a Root that may have an entrance holds it from the start.
    // Otherwise a chart that mounts out of view plays its entrance unseen.
    if (entrance) loop.wait();
    return loop;
  });
  const [follow] = useState(() =>
    createPolarFollow({
      frames: BROWSER_FRAMES,
      reduced: () => motion.reduced(),
      spring: () => stepSpring(store),
      leapSpring,
      maxTurn: (radius) => maxTurn(radius, store),
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
  const [update, setUpdate] = useState<PolarUpdate>(() => ({ kind: "initial" }));
  if (seen !== model) {
    setSeen(model);
    setUpdate({ kind: "data" });
  }

  // The active option keeps its place across new data while it still exists, and leaves otherwise.
  const countRef = useRef(model.count);
  const latestModel = useRef(model);
  const paintedRef = useRef<readonly [number | null, number | null]>([null, null]);
  useLayoutEffect(() => {
    const cell = cellRef.current;
    if (cell === null) return undefined;
    const read = (): void => {
      const box = sweepBox(latestModel.current.sweep);
      const width = box.right - box.left;
      // CSS pixels per unit of the outer radius, measured as the cell resizes, never on a step.
      follow.measure(width > 0 ? cell.getBoundingClientRect().width / width : 0);
    };
    read();
    const sizes = new ResizeObserver(read);
    sizes.observe(cell);
    return () => {
      sizes.disconnect();
    };
  }, [follow]);

  useLayoutEffect(() => {
    countRef.current = model.count;
    latestModel.current = model;
    const snapshot = store.get();
    if (snapshot.active !== null && snapshot.active >= model.count) {
      store.set({ active: model.count === 0 ? null : model.count - 1 });
    }
    const active = activeOf(store.get(), model.count);
    if (rootRef.current) markActive(rootRef.current, store.get(), active);
    follow.retarget(rayAngle(model, active), "commit");
    followers.paint(active, "commit");
  }, [model, store, followers, follow]);
  useLayoutEffect(
    () =>
      store.subscribe(() => {
        const snapshot = store.get();
        const active = activeOf(snapshot, countRef.current);
        if (rootRef.current) markActive(rootRef.current, snapshot, active);
        const [was, near] = paintedRef.current;
        if (snapshot.active === was && snapshot.near === near) return;
        paintedRef.current = [snapshot.active, snapshot.near];
        follow.retarget(rayAngle(latestModel.current, active), "step");
        followers.paint(active, "step");
      }),
    [store, followers, follow]
  );

  useEntrance(store, motion, rootRef, cellRef, entrance);
  // While the entrance plays, the figure carries `data-entering`, so the centre's digits count up
  // over the entrance's span instead of rolling on their own spring. A grid or track the first
  // paint already showed never scales out again: only a chart the browser mounted with no server
  // HTML, or one that leaves its empty state, carries `data-grow` beside it, which the scale-outs
  // read.
  const items = useRef<EntranceItems>(entranceItems(model));
  const [served] = useState(() => !clientMount);
  const wasEmpty = useRef(model.empty);
  const marking = useRef<(grow: boolean) => void>(() => undefined);
  useLayoutEffect(() => {
    items.current = entranceItems(model);
  });
  // The entrance reads its pace once, keyed on the Root's first model.
  const [pacing] = useState<PolarUpdate>(() => ({ kind: "initial" }));
  useLayoutEffect(() => {
    if (!entrance) return undefined;
    let timer: number | null = null;
    const mark = (grow: boolean): void => {
      const figure = rootRef.current;
      if (figure === null) return;
      if (timer !== null) window.clearTimeout(timer);
      writeAttribute(figure, "data-entering", "");
      writeAttribute(figure, "data-grow", grow ? "" : null);
      // The figure's own pace, so a consumer's --chart-intro or --chart-stagger holds the state as long.
      const span = entranceSpan(items.current, ENTRANCE_SPRINGS, introPace(figure, pacing));
      timer = window.setTimeout(() => {
        timer = null;
        writeAttribute(figure, "data-entering", null);
        writeAttribute(figure, "data-grow", null);
      }, span);
    };
    marking.current = mark;
    let started = false;
    const watch = (): void => {
      if (started || store.get().phase !== "started") return;
      started = true;
      mark(!served);
    };
    watch();
    const stop = store.subscribe(watch);
    return () => {
      stop();
      marking.current = () => undefined;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [store, entrance, served, pacing]);
  // A chart that leaves its empty state grows its grid and tracks, as nothing painted them before.
  useLayoutEffect(() => {
    const before = wasEmpty.current;
    wasEmpty.current = model.empty;
    if (before && !model.empty && store.get().phase === "started") marking.current(true);
  }, [model.empty, store]);

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
    writeStyle(root, "--chart-highlight", index === -1 ? null : String(index));
  }, []);
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    modelRef.current = model;
  });
  const usePick = useCallback(() => polarPick(id, modelRef, motion), [id, motion]);
  const kernel = useMemo(
    (): PolarKernel => ({
      id,
      name,
      locale,
      root: getRoot,
      store,
      followers,
      follow,
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
      follow,
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
 * The most CSS pixels a mark on the dial may travel in one frame of a step, by the pointer's speed:
 * 8 at 200 px/s or slower, 20 at 800 and 48 at 2,000 or faster, straight between,
 * and the fastest for a keyboard step. Each is read at a tenth above its speed, since the speed the
 * Root reads from the pointer's events runs a few percent over its true speed. A step that reaches
 * far, such as a radar's spoke or a month of a year, glides no faster than the pointer moves it,
 * unless it would take longer than the follower's leap allows.
 */
const FRAME_TRAVEL = [
  [220, 8],
  [880, 20],
  [2200, 48],
] as const;

/** CSS pixels a frame may carry a mark at a pointer speed in CSS pixels per second. */
function frameTravel(speed: number): number {
  const [first, ...rest] = FRAME_TRAVEL;
  if (speed <= first[0]) return first[1];
  let previous: readonly [number, number] = first;
  for (const point of rest) {
    if (speed <= point[0]) {
      return previous[1] + ((point[1] - previous[1]) * (speed - previous[0])) / (point[0] - previous[0]);
    }
    previous = point;
  }
  return previous[1];
}

/** The most degrees the follower turns in a frame: a frame's travel at the outer radius. */
function maxTurn(radius: number, store: ChartStore): number {
  if (!(radius > 0)) return Number.POSITIVE_INFINITY;
  const keyboard = store.get().source === "keyboard";
  const speed = keyboard ? Number.POSITIVE_INFINITY : (store.pointer()?.speed ?? 0) * 1000;
  return (frameTravel(speed) / radius) * (180 / Math.PI);
}

/** The dead band round a pick's edge, in CSS pixels. */
const DEAD_BAND = 2;

/**
 * The pick over a polar cell: a client point maps through the listbox's client box, which spans the
 * cell and so the sweep's box, into units of the outer radius from the centre. A pointer that holds
 * an option keeps it while a point 2 CSS px along its arc or its radius still picks it, so a hand's
 * tremor near a dense dial's hole changes nothing. Within 2 CSS px of the centre a point has no
 * angle to read, so it picks nothing new and keeps the option the pointer holds.
 *
 * @param id - The Root's id prefix.
 * @param model - The latest model.
 * @param motion - The Root's loop, whose frame shares the angles it painted once it rests.
 * @returns The pick, null before the listbox mounts.
 */
function polarPick(id: string, model: { readonly current: PolarModel }, motion: ChartMotion): PolarPickAt {
  return (clientX, clientY, held) => {
    const surface = document.getElementById(`${id}-surface`);
    if (surface === null) return null;
    const rect = surface.getBoundingClientRect();
    const box = sweepBox(model.current.sweep);
    const width = box.right - box.left;
    if (!(rect.width > 0) || !(width > 0)) return null;
    const scale = rect.width / width;
    const point = { x: box.left + (clientX - rect.left) / scale, y: box.top + (clientY - rect.top) / scale };
    // While a mark tweens, an entrance's slices among them, the pick reads the model, as every
    // family's and the cartesian pick do, so a finger on a slice still sweeping in picks it. At rest
    // it reads the floored, seamed angles the frame painted (D24).
    const pixels = {
      scale,
      dpr: window.devicePixelRatio || 1,
      painted: motion.running() ? undefined : paintedOf(motion),
      near: held?.near ?? null,
      nearFirm: held?.firm ?? false,
    };
    const distance = Math.hypot(point.x, point.y);
    const reach = DEAD_BAND / scale;
    if (distance < reach) return held == null ? null : { slot: held.slot, near: held.near };
    const found = model.current.pick(point, pixels);
    if (held == null || found === null || found.slot === held.slot) return found;
    const radial = { x: point.x / distance, y: point.y / distance };
    const offsets = [
      { x: -radial.y, y: radial.x },
      { x: radial.y, y: -radial.x },
      radial,
      { x: -radial.x, y: -radial.y },
    ];
    for (const { x, y } of offsets) {
      const kept = model.current.pick({ x: point.x + x * reach, y: point.y + y * reach }, pixels);
      if (kept?.slot === held.slot) return kept;
    }
    return found;
  };
}

Object.assign(PolarRoot, { displayName: "PolarChart.Root" });
