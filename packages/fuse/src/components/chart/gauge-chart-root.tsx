"use client";

/**
 * A gauge's Root. It turns its reading and domain into the model its parts draw, owns the loop
 * that moves the reading's one offset and the frame every part paints from, plays the entrance
 * once the dial comes into view, and names the dial as a meter. The figure is a polar figure, so
 * the frame, the aspect-locked cell, the layers and the first-paint rules are the polar families'
 * own, and only the cell differs: it is the meter, with no tab stop, as a gauge has nothing to
 * step through.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { GaugeContext } from "./chart-gauge-context";
import type { GaugeContextValue, GaugeGeometry, GaugeModel, GaugeReading } from "./chart-gauge-context";
import { createGaugeFrame } from "./chart-gauge-frame";
import type { GaugeFrame } from "./chart-gauge-frame";
import { SAME_PLOT } from "./chart-motion";
import type { MarkValues } from "./chart-motion";
import { ChartOwnScope, useChartDepth } from "./chart-own-scope";
import { usePolarLifecycle } from "./chart-polar-lifecycle";
import { usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { sameShallow, useSteady } from "./chart-steady";
import type { ChartAccessibleName, ChartFigureProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { ChartCompositionError, ChartDataError, DATA_MESSAGES, isChartDevelopment } from "./layout/errors";
import { GAUGE_RADII, GAUGE_SWEEP, gaugePlace, gaugeShare } from "./layout/gauge";
import { parseSweep, sweepBox } from "./layout/polar-angle";
import { GAUGE_INTRO_START_MS, introDelay, TRACK_GROW, TRACK_GROW_DURATION } from "./layout/polar-motion";
import type { IntroPace } from "./layout/polar-motion";

/**
 * Props for `GaugeChart.Root`, the root of a gauge: one reading on a dial from `min` to `max`.
 *
 * @beta
 */
export type GaugeChartRootProps = ChartAccessibleName &
  ChartFigureProps & {
    /**
     * The reading, in the domain's own unit, such as 3.9 kWh. A value past either end draws at that
     * end and sets `data-over-max` or `data-under-min` on the figure, while the centre and the
     * meter's text keep the true number. A new reading sweeps on from wherever the dial shows, also
     * mid-sweep, and the centre's digits roll to it. Under reduced motion and in print the dial
     * draws at rest at once. Null shows `GaugeChart.Empty`, and the dial is no meter until a
     * reading arrives. A value that is not a finite number throws `non-finite-value` in development
     * and draws as null in production.
     */
    value: number | null;
    /** The value at the sweep's start. 0 by default. */
    min?: number;
    /**
     * The value at the sweep's end, above `min`. A `max` at or below `min`, or one that is not a
     * finite number, throws `invalid-gauge-domain`.
     */
    max: number;
    /**
     * The value format, which the centre, the meter's text and the ruler's labels read. A screen
     * reader reads the dial as a meter, with its name, its domain and the value in this format.
     */
    valueFormat?: ValueFormat;
    /**
     * Degrees from 12 o'clock, clockwise, where the sweep starts. −135 by default. An angle that is
     * not a finite number, here or in `endAngle`, throws `invalid-sweep`.
     */
    startAngle?: number;
    /**
     * Degrees from 12 o'clock, clockwise, where the sweep ends. 135 by default, a 270° sweep open
     * at the bottom. The chart keeps the aspect of the sweep's bounding box.
     */
    endAngle?: number;
    /**
     * "none" turns off the entrance, in which the track scales out and the fill sweeps from the
     * minimum to the reading the first time the gauge comes into view.
     */
    "data-intro"?: "none";
    /**
     * The chart's parts. Root never inspects them. Every part draws from `value`, and nothing in
     * the chart takes focus.
     */
    children?: ReactNode;
  };

/** The mark's writer: every painter on the frame draws the share the loop shows. */
function drawReading(_cell: HTMLDivElement, frame: GaugeFrame, values: MarkValues): void {
  frame.draw(values);
}

/**
 * A gauge's geometry from its Root's domain and angles.
 *
 * @param min - The value at the sweep's start.
 * @param max - The value at its end.
 * @param startAngle - Where the sweep starts.
 * @param endAngle - Where it ends.
 * @returns The geometry.
 * @throws {ChartCompositionError} `invalid-gauge-domain` for a `max` at or below `min`, and
 *   `invalid-sweep` for an angle that is not a finite number.
 */
function gaugeGeometry(min: number, max: number, startAngle: number, endAngle: number): GaugeGeometry {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) {
    throw new ChartCompositionError(
      "GaugeChart.Root",
      "invalid-gauge-domain",
      `received min ${String(min)} and max ${String(max)}. Pass finite numbers with max above min.`
    );
  }
  const sweep = parseSweep("GaugeChart.Root", startAngle, endAngle);
  return { domain: { min, max }, sweep, box: sweepBox(sweep) };
}

/** A reading, and whether its value broke the finite-number rule, which production draws as null. */
type ReadingResult = { readonly reading: GaugeReading; readonly nonFinite: boolean };

/**
 * A gauge's reading from its Root's value.
 *
 * @param geometry - The gauge's geometry, whose domain places the value.
 * @param value - The value, or null.
 * @returns The reading.
 * @throws {ChartDataError} `non-finite-value` in development for a value that is not finite.
 */
function gaugeReading(geometry: GaugeGeometry, value: number | null): ReadingResult {
  const nonFinite = value !== null && !Number.isFinite(value);
  if (nonFinite && isChartDevelopment()) {
    throw new ChartDataError("GaugeChart.Root", "non-finite-value", DATA_MESSAGES["non-finite-value"]);
  }
  if (value === null || nonFinite) return { reading: { kind: "empty" }, nonFinite };
  return { reading: { kind: "value", value, place: gaugePlace(geometry.domain, value) }, nonFinite };
}

/** How long a gauge's entrance runs: its one sweep, from its start. */
function gaugeSpan(pace: IntroPace): number {
  return pace.intro + introDelay("gauge", 0, pace);
}

/** The scale the layers inside a missing Track close in by: out by the notches' depth. */
const GAUGE_CLOSED = 1 / GAUGE_RADII.notchInner;

/** When the centre's digits start counting: as the sweep starts. */
const REEL_DELAY = `${String(GAUGE_INTRO_START_MS)}ms`;

/**
 * The root of a gauge. It reads one value against `min` and `max` and names the dial as a meter
 * with the value's spoken text, so the chart has no tab stop. Every part draws from one offset the
 * Root's loop moves: on first view the fill sweeps in from `min` over `--chart-intro`, and a new
 * value sweeps on from wherever the dial shows over `--chart-update`. Reduced motion and print
 * draw the reading at rest at once.
 *
 * @beta
 */
export function GaugeChartRoot(props: GaugeChartRootProps): ReactElement {
  const {
    value,
    min = 0,
    max,
    valueFormat,
    startAngle = GAUGE_SWEEP.startAngle,
    endAngle = GAUGE_SWEEP.endAngle,
    children,
    ref,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...figure
  } = props;
  const figureProps = definedProps(figure);
  const { locale } = useLocale();
  // An inline valueFormat object that names the same options is no change.
  const format = useSteady<ValueFormat>(valueFormat ?? {}, sameShallow);
  // A new reading keeps the geometry, so no part lays out again for it.
  const geometry = useMemo(
    () => gaugeGeometry(min, max, startAngle, endAngle),
    [min, max, startAngle, endAngle]
  );
  const { reading, nonFinite } = useMemo(() => gaugeReading(geometry, value), [geometry, value]);
  const model = useMemo(
    (): GaugeModel => ({
      geometry,
      reading,
      rest: reading.kind === "value" ? gaugeShare(geometry.domain, reading.value) : 0,
      format,
      locale,
    }),
    [geometry, reading, format, locale]
  );
  useEffect(() => {
    if (nonFinite) console.warn(`GaugeChart.Root ${DATA_MESSAGES["non-finite-value"]}`);
  }, [nonFinite]);

  const {
    motion,
    figureRef,
    cellRef,
    commit: source,
  } = usePolarLifecycle({
    family: "gauge",
    data: model,
    intro: figureProps["data-intro"] !== "none",
    ref,
    defaultActive: null,
    span: gaugeSpan,
  });
  const [frame] = useState(createGaugeFrame);

  // The one mark, on the polar families' own lifecycle: the first commit sweeps in from `min`, or
  // snaps without an entrance, every commit while the entrance waits places it again under the
  // latest reading, new data sweeps on from what the dial shows and keeps its momentum, so a value
  // that lands mid-sweep bends the sweep, and a show after React Activity hid the chart snaps.
  const mark = usePolarMark(motion, drawReading, frame);
  const commit = usePolarCommit(source, mark.node);
  // The mark moves the reading's share of the domain, which every painter turns into an angle on
  // the sweep it draws now. New data whose share is the one the mark heads for already, as a new
  // startAngle or endAngle is, is geometry: the painters snap to the new sweep at the share the loop
  // shows, and a running sweep carries on, its momentum with it.
  const placedShare = useRef<number | null>(null);
  useLayoutEffect(() => {
    const share = model.rest;
    const previous = placedShare.current;
    placedShare.current = share;
    const placement = commit(0, [0]);
    mark.place(
      [share],
      placement.kind !== "move"
        ? placement
        : previous === share
          ? { kind: "settle", scale: SAME_PLOT }
          : { ...placement, momentum: "keep" }
    );
  });

  // CSS pixels per unit of the track's radius: the cell's width over the sweep box's, scaled by the
  // room the rim layers take, which `chart.css` computes into `--_gauge-track`. A Zone or an
  // outside Ruler that comes or goes changes it with no resize, so every commit reads it again.
  const measureRef = useRef<() => void>(() => undefined);
  const latest = useRef(geometry);
  useLayoutEffect(() => {
    const cell = cellRef.current;
    if (cell === null) return undefined;
    const measure = (): void => {
      const { box } = latest.current;
      const width = box.right - box.left;
      const track = Number.parseFloat(getComputedStyle(cell).getPropertyValue("--_gauge-track"));
      const unit = width > 0 ? cell.getBoundingClientRect().width / width : 0;
      frame.measure({
        scale: unit * (Number.isFinite(track) && track > 0 ? track : 1),
        dpr: window.devicePixelRatio || 1,
      });
    };
    measureRef.current = measure;
    measure();
    const sizes = new ResizeObserver(measure);
    sizes.observe(cell);
    return () => {
      sizes.disconnect();
      measureRef.current = () => undefined;
    };
  }, [frame, cellRef]);
  useLayoutEffect(() => {
    latest.current = geometry;
    measureRef.current();
  });

  const cellRefs = useMergedRefs(cellRef, mark.ref);
  const context = useMemo((): GaugeContextValue => ({ model, frame }), [model, frame]);
  const depth = useChartDepth();
  const { box, domain } = geometry;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  // While a reading shows, the meter carries the name, so a reader hears it once with the value.
  // With none, the figure carries it, so an empty gauge among others still says which it is.
  const name = definedProps({ "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy });
  const empty = reading.kind === "empty";
  const figureName = definedProps({
    "aria-label": empty ? ariaLabel : undefined,
    "aria-labelledby": empty ? ariaLabelledBy : undefined,
  });
  return (
    <ChartOwnScope>
      <GaugeContext value={context}>
        <figure
          ref={figureRef}
          data-slot="gauge-chart"
          data-polar=""
          data-chart-depth={depth}
          data-empty={empty ? "" : undefined}
          data-over-max={reading.kind === "value" && reading.place === "over" ? "" : undefined}
          data-under-min={reading.kind === "value" && reading.place === "under" ? "" : undefined}
          {...figureName}
          {...figureProps}>
          <div
            data-slot="chart-polar-frame"
            style={{
              "--chart-polar-aspect": `${String(width)} / ${String(height)}`,
              "--_grow-duration": TRACK_GROW_DURATION,
              "--_grow-easing": TRACK_GROW.easing,
              "--_gauge-closed": GAUGE_CLOSED,
              "--_reel-delay": REEL_DELAY,
            }}>
            {/*
              One cell for the Root's life, which the entrance and the measurement observe, so a
              reading that arrives after the chart was empty finds them on it. The meter sits in it.
            */}
            <div ref={cellRefs} data-slot="chart-polar-cell">
              {reading.kind === "value" ? (
                <MeterPrimitive.Root
                  data-slot="gauge-chart-meter"
                  value={reading.value}
                  min={domain.min}
                  max={domain.max}
                  getAriaValueText={() => formatValue(locale, reading.value, format, "full").spoken}
                  {...name}
                />
              ) : null}
            </div>
            {children}
          </div>
        </figure>
      </GaugeContext>
    </ChartOwnScope>
  );
}

Object.assign(GaugeChartRoot, { displayName: "GaugeChart.Root" });
