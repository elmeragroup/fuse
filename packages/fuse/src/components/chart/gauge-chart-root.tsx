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
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import { writeAttribute } from "./chart-dom";
import { useClientMount } from "./chart-draw-gate";
import { useEntrance } from "./chart-entrance";
import { GaugeContext } from "./chart-gauge-context";
import type { GaugeContextValue, GaugeModel, GaugeReading } from "./chart-gauge-context";
import { createGaugeFrame } from "./chart-gauge-frame";
import type { GaugeFrame } from "./chart-gauge-frame";
import { BROWSER_FRAMES, createChartMotion, SAME_PLOT } from "./chart-motion";
import type { MarkValues } from "./chart-motion";
import { ChartOwnScope, useChartDepth } from "./chart-own-scope";
import type { PolarUpdate } from "./chart-polar-context";
import { introPace, usePolarCommit, usePolarMark } from "./chart-polar-motion";
import { sameShallow, useSteady } from "./chart-steady";
import { createChartStore } from "./chart-store";
import type { ChartAccessibleName, ChartFigureProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { ChartCompositionError, ChartDataError, DATA_MESSAGES, isChartDevelopment } from "./layout/errors";
import { gaugeOffset, gaugePlace, gaugeShare } from "./layout/gauge";
import { CHART_SPRINGS } from "./layout/motion";
import { parseSweep, sweepBox } from "./layout/polar-angle";
import { entranceSpan } from "./layout/polar-motion";
import { springEasing } from "./layout/spring";

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
     * meter's text keep the true number. Null shows `GaugeChart.Empty`. A value that is not a
     * finite number throws `non-finite-value` in development and draws as null in production.
     */
    value: number | null;
    /** The value at the sweep's start. 0 by default. */
    min?: number;
    /**
     * The value at the sweep's end, above `min`. A `max` at or below `min`, or one that is not a
     * finite number, throws `invalid-gauge-domain`.
     */
    max: number;
    /** The value format, which the centre, the meter's text and the ruler's labels read. */
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
    /** "none" turns the entrance sweep off. */
    "data-intro"?: "none";
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/** The family the polar commit paces a gauge's entrance by. */
const GAUGE_INTRO = { family: "gauge" } as const;

/** The mark's writer: every painter on the frame draws the offset the loop shows. */
function drawReading(_cell: HTMLDivElement, frame: GaugeFrame, values: MarkValues): void {
  frame.draw(values);
}

/** What a gauge's model reads from its Root's props. */
type GaugeInput = {
  readonly value: number | null;
  readonly min: number;
  readonly max: number;
  readonly format: ValueFormat;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly locale: SupportedLocale;
};

/** The model, and whether its value broke the finite-number rule, which production draws as null. */
type ModelResult = { readonly model: GaugeModel; readonly nonFinite: boolean };

/**
 * A gauge's model from its Root's props.
 *
 * @param input - The props the model reads.
 * @returns The model.
 * @throws {ChartCompositionError} `invalid-gauge-domain` for a `max` at or below `min`, and
 *   `invalid-sweep` for an angle that is not a finite number.
 * @throws {ChartDataError} `non-finite-value` in development for a value that is not finite.
 */
function gaugeModel(input: GaugeInput): ModelResult {
  const { min, max, value } = input;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) {
    throw new ChartCompositionError(
      "GaugeChart.Root",
      "invalid-gauge-domain",
      `received min ${String(min)} and max ${String(max)}. Pass finite numbers with max above min.`
    );
  }
  const nonFinite = value !== null && !Number.isFinite(value);
  if (nonFinite && isChartDevelopment()) {
    throw new ChartDataError("GaugeChart.Root", "non-finite-value", DATA_MESSAGES["non-finite-value"]);
  }
  const domain = { min, max };
  const sweep = parseSweep("GaugeChart.Root", input.startAngle, input.endAngle);
  const reading: GaugeReading =
    value === null || nonFinite
      ? { kind: "empty" }
      : {
          kind: "value",
          value,
          share: gaugeShare(domain, value),
          offset: gaugeOffset(domain, sweep, value),
          place: gaugePlace(domain, value),
        };
  return {
    model: { domain, sweep, box: sweepBox(sweep), reading, format: input.format, locale: input.locale },
    nonFinite,
  };
}

/** The scale-out the track, the zones and the ruler take as the entrance starts, sampled once. */
const GROW = springEasing(CHART_SPRINGS.grow);

/** The scale-out's duration. */
const GROW_DURATION = `${String(GROW.duration)}ms`;

/** The entrance's span reads no spring of the radar's grid, which a gauge has none of. */
const NO_SPRINGS = { grow: 0, extend: 0 };

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
    startAngle = -135,
    endAngle = 135,
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
  const { model, nonFinite } = useMemo(
    () => gaugeModel({ value, min, max, format, startAngle, endAngle, locale }),
    [value, min, max, format, startAngle, endAngle, locale]
  );
  useEffect(() => {
    if (nonFinite) console.warn(`GaugeChart.Root ${DATA_MESSAGES["non-finite-value"]}`);
  }, [nonFinite]);

  const reduced = useReducedMotion();
  const entrance = figureProps["data-intro"] !== "none" && !reduced;
  const [store] = useState(() => createChartStore(null));
  const [motion] = useState(() => {
    const loop = createChartMotion(BROWSER_FRAMES, reduced);
    // The entrance holds the loop from the first commit, so it never plays unseen.
    if (entrance) loop.wait();
    return loop;
  });
  const [frame] = useState(createGaugeFrame);
  const rootRef = useRef<HTMLElement>(null);
  const figureRef = useMergedRefs(rootRef, ref);
  const cellRef = useRef<HTMLDivElement>(null);
  const clientMount = useClientMount();
  const [served] = useState(() => !clientMount);
  // The entrance reads its pace once, keyed on the Root's first commit.
  const [pacing] = useState<PolarUpdate>(() => ({ kind: "initial" }));

  useLayoutEffect(() => {
    motion.setReduced(reduced);
  }, [motion, reduced]);

  // The figure carries `data-drawn` once the entrance starts, which shows the marks, and
  // `data-entering` for its span, which counts the centre's digits up with the sweep. A dial the
  // browser mounted with no server HTML also carries `data-grow`, which scales its track out.
  useLayoutEffect(() => {
    const marked = rootRef.current;
    if (marked === null) return undefined;
    let timer: number | null = null;
    let started = store.get().phase === "started";
    const show = (): void => {
      writeAttribute(marked, "data-drawn", store.get().phase === "started" ? "" : null);
      if (started || store.get().phase !== "started") return;
      started = true;
      if (!entrance) return;
      writeAttribute(marked, "data-entering", "");
      writeAttribute(marked, "data-grow", served ? null : "");
      const items = { family: "gauge", items: 1, rings: 0, spokes: 0 } as const;
      timer = window.setTimeout(
        () => {
          timer = null;
          writeAttribute(marked, "data-entering", null);
          writeAttribute(marked, "data-grow", null);
        },
        entranceSpan(items, NO_SPRINGS, introPace(marked, pacing))
      );
    };
    show();
    const stop = store.subscribe(show);
    return () => {
      stop();
      if (timer === null) return;
      window.clearTimeout(timer);
      writeAttribute(marked, "data-entering", null);
      writeAttribute(marked, "data-grow", null);
    };
  }, [store, entrance, served, pacing]);

  useEntrance(store, motion, rootRef, cellRef, entrance);

  // Which commit produced the model, the first render or new data, as a polar Root tracks it, so
  // the mark reaches each commit as every polar mark does.
  const [seen, setSeen] = useState(model);
  const [update, setUpdate] = useState<PolarUpdate>(() => ({ kind: "initial" }));
  if (seen !== model) {
    setSeen(model);
    setUpdate({ kind: "data" });
  }
  // Whether the Root's effects are torn down, as React Activity leaves them while it hides the
  // chart, which the polar commit reads to tell a show from the mark's first mount.
  const hiddenRef = useRef(false);
  const kernel = useMemo(
    () => ({
      store,
      hidden: () => hiddenRef.current,
      root: () => rootRef.current,
    }),
    [store]
  );
  const commitSource = useMemo(
    () => ({ update, entrance, model: GAUGE_INTRO, kernel }),
    [update, entrance, kernel]
  );

  // The one mark, on the polar families' own lifecycle: the first commit sweeps in from `min`, or
  // snaps without an entrance, every commit while the entrance waits places it again under the
  // latest reading, new data sweeps on from what the dial shows and keeps its momentum, so a value
  // that lands mid-sweep bends the sweep, and a show after React Activity hid the chart snaps.
  const mark = usePolarMark(motion, drawReading, frame);
  const commit = usePolarCommit(commitSource, mark.node);
  // The mark moves the reading's share of the domain, which every painter turns into an angle on
  // the sweep it draws now. New data whose share is the one the mark heads for already, as a new
  // startAngle or endAngle is, is geometry: the painters snap to the new sweep at the share the loop
  // shows, and a running sweep carries on, its momentum with it.
  const placedShare = useRef<number | null>(null);
  useLayoutEffect(() => {
    const share = model.reading.kind === "value" ? model.reading.share : 0;
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
  // Declared after the mark's placement, so a show places while the Root still reads hidden.
  useLayoutEffect(() => {
    hiddenRef.current = false;
    return () => {
      hiddenRef.current = true;
    };
  }, []);

  // CSS pixels per unit of the track's radius: the cell's width over the sweep box's, scaled by the
  // room the rim layers take, which `chart.css` computes into `--_gauge-track`. A Zone or an
  // outside Ruler that comes or goes changes it with no resize, so every commit reads it again.
  const measureRef = useRef<() => void>(() => undefined);
  const latest = useRef(model);
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
  }, [frame]);
  useLayoutEffect(() => {
    latest.current = model;
    measureRef.current();
  });

  const cellRefs = useMergedRefs(cellRef, mark.ref);
  const context = useMemo((): GaugeContextValue => ({ model, frame }), [model, frame]);
  const depth = useChartDepth();
  const { reading, box } = model;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const name = definedProps({ "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy });
  const frameStyle = {
    "--chart-polar-aspect": `${String(width)} / ${String(height)}`,
    "--_grow-duration": GROW_DURATION,
    "--_grow-easing": GROW.easing,
  };
  return (
    <ChartOwnScope>
      <GaugeContext value={context}>
        <figure
          ref={figureRef}
          data-slot="gauge-chart"
          data-polar=""
          data-chart-depth={depth}
          data-empty={reading.kind === "empty" ? "" : undefined}
          data-over-max={reading.kind === "value" && reading.place === "over" ? "" : undefined}
          data-under-min={reading.kind === "value" && reading.place === "under" ? "" : undefined}
          {...figureProps}>
          <div data-slot="chart-polar-frame" style={frameStyle}>
            {/*
              One cell for the Root's life, which the entrance and the measurement observe, so a
              reading that arrives after the chart was empty finds them on it. The meter sits in it.
            */}
            <div ref={cellRefs} data-slot="chart-polar-cell">
              {reading.kind === "value" ? (
                <MeterPrimitive.Root
                  data-slot="gauge-chart-meter"
                  value={reading.value}
                  min={model.domain.min}
                  max={model.domain.max}
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
