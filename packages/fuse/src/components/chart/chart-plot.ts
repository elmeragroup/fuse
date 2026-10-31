"use client";

/**
 * The measured plot. Root measures its plot box in a layout effect, before the first paint, and a
 * ResizeObserver follows the box from then on. Every mark reads the measurement through
 * `useChartFrame` and draws in CSS pixels. The server and a hydrating render measure nothing, so
 * they draw no marks, and the plot shows its skeleton until the browser measures it.
 */
import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";

import { useChartRoot } from "./chart-context";
import type { ChartLayoutContextValue, PanelEntry } from "./chart-context";
import { subscribeNever } from "./chart-store";
import { plotFrame } from "./layout/plot-frame";
import type { BarMetrics, PlotBox, PlotFrame } from "./layout/plot-frame";
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
function measure(element: HTMLElement, observed: LayoutSize | null): ChartPlot {
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
  // The layout size the observer last reported for the plot.
  const observed = useRef<LayoutSize | null>(null);
  const update = useRef(() => {
    const element = ref.current;
    if (element === null) return;
    const next = measure(element, observed.current);
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
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const [box] = entry.contentBoxSize;
        if (entry.target === element && box !== undefined) {
          observed.current = { width: box.inlineSize, height: box.blockSize };
        }
      }
      update.current();
    });
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
 * @returns The Panel's plot, or null until both Root and the Panel are measured.
 */
export function usePanelPlot(ref: RefObject<HTMLElement | null>): ChartPlot | null {
  const root = use(ChartRootPlotContext);
  const own = useMeasuredPlot(ref);
  return useMemo(
    () =>
      root === null || own === null
        ? null
        : {
            box: { ...own.box, left: root.box.left, width: root.box.width, dpr: root.box.dpr },
            metrics: own.metrics,
          },
    [root, own]
  );
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
