"use client";

/**
 * The cartesian plot. Root and each Panel measure their plot through `chart-plot-measure.ts`, and
 * every mark reads the measurement through `useChartFrame` and draws in CSS pixels, under its
 * layout's value domain.
 */
import {
  createContext,
  use,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";

import { useChartRoot } from "./chart-context";
import type { ChartLayoutContextValue, PanelEntry } from "./chart-context";
import { writeStyle } from "./chart-dom";
import {
  PlotReadsContext,
  readBarMetrics,
  sameMetrics,
  useMeasuredPlot,
  usePlotRead,
} from "./chart-plot-measure";
import type { ChartPlot, MeasuredPlot, PlotReads } from "./chart-plot-measure";
import { plotFrame } from "./layout/plot-frame";
import type { BarMetrics, PlotFrame } from "./layout/plot-frame";
import type { ValueDomain } from "./layout/value-domain";

/** The nearest measured plot, Root's or a Panel's, or null before the browser measures it. */
export const ChartPlotContext = createContext<ChartPlot | null>(null);

/** Root's own measured plot, which spans every Panel and gives each one its x frame. */
export const ChartRootPlotContext = createContext<ChartPlot | null>(null);

/** How Root keeps the span of its Panels' plots on its frame. */
export type PanelSpan = {
  /**
   * Place the span from the plots' current positions for Root's commit. Root's probe calls it
   * before it measures.
   */
  readonly place: () => void;
  /**
   * Place the span unless the Root commit in progress placed it, for a commit of a Panel or a
   * pointer that enters the surface. A Panel commits in Root's commit after Root's probe placed the
   * span, and any later commit places it again.
   */
  readonly follow: () => void;
};

/**
 * Keep the span of the Panels' plots on Root's frame, from the highest plot's top to the lowest
 * plot's bottom, as `--chart-panels-top` and `--chart-panels-height` in the frame's layout pixels
 * from its padding edge. Root's plot, its surface and the empty state lie over that span, out of
 * the grid's rows, so any number of Panels stack in the frame's rows. CSS grid cannot name that
 * span: the Panel rows are auto-placed after the optional rows above them, and their count is
 * open. The plots' current positions decide the span, whatever order the Panels registered in, and
 * an ancestor's transform is divided out by a plot's drawn height over its layout height. Root's
 * probe places it once per Root commit, before Root measures its plot, and it places again whenever
 * the frame, a Panel or a Panel's plot resizes, as a slot label row in one Panel moves the plots
 * below it without resizing them. A move that changes no size, such as keyed Panels a child
 * reorders without rendering Root, reaches it through `follow`, which each Panel calls after its
 * own commits and the surface calls when a pointer enters it.
 *
 * @param frame - Root's frame element.
 * @param panels - The mounted Panels.
 * @returns The span's stable placements.
 */
export function usePanelSpan(frame: RefObject<HTMLElement | null>, panels: readonly PanelEntry[]): PanelSpan {
  const latest = useRef(panels);
  // The probe runs before Root's layout effects, so the Panels it reads are set as the commit starts.
  useInsertionEffect(() => {
    latest.current = panels;
  });
  const [span] = useState(() => {
    // Whether Root's probe placed the span in the Root commit in progress, which Root's layout
    // effect clears once every Panel of the commit has run its own.
    let placed = false;
    const draw = (): void => {
      const element = frame.current;
      if (element === null) return;
      const plots = latest.current.flatMap(({ plot }) => {
        const node = plot();
        return node === null ? [] : [node];
      });
      const [first] = plots;
      if (first === undefined) {
        writeStyle(element, "--chart-panels-top", null);
        writeStyle(element, "--chart-panels-height", null);
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
      writeStyle(element, "--chart-panels-top", `${String((top - origin) / scale)}px`);
      writeStyle(element, "--chart-panels-height", `${String((bottom - top) / scale)}px`);
    };
    return {
      draw,
      place: () => {
        placed = true;
        draw();
      },
      follow: () => {
        if (!placed) draw();
      },
      settle: () => {
        placed = false;
      },
    };
  });
  // Root's layout effects run after its Panels', so this ends the commit's placement.
  useLayoutEffect(() => {
    span.settle();
  });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => span.draw());
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
  }, [frame, panels, span]);
  return { place: span.place, follow: span.follow };
}

/**
 * Measure a Panel's plot element and draw it in Root's x frame. Every Panel's plot lies in Root's
 * plot column, so each takes Root's left edge, width and pixel ratio, and every Panel snaps a
 * slot's edges, the crosshair and the active column to the same device pixels. The Panel's own
 * top and height give its value axis. Its parts' reads run in Root's probe phase as well as in its
 * own, so a style Root passes down reaches them in a commit of Root that the Panel sits out.
 *
 * @param ref - The Panel's plot element.
 * @returns The Panel's plot, or null until both Root and the Panel are measured, the probe to
 *   render and the reads its parts register.
 */
export function usePanelPlot(ref: RefObject<HTMLElement | null>): MeasuredPlot {
  const root = use(ChartRootPlotContext);
  const rootReads = use(PlotReadsContext);
  const { plot: own, probe, reads: panelReads } = useMeasuredPlot(ref);
  const reads = useMemo(
    (): PlotReads => ({
      add(read) {
        const leavePanel = panelReads.add(read);
        const leaveRoot = rootReads.add(read);
        return () => {
          leavePanel();
          leaveRoot();
        };
      },
    }),
    [panelReads, rootReads]
  );
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

/** The draw gate as the server and a hydrating part read it. */
function closedOnServer(): boolean {
  return false;
}

/**
 * A measured plot under a value domain, once Root opens its draw gate. The server and a hydrating
 * part read the gate closed, so a part whose Suspense boundary hydrates after Root measured still
 * matches its server HTML, and draws in the render React runs right after.
 */
function useFrameOf(part: string, measured: ChartPlot | null, y: ValueDomain): ChartFrame | null {
  const { model, orientation, store, xScale } = useChartRoot(part);
  const { drawing } = store;
  const open = useSyncExternalStore(drawing.subscribe, drawing.open, closedOnServer);
  const plot = open ? measured : null;
  const window = model.window;
  const count = window === null ? 1 : window.last - window.first + 1;
  return useMemo(
    () =>
      plot === null
        ? null
        : { frame: plotFrame(plot.box, orientation, count, y.domain, xScale), metrics: plot.metrics, plot },
    [plot, orientation, count, y.domain, xScale]
  );
}
