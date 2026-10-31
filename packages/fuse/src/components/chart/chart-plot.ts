"use client";

/**
 * The measured plot. Root measures its plot box in a layout effect, before the first paint, and a
 * ResizeObserver follows the box from then on. Every mark reads the measurement through
 * `useChartFrame` and draws in CSS pixels. The server and a hydrating render measure nothing, so
 * they draw no marks, and the plot shows its skeleton until the browser measures it.
 */
import {
  createContext,
  createElement,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, RefObject } from "react";

import { flushSync } from "react-dom";

import { useChartRoot } from "./chart-context";
import type { ChartLayoutContextValue, PanelEntry } from "./chart-context";
import { subscribeNever } from "./chart-store";
import { plotFrame, sameSnapping } from "./layout/plot-frame";
import type { BarMetrics, PlotBox, PlotFrame } from "./layout/plot-frame";
import { sameItems } from "./layout/same-items";
import type { ValueDomain } from "./layout/value-domain";

/** The plot box and the bar spacing, as Root last measured them. */
export type ChartPlot = { readonly box: PlotBox; readonly metrics: BarMetrics };

/** The nearest measured plot, Root's or a Panel's, or null before the browser measures it. */
export const ChartPlotContext = createContext<ChartPlot | null>(null);

/** Root's own measured plot, which spans every Panel and gives each one its x frame. */
export const ChartRootPlotContext = createContext<ChartPlot | null>(null);

/** One custom property in CSS pixels or as a share. Registered properties compute to `px` or `%`. */
function lengthOf(style: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Read the bar spacing an element inherits, from `--chart-band-gap`, `--chart-bar-gap` and
 * `--chart-bar-seam` as Root, a BarGroup or the Bar itself sets them.
 *
 * @param element - The element whose computed style holds the spacing.
 * @param style - The element's computed style, when the caller has it already.
 * @returns The spacing in CSS pixels, the band gap as a share.
 */
function readBarMetrics(element: Element, style = getComputedStyle(element)): BarMetrics {
  return {
    bandGap: Math.min(1, lengthOf(style, "--chart-band-gap") / 100),
    barGap: lengthOf(style, "--chart-bar-gap"),
    seam: lengthOf(style, "--chart-bar-seam"),
  };
}

/**
 * Whether two spacings draw the same bars.
 *
 * @param a - One spacing.
 * @param b - The other.
 * @returns Whether every field matches.
 */
function sameMetrics(a: BarMetrics, b: BarMetrics): boolean {
  return a.bandGap === b.bandGap && a.barGap === b.barGap && a.seam === b.seam;
}

/** A plot's size in layout CSS pixels, which no transform scales. */
type LayoutSize = { readonly width: number; readonly height: number };

/**
 * How far a computed length may lie from the layout's own: the style serializes about three
 * decimals, so a layout size that differs by more is from an older layout.
 */
const SERIALIZED = 0.001;

/**
 * Read the plot box and the bar spacing from the plot element. Its size is the layout's, which a
 * transformed ancestor leaves alone, so SVG user units stay CSS pixels inside a scaled wrapper.
 * The ResizeObserver's content box holds the layout size in full precision, so a fractional plot,
 * such as one beside a value axis, keeps the size its HTML shares resolve against. Before the
 * observer reports, and while the layout has moved on since it last did, the computed size stands.
 */
function measureElement(element: HTMLElement, observed: LayoutSize | null): ChartPlot {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const computed = {
    width: Number.parseFloat(style.width) || rect.width,
    height: Number.parseFloat(style.height) || rect.height,
  };
  const current =
    observed !== null &&
    Math.abs(observed.width - computed.width) <= SERIALIZED &&
    Math.abs(observed.height - computed.height) <= SERIALIZED;
  const size = current ? observed : computed;
  return {
    box: {
      width: size.width,
      height: size.height,
      dpr: window.devicePixelRatio || 1,
      left: rect.left,
      top: rect.top,
    },
    metrics: readBarMetrics(element, style),
  };
}

/**
 * Whether two measurements draw the same marks. The marks snap to device pixels from the plot's
 * origin, so a scroll by whole device pixels keeps the old measurement and renders nothing.
 */
function samePlot(a: ChartPlot | null, b: ChartPlot): boolean {
  return a !== null && sameSnapping(a.box, b.box) && sameMetrics(a.metrics, b.metrics);
}

/** One measured plot element: the layout size the observer last reported, its last measurement and its setter. */
type PlotWatch = {
  readonly element: HTMLElement;
  observed: LayoutSize | null;
  last: ChartPlot | null;
  readonly apply: (plot: ChartPlot) => void;
};

/** Every mounted plot element, by element. */
const watches = new Map<Element, PlotWatch>();

/** The one observer every plot shares, created on the first plot's mount. */
let shared: ResizeObserver | null = null;

/**
 * Measure every plot first, then draw the changed ones in one commit, so no chart's commit makes
 * the next chart's read lay out.
 */
function drawAll(due: Iterable<PlotWatch>): void {
  const changed = [...due].flatMap((watch) => {
    const next = measureElement(watch.element, watch.observed);
    return samePlot(watch.last, next) ? [] : [{ watch, next }];
  });
  if (changed.length === 0) return;
  flushSync(() => {
    for (const { watch, next } of changed) {
      watch.last = next;
      watch.apply(next);
    }
  });
}

/**
 * Measure every plot an observer delivery names, then draw them all in one commit. The observer
 * delivers after layout and before paint, so every read is free and the charts draw in the frame
 * that resized or moved them. A page resize names every plot.
 */
function deliver(entries: readonly ResizeObserverEntry[]): void {
  const due = new Set<PlotWatch>();
  for (const entry of entries) {
    if (entry.target === document.documentElement) {
      for (const watch of watches.values()) due.add(watch);
      continue;
    }
    const watch = watches.get(entry.target);
    if (watch === undefined) continue;
    const [box] = entry.contentBoxSize;
    if (box !== undefined) watch.observed = { width: box.inlineSize, height: box.blockSize };
    due.add(watch);
  }
  drawAll(due);
}

/** The shared observer, which also follows the page's size, as browser zoom changes it. */
function plotObserver(): ResizeObserver {
  if (shared === null) {
    shared = new ResizeObserver(deliver);
    shared.observe(document.documentElement);
  }
  return shared;
}

/**
 * The reads the parts of one plot take in its probe phase, before any mark of the commit writes:
 * a computed style that inherits from Root, such as a Line's stroke width or a Bar's spacing.
 */
export type PlotReads = {
  /** Adds a read, which runs in every probe phase from the next commit on, and returns its removal. */
  readonly add: (read: () => void) => () => void;
};

/** The reads of the nearest measured plot, Root's or a Panel's. */
export const PlotReadsContext = createContext<PlotReads>({ add: () => () => undefined });

/**
 * Read a computed style in the probe phase of the nearest plot: once on mount, then in every commit
 * of the plot's owner, before any mark writes, so a change Root's class or style passes down reaches
 * the part. The probe has laid the commit out already, so the read lays out nothing more. The part
 * reads again in its own layout effect when its own inputs change, which can happen in a commit its
 * plot's owner sits out, and until a read finds its element: React attaches a part's refs after the
 * probe's effect, so a node the part first renders in a commit is the part's own to read.
 *
 * @param read - The read, which compares what it finds itself and renders its part only on a change.
 *   It returns whether it found its element.
 * @param inputs - What the part's own props set the style through, compared item by item.
 */
export function usePlotRead(read: () => boolean, inputs: readonly unknown[]): void {
  const reads = use(PlotReadsContext);
  const latest = useRef(read);
  const readFor = useRef(inputs);
  // Whether a read has found the part's element.
  const found = useRef(false);
  const probe = useRef(() => {
    found.current = latest.current() || found.current;
  });
  useLayoutEffect(() => {
    latest.current = read;
    if (found.current && sameItems(readFor.current, inputs)) return;
    readFor.current = inputs;
    found.current = read();
  });
  useLayoutEffect(() => reads.add(probe.current), [reads]);
}

/** A measured plot and the probe its owner renders first inside the plot element. */
export type MeasuredPlot = {
  /** The measurement, or null before the first one. */
  readonly plot: ChartPlot | null;
  /**
   * Render it as the plot element's first child. Its layout effect measures the plot in every
   * commit of its owner, before any mark of the commit runs its own, so the read lays out only what
   * React changed and no geometry the marks wrote.
   */
  readonly probe: ReactElement;
  /** The probe phase's reads, which the owner provides through `PlotReadsContext`. */
  readonly reads: PlotReads;
  /**
   * Measure the plot now, for an owner whose own layout effect sizes the plot after the probe ran,
   * as Root's span over its Panels does.
   */
  readonly measure: () => void;
};

/** Measures its owner's plot and runs the probe phase's reads in every commit that renders it. */
function PlotProbe({ probe }: { readonly probe: () => void }): null {
  useLayoutEffect(() => probe());
  return null;
}

/**
 * Measure Root's plot element. It measures in every commit of its owner, because new axis labels
 * can move the box without resizing it, through the probe the owner renders first in the plot. A
 * resize of the box or the page, as browser zoom does when it changes the device pixel ratio, and
 * the page's fonts loading go through the shared observer, which reads every plot of the page
 * after layout and draws the ones that changed in one commit, before paint. A Root measures first
 * in the commit that mounts it, hydration included, so the render right after that commit draws
 * its marks before the commit's task ends. A later task would update a Suspense boundary inside
 * the chart that has not hydrated yet, and React would render it again on the client. A move it
 * misses only shifts how a tie rounds, since every edge stays a whole number of device pixels from
 * the layer's origin.
 *
 * @param ref - The plot element.
 * @returns The measurement and the probe to render.
 */
export function useMeasuredPlot(ref: RefObject<HTMLElement | null>): MeasuredPlot {
  const [plot, setPlot] = useState<ChartPlot | null>(null);
  const [owner] = useState(() => plotOwner(setPlot));
  useLayoutEffect(() => owner.mount(ref.current), [owner, ref]);
  return {
    plot,
    probe: createElement(PlotProbe, { probe: owner.probe }),
    reads: owner.reads,
    measure: owner.measure,
  };
}

/**
 * The measurement one plot owner keeps between commits: the watch the shared observer reads, the
 * measure and the reads its probe runs.
 *
 * @param apply - Sets the owner's measurement.
 */
function plotOwner(apply: (plot: ChartPlot) => void) {
  let watch: PlotWatch | null = null;
  const added = new Set<() => void>();
  const reads: PlotReads = {
    add(read) {
      added.add(read);
      return () => {
        added.delete(read);
      };
    },
  };
  const measure = (): void => {
    const own = watch;
    if (own === null) return;
    const next = measureElement(own.element, own.observed);
    if (samePlot(own.last, next)) return;
    own.last = next;
    apply(next);
  };
  const probe = (): void => {
    measure();
    for (const read of added) read();
  };
  const mount = (element: HTMLElement | null): (() => void) | undefined => {
    if (element === null) return undefined;
    const own: PlotWatch = { element, observed: null, last: null, apply };
    watch = own;
    watches.set(element, own);
    const observer = plotObserver();
    observer.observe(element);
    // The owner measures in the commit that mounts it, hydration included. The probe ran before
    // this effect, when no watch existed yet.
    measure();
    // A web font that loads after the first paint moves the text above the plot, and the plot with
    // it, without resizing anything.
    let live = true;
    void document.fonts.ready.then(() => {
      if (!live) return;
      observer.unobserve(element);
      observer.observe(element);
    });
    return () => {
      live = false;
      watches.delete(element);
      observer.unobserve(element);
      watch = null;
    };
  };
  return { measure, probe, reads, mount };
}

/**
 * Keep the span of the Panels' plots on Root's frame, from the highest plot's top to the lowest
 * plot's bottom, as `--chart-panels-top` and `--chart-panels-height` in the frame's layout pixels
 * from its padding edge. Root's plot, its surface and the empty state lie over that span, out of
 * the grid's rows, so any number of Panels stack in the frame's rows. CSS grid cannot name that
 * span: the Panel rows are auto-placed after the optional rows above them, and their count is
 * open. The plots' current positions decide the span, whatever order the Panels registered in, and
 * an ancestor's transform is divided out by a plot's drawn height over its layout height. It runs
 * after every commit of Root and whenever the frame, a Panel or a Panel's plot resizes, as a slot
 * label row in one Panel moves the plots below it without resizing them. A move that changes no
 * size, such as keyed Panels a child reorders without rendering Root, reaches it through the
 * returned function, which each Panel calls after its own commits and the surface calls when a
 * pointer enters it.
 *
 * @param frame - Root's frame element.
 * @param panels - The mounted Panels.
 * @returns A stable function that places the span from the plots' current positions.
 */
export function usePanelSpan(
  frame: RefObject<HTMLElement | null>,
  panels: readonly PanelEntry[]
): () => void {
  const place = useRef<() => void>(() => undefined);
  useLayoutEffect(() => {
    place.current = () => {
      const element = frame.current;
      if (element === null) return;
      const plots = panels.flatMap(({ plot }) => {
        const node = plot();
        return node === null ? [] : [node];
      });
      const [first] = plots;
      if (first === undefined) {
        element.style.removeProperty("--chart-panels-top");
        element.style.removeProperty("--chart-panels-height");
        return;
      }
      const rects = plots.map((node) => node.getBoundingClientRect());
      const drawn = rects[0]?.height ?? 0;
      const laid = Number.parseFloat(getComputedStyle(first).height);
      const scale = drawn > 0 && laid > 0 ? drawn / laid : 1;
      const top = Math.min(...rects.map((rect) => rect.top));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      // The containing block is the frame's padding box, inside its top border.
      const origin = element.getBoundingClientRect().top + element.clientTop * scale;
      element.style.setProperty("--chart-panels-top", `${String((top - origin) / scale)}px`);
      element.style.setProperty("--chart-panels-height", `${String((bottom - top) / scale)}px`);
    };
    place.current();
  });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => place.current());
    const element = frame.current;
    if (element !== null) observer.observe(element);
    for (const { plot } of panels) {
      const node = plot();
      if (node === null) continue;
      observer.observe(node);
      // The Panel holds the plot and the rows around it, such as its slot label row.
      if (node.parentElement !== null) observer.observe(node.parentElement);
    }
    return () => {
      observer.disconnect();
    };
  }, [frame, panels]);
  return useCallback(() => place.current(), []);
}

/**
 * Measure a Panel's plot element and draw it in Root's x frame. Every Panel's plot lies in Root's
 * plot column, so each takes Root's left edge, width and pixel ratio, and every Panel snaps a
 * slot's edges, the crosshair and the active column to the same device pixels. The Panel's own
 * top and height give its value axis.
 *
 * @param ref - The Panel's plot element.
 * @returns The Panel's plot, or null until both Root and the Panel are measured, and the probe to render.
 */
export function usePanelPlot(
  ref: RefObject<HTMLElement | null>
): Pick<MeasuredPlot, "plot" | "probe" | "reads"> {
  const root = use(ChartRootPlotContext);
  const { plot: own, probe, reads } = useMeasuredPlot(ref);
  const plot = useMemo(
    () =>
      root === null || own === null
        ? null
        : {
            box: { ...own.box, left: root.box.left, width: root.box.width, dpr: root.box.dpr },
            metrics: own.metrics,
          },
    [root, own]
  );
  return { plot, probe, reads };
}

/**
 * The bar spacing an element inherits, read in the plot's probe phase, before any mark writes, and
 * when the owner's own class or style changes. Spacing that Root or an ancestor sets reaches a group
 * whose own props never change. A BarGroup reads its own element for all of its bars, and a Bar
 * outside a group reads its own.
 *
 * @param ref - The owner's element, or null when another part owns the spacing.
 * @param inputs - The owner's class and steady style, which can set the spacing too.
 * @returns The spacing, or null before the first read.
 */
export function useBarMetrics(
  ref: RefObject<Element | null> | null,
  inputs: readonly unknown[]
): BarMetrics | null {
  const [metrics, setMetrics] = useState<BarMetrics | null>(null);
  // The last read, so unchanged spacing schedules no render at all.
  const last = useRef<BarMetrics | null>(null);
  usePlotRead(() => {
    const element = ref?.current ?? null;
    if (element === null) return false;
    const next = readBarMetrics(element);
    if (last.current === null || !sameMetrics(last.current, next)) {
      last.current = next;
      setMetrics(next);
    }
    return true;
  }, inputs);
  return metrics;
}

/** The nearest layout drawn into the measured plot. */
export type ChartFrame = {
  readonly frame: PlotFrame;
  /** The spacing the plot element inherits, which plot-wide parts such as the tooltip read. */
  readonly metrics: BarMetrics;
  readonly plot: ChartPlot;
};

/**
 * The frame a plot part draws in: the nearest measured plot, Root's or its Panel's, under the
 * nearest layout's value domain. A mark that hydrates server HTML draws nothing in its hydration
 * pass, as the server drew nothing, and draws in the render React runs right after, so a Suspense
 * boundary that hydrates after Root has measured matches its server HTML too.
 *
 * @param part - The calling part's display name.
 * @param layout - The part's layout, as `usePlotLayout` gave it, which registers the part once.
 * @returns The frame, or null before the plot is measured and while the part hydrates.
 */
export function useChartFrame(part: string, layout: ChartLayoutContextValue): ChartFrame | null {
  return useFrameOf(part, use(ChartPlotContext), layout.y);
}

/**
 * The frame of Root's whole plot, which spans every Panel, for Root's surface and the tooltip. Only
 * its slot axis is a layout's, so these parts read it under any number of Panels.
 *
 * @param part - The calling part's display name.
 * @returns The frame, or null before Root measures its plot and while the part hydrates.
 */
export function useRootFrame(part: string): ChartFrame | null {
  const { model } = useChartRoot(part);
  return useFrameOf(part, use(ChartRootPlotContext), model.y);
}

/** A measured plot under a value domain, once hydrated. */
function useFrameOf(part: string, measured: ChartPlot | null, y: ValueDomain): ChartFrame | null {
  const { model, orientation } = useChartRoot(part);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const plot = hydrated ? measured : null;
  const window = model.window;
  const count = window === null ? 1 : window.last - window.first + 1;
  return useMemo(
    () =>
      plot === null
        ? null
        : { frame: plotFrame(plot.box, orientation, count, y.domain), metrics: plot.metrics, plot },
    [plot, orientation, count, y.domain]
  );
}
