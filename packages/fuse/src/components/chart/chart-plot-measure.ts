"use client";

/**
 * The measured plot. An owner, a chart Root or a Panel, measures its plot box in a layout effect,
 * before the first paint, and a ResizeObserver follows the box from then on. Every mark reads the
 * measurement and draws in CSS pixels. The server and a hydrating render measure nothing, so they
 * draw no marks, and the plot holds a quiet loader until the browser measures it. This module
 * reads no Root context, so every chart family measures its plot through it.
 */
import { createContext, createElement, use, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, RefObject } from "react";

import { flushSync } from "react-dom";

import { reassess } from "./chart-entrance";
import { sameSnapping } from "./layout/plot-frame";
import type { BarMetrics, PlotBox } from "./layout/plot-frame";
import { sameItems } from "./layout/same-items";

/** The plot box and the bar spacing, as Root last measured them. */
export type ChartPlot = { readonly box: PlotBox; readonly metrics: BarMetrics };

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
export function readBarMetrics(element: Element, style = getComputedStyle(element)): BarMetrics {
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
export function sameMetrics(a: BarMetrics, b: BarMetrics): boolean {
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
 * origin, so a scroll by whole device pixels keeps the old measurement and renders nothing. A size
 * the computed style serialized and the observer's full-precision report of it are one size, so
 * the observer's first report draws nothing again, under a transform too.
 */
function samePlot(a: ChartPlot | null, b: ChartPlot): boolean {
  return a !== null && sameSnapping(a.box, b.box, SERIALIZED) && sameMetrics(a.metrics, b.metrics);
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
 * that resized or moved them. A page resize names every plot. Each delivery reports on the plots
 * whose entrance waits again.
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
  // A plot or the page that changes size can show more of a plot whose entrance waits.
  reassess();
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
 * in the commit that mounts it, hydration included, so its marks draw before the commit's task
 * ends: in the render right after a browser mount's commit, and in the microtask Root's draw gate
 * opens in after a hydration commit. A later task would update a Suspense boundary inside the
 * chart that has not hydrated yet, and React would render it again on the client. A move it
 * misses only shifts how a tie rounds, since every edge stays a whole number of device pixels from
 * the layer's origin.
 *
 * @param ref - The plot element.
 * @param size - Sizes the plot before the probe measures it, as Root's span over its Panels does.
 *   The owner's first call counts.
 * @returns The measurement and the probe to render.
 */
export function useMeasuredPlot(ref: RefObject<HTMLElement | null>, size?: () => void): MeasuredPlot {
  const [plot, setPlot] = useState<ChartPlot | null>(null);
  const [owner] = useState(() => plotOwner(setPlot, size));
  useLayoutEffect(() => owner.mount(ref.current), [owner, ref]);
  return { plot, probe: createElement(PlotProbe, { probe: owner.probe }), reads: owner.reads };
}

/**
 * The measurement one plot owner keeps between commits: the watch the shared observer reads, the
 * measure and the reads its probe runs.
 *
 * @param apply - Sets the owner's measurement.
 * @param size - Sizes the plot before each probe measures it.
 */
function plotOwner(apply: (plot: ChartPlot) => void, size?: () => void) {
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
    size?.();
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
  return { probe, reads, mount };
}
