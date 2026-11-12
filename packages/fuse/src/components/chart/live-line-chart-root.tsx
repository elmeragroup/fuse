"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { createDrawGate, openDrawingSoon, useClientMount } from "./chart-draw-gate";
import { StatusRegion } from "./chart-listbox";
import { BROWSER_FRAMES } from "./chart-motion";
import { ChartOwnScope, useChartDepth } from "./chart-own-scope";
import { useMeasuredPlot } from "./chart-plot-measure";
import { LiveLinePlotContext, LiveLineRootContext, PlotReadsContext } from "./chart-scope-contexts";
import { PlotLoader } from "./chart-skeleton";
import { sameShallow, useSteady } from "./chart-steady";
import type {
  ChartAccessibleName,
  ChartCategoricalRole,
  ChartFigureProps,
  ChartInstant,
  ValueFormat,
} from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import {
  ChartCompositionError,
  ChartDataError,
  dataMessage,
  isChartDevelopment,
  issueGroups,
  issueKey,
} from "./layout/errors";
import { createLiveClock } from "./layout/live-clock";
import type { LiveClockHost, LiveFeed, LiveMode } from "./layout/live-clock";
import { parseLiveLatest, parseLiveSeries } from "./layout/live-window";
import { createLiveStore, useShownFeed } from "./live-line-chart-context";
import type { LiveLineRootContextValue } from "./live-line-chart-context";
import { LiveSurface, useActiveFollowsFrame } from "./live-line-chart-surface";
import { liveDescription } from "./live-line-chart-text";
import type { LiveLineChartTimeFormat, LiveText } from "./live-line-chart-text";

/**
 * One reading of a live line chart.
 *
 * @beta
 */
export type LiveLineChartPoint = {
  /** When the reading was taken: a `Date` or epoch milliseconds. */
  readonly time: ChartInstant;
  /** The reading's value. */
  readonly value: number;
};

/**
 * Props for `LiveLineChart.Root`, the root of a line over a scrolling time window.
 *
 * @beta
 */
export type LiveLineChartRootProps = ChartAccessibleName &
  ChartFigureProps & {
    /**
     * The readings, oldest first, as the consumer's feed keeps them. A reading out of order sorts by
     * time, and one instant holds one reading: of readings that share a time, the last wins, as a
     * feed that corrects its latest reading sends it again. Keep at least the window's worth, and drop older readings as the feed grows: the chart
     * draws only the window, and the table and the description cover the window back from the latest
     * reading. Every cell is serialisable, so a server component passes it.
     */
    data: readonly LiveLineChartPoint[];
    /**
     * The latest value, which the line runs on at to the window's right edge, the live dot marks and
     * the badge prints. The latest reading's value by default. Pass it when the value ticks faster
     * than readings arrive. It keeps the readings' bound, a finite number within ±1e15.
     */
    value?: number;
    /**
     * The window's length in milliseconds, which scrolls with the clock so its right edge is always
     * now. `30_000` by default.
     */
    windowMs?: number;
    /** How values print on the axis, the badge, in the tooltip, the options, the table and the description. */
    valueFormat?: ValueFormat;
    /**
     * How a reading's time prints in the tooltip, the options, the table and the description.
     * `"time-seconds"` by default, such as `13:42:04`. The axis picks its own from its tick step.
     */
    timeFormat?: LiveLineChartTimeFormat;
    /** The value's name, such as "Spotpris", which the tooltip, the options and the table print. */
    label?: string;
    /** The line's paint. "chart-1" by default. The badge prints in its on-colour role. */
    color?: ChartCategoricalRole | "chart-other";
    /**
     * The IANA zone of the market the readings describe, such as "Europe/Oslo", which every time
     * prints in. LocaleProvider's `timeZone` by default.
     */
    timeZone?: string;
    /**
     * Holds the window where it is, so a reader can study it, while the readings keep arriving.
     * Once it runs again the window catches up with the clock and the readings it held back.
     */
    paused?: boolean;
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/** The default window: 30 seconds. */
const DEFAULT_WINDOW_MS = 30_000;

/** A live issue names its own row, so no slot maps to one. */
const NO_SLOT_ROWS: readonly number[] = [];

/**
 * The browser's frames and the wall clock. The window ends at `Date.now()`, the clock the
 * consumer's feed stamps its readings with, so the two agree. The frame clock, `performance.now()`,
 * stops while a computer sleeps, so a wall clock read from it falls behind the readings' stamps,
 * and a window held at the latest reading would stop scrolling. Glides and frames keep the frame
 * clock.
 */
const LIVE_FRAMES: LiveClockHost = {
  ...BROWSER_FRAMES,
  epoch: () => Date.now(),
};

/**
 * The root of a live line chart: one value over a time window that scrolls with the clock, its
 * right edge always now, as a feed of readings arrives. It reads the readings from `data` and the
 * latest value from `value`, never from its children, and renders a named `figure` that holds the
 * description, the instructions, the plot's single tab stop, the parts and the status region, in
 * that order. The consumer owns the feed, and the chart only draws it.
 *
 * The window moves every frame at the pace of time, and a new reading grows out of the last one on
 * the chart's update curve while the value axis eases to fit, so nothing jumps. The loop stops
 * while the chart is out of view or its tab is hidden, and catches up on its return. Under reduced
 * motion the chart moves nothing: each new reading redraws the window once, ending at the clock.
 * The server renders the final HTML around the plot, and the marks draw once the browser measures
 * it.
 *
 * @throws A `ChartCompositionError` of rule `time-axis-without-zone` with no zone, or
 *   `invalid-window` for a `windowMs` that is not a positive finite number. A `ChartDataError` of
 *   rule `invalid-x` or `non-finite-value` in development, for the first reading whose time or
 *   value is not a finite number within ±1e15, or `non-finite-live-value` for such a `value`.
 *   Production skips such readings, shows the latest reading's value for such a `value`, and warns
 *   once per rule.
 * @beta
 */
export function LiveLineChartRoot({
  data,
  value,
  windowMs = DEFAULT_WINDOW_MS,
  valueFormat,
  timeFormat = "time-seconds",
  label,
  color = "chart-1",
  timeZone: ownZone,
  paused = false,
  description,
  children,
  style,
  ref,
  ...figure
}: LiveLineChartRootProps): ReactElement {
  const { locale, timeZone: providerZone } = useLocale();
  const timeZone = ownZone ?? providerZone;
  if (timeZone === undefined) {
    throw new ChartCompositionError(
      "LiveLineChart.Root",
      "time-axis-without-zone",
      'draws a time axis with no time zone. Pass timeZone on the Root or on LocaleProvider, the IANA zone of the data\'s market, such as "Europe/Oslo".'
    );
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new ChartCompositionError(
      "LiveLineChart.Root",
      "invalid-window",
      `received windowMs ${String(windowMs)}. Pass the window's length in milliseconds, such as 30_000.`
    );
  }
  // A value that ticks on its own re-reads no reading.
  const series = useMemo(() => parseLiveSeries(data), [data]);
  const { points } = series;
  const { latest: tip, issues: valueIssues } = useMemo(() => parseLiveLatest(points, value), [points, value]);
  const issues = useMemo(() => [...series.issues, ...valueIssues], [series.issues, valueIssues]);
  const firstIssue = issues[0];
  if (firstIssue !== undefined && isChartDevelopment()) {
    throw new ChartDataError("LiveLineChart.Root", firstIssue.rule, dataMessage(firstIssue, NO_SLOT_ROWS));
  }
  const warned = useRef(new Set<string>());
  useEffect(() => {
    for (const { rule, subject, first, count } of issueGroups(issues)) {
      const key = issueKey(rule, subject);
      if (warned.current.has(key)) continue;
      warned.current.add(key);
      console.warn(`LiveLineChart.Root ${dataMessage(first, NO_SLOT_ROWS, count)}`);
    }
  }, [issues]);

  const feed = useMemo((): LiveFeed => ({ points, tip, duration: windowMs }), [points, tip, windowMs]);
  const [clock] = useState(() => createLiveClock(LIVE_FRAMES, feed));
  const [store] = useState(createLiveStore);
  const [drawing] = useState(createDrawGate);
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const figureRef = useMergedRefs(rootRef, ref);
  const plotRef = useRef<HTMLDivElement>(null);
  const { plot, probe, reads } = useMeasuredPlot(plotRef);
  // A browser mount draws in the render right after its first commit, which measured the plot. A
  // hydrating Root draws in a microtask after its hydration commit, before the browser paints.
  const clientMount = useClientMount();
  useLayoutEffect(() => {
    if (clientMount) drawing.openNow();
    else openDrawingSoon(drawing);
  }, [drawing, clientMount]);
  const reduced = useReducedMotion();
  // The mode goes first, so a Root that mounts paused holds the first frame, at the latest reading.
  useLayoutEffect(() => {
    const mode: LiveMode = paused ? "paused" : reduced ? "still" : "live";
    clock.setMode(mode);
  }, [clock, paused, reduced]);
  useLayoutEffect(() => {
    clock.feed(feed);
  }, [clock, feed]);
  // The loop runs only while some of the plot is in view.
  useEffect(() => {
    const element = plotRef.current;
    if (element === null) return undefined;
    const observer = new IntersectionObserver((entries) => {
      clock.setVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [clock]);
  useActiveFollowsFrame(clock, store);

  const figureProps = definedProps(figure);
  const name = "aria-label" in figureProps ? figureProps["aria-label"] : undefined;
  const labelledBy = "aria-labelledby" in figureProps ? figureProps["aria-labelledby"] : undefined;
  // Inline format objects that name the same options are no change.
  const steadyValueFormat = useSteady(valueFormat ?? {}, sameShallow);
  const steadyTimeFormat = useSteady(timeFormat, sameShallow);
  const text = useMemo(
    (): LiveText => ({
      locale,
      timeZone,
      timeFormat: steadyTimeFormat,
      valueFormat: steadyValueFormat,
      label,
    }),
    [locale, timeZone, steadyTimeFormat, steadyValueFormat, label]
  );
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
  const announce = useCallback((next: string) => {
    setAnnouncement((previous) => ({ text: next, count: previous.count + 1 }));
  }, []);
  const context = useMemo(
    (): LiveLineRootContextValue => ({
      text,
      clock,
      store,
      id,
      name,
      drawing,
      reduced,
      announce,
    }),
    [text, clock, store, id, name, drawing, reduced, announce]
  );
  // The description reads the feed the plot shows, as every readout does, so a paused chart's
  // description holds still with it.
  const shown = useShownFeed(context);
  const spokenDescription = useMemo(
    () => description ?? liveDescription(text, shown.points, shown.duration, shown.tip),
    [description, text, shown]
  );
  const depth = useChartDepth();
  return (
    <ChartOwnScope>
      <LiveLineRootContext value={context}>
        <figure
          ref={figureRef}
          data-slot="chart"
          data-chart="live-line"
          data-chart-depth={depth}
          style={{
            "--chart-series-paint": `var(--${color})`,
            "--_badge-ink": `var(--${color}-foreground)`,
            ...style,
          }}
          {...figureProps}>
          <p id={`${id}-description`} data-slot="chart-description">
            {spokenDescription}
          </p>
          <p id={`${id}-instructions`} data-slot="chart-instructions">
            {CHART_STRINGS[locale].instructionsLive}
          </p>
          <div data-slot="chart-frame">
            <div ref={plotRef} data-slot="chart-plot" aria-hidden="true">
              {probe}
              {plot === null && points.length > 0 ? <PlotLoader /> : null}
            </div>
            <LiveLinePlotContext value={plot}>
              <PlotReadsContext value={reads}>
                <LiveSurface labelledBy={labelledBy} />
                {children}
              </PlotReadsContext>
            </LiveLinePlotContext>
          </div>
          <StatusRegion text={announcement.text} count={announcement.count} />
        </figure>
      </LiveLineRootContext>
    </ChartOwnScope>
  );
}

Object.assign(LiveLineChartRoot, { displayName: "LiveLineChart.Root" });
