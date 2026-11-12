"use client";

/**
 * The lifecycle every polar figure shares, whatever it draws: the store, the motion loop and its
 * entrance, the commit each mark reaches, whether React Activity hides the figure, and the marks the
 * entrance leaves on the figure. The polar Root, with its listbox, and the gauge's Root, with its
 * meter, both run on it, so an entrance, Activity or hydration rule holds in every polar family.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Ref, RefObject } from "react";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { writeAttribute } from "./chart-dom";
import { useClientMount } from "./chart-draw-gate";
import { useEntrance } from "./chart-entrance";
import { BROWSER_FRAMES, createChartMotion } from "./chart-motion";
import type { ChartMotion } from "./chart-motion";
import type { PolarUpdate } from "./chart-polar-context";
import { introPace } from "./chart-polar-motion";
import type { PolarCommitSource } from "./chart-polar-motion";
import { createChartStore } from "./chart-store";
import type { ChartStore } from "./chart-store";
import type { IntroPace, PolarIntro } from "./layout/polar-motion";

/** What a polar figure's lifecycle reads from its Root. */
export type PolarLifecycleInput = {
  /** The family whose entrance paces the marks. */
  readonly family: PolarIntro;
  /** What the Root draws. A new value is new data, which moves the marks. */
  readonly data: unknown;
  /** Whether the figure asks for an entrance: its `data-intro` is not "none". */
  readonly intro: boolean;
  /** The figure's own ref. */
  readonly ref: Ref<HTMLElement> | undefined;
  /** The option active before any pointer or key moves, or null. */
  readonly defaultActive: number | null;
  /**
   * How long the entrance runs from its start until its last item rests, in milliseconds, at the
   * figure's pace. The latest is read as the entrance starts.
   */
  readonly span: (pace: IntroPace) => number;
  /** Called after each frame a mark leaves in, and when reduced motion changes. */
  readonly refresh?: () => void;
};

/** A polar figure's lifecycle. */
export type PolarLifecycle = {
  readonly store: ChartStore;
  readonly motion: ChartMotion;
  /** Whether the figure plays an entrance: it asks for one and the reader allows motion. */
  readonly entrance: boolean;
  /** Whether the figure mounted in the browser, with no server HTML before it. */
  readonly clientMount: boolean;
  /** The figure, once it mounts. */
  readonly rootRef: RefObject<HTMLElement | null>;
  /** The ref the figure takes: the Root's own and the consumer's. */
  readonly figureRef: Ref<HTMLElement>;
  /** The aspect-locked cell, which the entrance watches come into view. */
  readonly cellRef: RefObject<HTMLDivElement | null>;
  /** Whether React Activity hides the figure, as its effects are torn down. */
  readonly hidden: () => boolean;
  /** The figure, or null before it mounts. */
  readonly root: () => HTMLElement | null;
  /** What the figure's marks read to reach each commit. */
  readonly commit: PolarCommitSource;
  /**
   * Mark the entrance again with its tracks and grids growing, as nothing painted them before, for a
   * chart that leaves its empty state once its entrance has started.
   */
  readonly grow: () => void;
};

/**
 * Run a polar figure's lifecycle. The figure carries `data-drawn` once its entrance starts, which
 * shows the marks, and `data-entering` for the entrance's span, so the centre's digits count up
 * with the sweep. A figure the browser mounted with no server HTML also carries `data-grow`, which
 * scales its tracks and grids out: what the first paint showed never scales out again.
 *
 * @param input - The family, the data, the figure's intro and ref, and the entrance's span.
 * @returns The lifecycle.
 */
export function usePolarLifecycle(input: PolarLifecycleInput): PolarLifecycle {
  const { family, data, intro, refresh } = input;
  const reduced = useReducedMotion();
  const entrance = intro && !reduced;
  const [store] = useState(() => createChartStore(input.defaultActive));
  const [motion] = useState(() => {
    const loop = createChartMotion(BROWSER_FRAMES, reduced, refresh);
    // The marks place their entrance in their own layout effects, which run before the Root's
    // entrance effect holds the loop, so a Root that may have an entrance holds it from the start.
    // Otherwise a chart that mounts out of view plays its entrance unseen.
    if (entrance) loop.wait();
    return loop;
  });
  const rootRef = useRef<HTMLElement>(null);
  const figureRef = useMergedRefs(rootRef, input.ref);
  const cellRef = useRef<HTMLDivElement>(null);
  const clientMount = useClientMount();
  const [served] = useState(() => !clientMount);

  useLayoutEffect(() => {
    motion.setReduced(reduced);
    refresh?.();
  }, [motion, reduced, refresh]);

  // Which commit produced the data: the first render, or new data, which moves the marks.
  const [seen, setSeen] = useState(data);
  const [update, setUpdate] = useState<PolarUpdate>(() => ({ kind: "initial" }));
  if (seen !== data) {
    setSeen(data);
    setUpdate({ kind: "data" });
  }

  useEntrance(store, motion, rootRef, cellRef, entrance);
  const span = useRef(input.span);
  useLayoutEffect(() => {
    span.current = input.span;
  });
  // The entrance reads its pace once, keyed on the Root's first commit.
  const [pacing] = useState<PolarUpdate>(() => ({ kind: "initial" }));
  const marking = useRef<(grow: boolean) => void>(() => undefined);
  useLayoutEffect(() => {
    const figure = rootRef.current;
    if (figure === null) return undefined;
    let timer: number | null = null;
    const clear = (): void => {
      timer = null;
      writeAttribute(figure, "data-entering", null);
      writeAttribute(figure, "data-grow", null);
    };
    const mark = (grow: boolean): void => {
      if (!entrance) return;
      if (timer !== null) window.clearTimeout(timer);
      writeAttribute(figure, "data-entering", "");
      writeAttribute(figure, "data-grow", grow ? "" : null);
      // The figure's own pace, so a consumer's --chart-intro or --chart-stagger holds the state as long.
      timer = window.setTimeout(clear, span.current(introPace(figure, pacing)));
    };
    marking.current = mark;
    // Only the entrance's own start marks it. An entrance already spent when the effect runs, as
    // when React Activity shows the chart again or the entrance is turned back on, marks nothing.
    let started = store.get().phase === "started";
    const watch = (): void => {
      const phase = store.get().phase;
      writeAttribute(figure, "data-drawn", phase === "started" ? "" : null);
      if (started || phase !== "started") return;
      started = true;
      mark(!served);
    };
    watch();
    const stop = store.subscribe(watch);
    return () => {
      stop();
      marking.current = () => undefined;
      if (timer === null) return;
      window.clearTimeout(timer);
      // An entrance cut short, as React Activity hides it, never marks again, so its state leaves now.
      clear();
    };
  }, [store, entrance, served, pacing]);
  const grow = useCallback(() => {
    marking.current(true);
  }, []);

  // Whether the Root's effects are torn down, as React Activity leaves them while it hides the
  // chart, which a mark's commit reads to tell a show from its first mount.
  const hiddenRef = useRef(false);
  useLayoutEffect(() => {
    hiddenRef.current = false;
    return () => {
      hiddenRef.current = true;
    };
  }, []);
  const hidden = useCallback((): boolean => hiddenRef.current, []);
  const root = useCallback((): HTMLElement | null => rootRef.current, []);
  const commit = useMemo(
    (): PolarCommitSource => ({ update, entrance, family, store, hidden, root }),
    [update, entrance, family, store, hidden, root]
  );
  return {
    store,
    motion,
    entrance,
    clientMount,
    rootRef,
    figureRef,
    cellRef,
    hidden,
    root,
    commit,
    grow,
  };
}
