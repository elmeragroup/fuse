"use client";

/**
 * The measured plot. Root measures its plot box in a layout effect, before the first paint, and a
 * ResizeObserver follows the box from then on. Every mark reads the measurement through
 * `useChartFrame` and draws in CSS pixels. The server and a hydrating render measure nothing, so
 * they draw no marks, and the plot shows its skeleton until the browser measures it.
 */
import { createContext, use, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

import { useChartLayout, useChartRoot } from "./chart-context";
import { plotFrame } from "./layout/plot-frame";
import type { BarMetrics, PlotBox, PlotFrame } from "./layout/plot-frame";

/** The plot box and the bar spacing, as Root last measured them. */
export type ChartPlot = { readonly box: PlotBox; readonly metrics: BarMetrics };

/** Root's measured plot, or null before the browser measures it. */
export const ChartPlotContext = createContext<ChartPlot | null>(null);

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
 * @returns The spacing in CSS pixels, the band gap as a share.
 */
function readBarMetrics(element: Element): BarMetrics {
  const style = getComputedStyle(element);
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

/** Read the plot box and the bar spacing from the plot element. */
function measure(element: HTMLElement): ChartPlot {
  // The computed size is the layout size, which a transformed ancestor leaves alone, so SVG user
  // units stay CSS pixels inside a scaled wrapper too.
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return {
    box: {
      width: Number.parseFloat(style.width) || rect.width,
      height: Number.parseFloat(style.height) || rect.height,
      dpr: window.devicePixelRatio || 1,
      left: rect.left,
      top: rect.top,
    },
    metrics: readBarMetrics(element),
  };
}

/** Whether two measurements draw the same marks. */
function samePlot(a: ChartPlot | null, b: ChartPlot): boolean {
  if (a === null) return false;
  const keys = ["width", "height", "dpr", "left", "top"] as const;
  return keys.every((key) => a.box[key] === b.box[key]) && sameMetrics(a.metrics, b.metrics);
}

/**
 * Measure Root's plot element. It measures after every Root commit, because new axis labels can
 * move the box without resizing it, again when the box or the page resizes, as browser zoom does
 * when it changes the device pixel ratio, and once the page's fonts have loaded. A move it misses only shifts how a tie rounds,
 * since every edge stays a whole number of device pixels from the layer's origin.
 *
 * @param ref - The plot element.
 * @returns The measurement, or null before the first one.
 */
export function useMeasuredPlot(ref: RefObject<HTMLElement | null>): ChartPlot | null {
  const [plot, setPlot] = useState<ChartPlot | null>(null);
  // The last measurement, so an unchanged box schedules no render at all.
  const last = useRef<ChartPlot | null>(null);
  const update = useRef(() => {
    const element = ref.current;
    if (element === null) return;
    const next = measure(element);
    if (samePlot(last.current, next)) return;
    last.current = next;
    setPlot(next);
  });
  useLayoutEffect(() => update.current());
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    // The plot's own size, and the page's, which browser zoom and a theme that changes above the
    // chart resize while they rescale or move the plot.
    const observer = new ResizeObserver(() => update.current());
    observer.observe(element);
    observer.observe(document.documentElement);
    // A web font that loads after the first paint moves the text above the plot, and the plot with
    // it, without resizing anything.
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) update.current();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [ref]);
  return plot;
}

/**
 * The bar spacing an element inherits, read after every commit that renders its owner. The owner
 * also renders whenever Root measures the plot anew, which every Root commit, resize and font load
 * does, so spacing that Root or an ancestor sets reaches a group whose own props never change. A
 * BarGroup reads its own element for all of its bars, and a Bar outside a group reads its own.
 *
 * @param ref - The owner's element, or null when another part owns the spacing.
 * @returns The spacing, or null before the first read.
 */
export function useBarMetrics(ref: RefObject<Element | null> | null): BarMetrics | null {
  // Subscribing to the measurement renders the owner when Root measures new spacing.
  use(ChartPlotContext);
  const [metrics, setMetrics] = useState<BarMetrics | null>(null);
  // The last read, so unchanged spacing schedules no render at all.
  const last = useRef<BarMetrics | null>(null);
  const read = useRef((element: Element | null) => {
    if (element === null) return;
    const next = readBarMetrics(element);
    if (last.current !== null && sameMetrics(last.current, next)) return;
    last.current = next;
    setMetrics(next);
  });
  useLayoutEffect(() => read.current(ref?.current ?? null));
  return metrics;
}

/** The nearest layout drawn into the measured plot. */
export type ChartFrame = {
  readonly frame: PlotFrame;
  /** The spacing the plot element inherits, which plot-wide parts such as the tooltip read. */
  readonly metrics: BarMetrics;
  readonly plot: ChartPlot;
};

/** A store subscription for a value that never changes after hydration. */
function subscribeNever(): () => void {
  return () => undefined;
}

/**
 * The frame a mark draws in: Root's measured plot under the nearest layout's value domain. A mark
 * that hydrates server HTML draws nothing in its hydration pass, as the server drew nothing, and
 * draws in the render React runs right after, so a Suspense boundary that hydrates after Root has
 * measured matches its server HTML too.
 *
 * @param part - The calling part's display name.
 * @returns The frame, or null before Root measures the plot and while the part hydrates.
 */
export function useChartFrame(part: string): ChartFrame | null {
  const { model, orientation } = useChartRoot(part);
  const { y } = useChartLayout(part);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const measured = use(ChartPlotContext);
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
