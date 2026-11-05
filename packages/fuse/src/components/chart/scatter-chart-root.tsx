"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { writeAttribute } from "./chart-dom";
import { openDrawingSoon, useClientMount } from "./chart-draw-gate";
import { useEntrance } from "./chart-entrance";
import { BROWSER_FRAMES, createChartMotion } from "./chart-motion";
import { PlotReadsContext, useMeasuredPlot } from "./chart-plot-measure";
import { PlotLoader } from "./chart-skeleton";
import { sameConfig, sameShallow, useSteady } from "./chart-steady";
import type {
  ChartAccessibleName,
  ChartCategoryKey,
  ChartConfig,
  ChartFigureProps,
  ChartRowOf,
  ChartScatterFieldCheck,
  ChartSeriesKey,
  ValueFormat,
} from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { createDomainGlide } from "./layout/domain-glide";
import type { ScatterDomains } from "./layout/domain-glide";
import { ChartDataError, dataMessage, isChartDevelopment, issueGroups, issueKey } from "./layout/errors";
import { sameItems } from "./layout/same-items";
import { buildScatterModel } from "./layout/scatter-model";
import type { ScatterModel } from "./layout/scatter-model";
import { createScatterMarks, ScatterPlotContext, ScatterRootContext } from "./scatter-chart-context";
import type { ScatterRootContextValue } from "./scatter-chart-context";
import { createScatterStore } from "./scatter-chart-store";
import type { ScatterStore } from "./scatter-chart-store";
import { ScatterStatus, ScatterSurface } from "./scatter-chart-surface";
import { scatterDescription } from "./scatter-chart-text";

/**
 * Props for `ScatterChart.Root`, the root of scatter charts and of curves over a numeric x.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 * @template TYKey - The y column, inferred from `yKey`.
 * @template TSeriesKey - The series column, inferred from `seriesKey`.
 * @beta
 */
export type ScatterChartRootProps<
  TRow extends ChartRowOf<TRow> = { readonly [key: string]: string | number | null | undefined },
  TConfig extends ChartConfig = ChartConfig,
  TXKey extends ChartSeriesKey<TRow> = ChartSeriesKey<TRow>,
  TYKey extends ChartSeriesKey<TRow> = ChartSeriesKey<TRow>,
  TSeriesKey extends ChartCategoryKey<TRow> = ChartCategoryKey<TRow>,
> = ChartAccessibleName &
  ChartFigureProps & {
    /**
     * Long rows, one per point: an x, a y and the series the point belongs to. Repeated x values
     * and repeated points are valid, and every one draws. A row whose x or y is null or undefined
     * has no point. Every cell is serialisable, so a server component passes it.
     */
    data: readonly TRow[];
    /**
     * One entry per series, keyed by the values of the `seriesKey` column. Each entry is a
     * `ChartSeriesConfig` with `label`, `color` and optionally `format` and `icon`. It takes no
     * `stack`, `projectedFrom`, `interval`, `missing`, `qualityKey` or `barVariant`, and its colour
     * is a role, never a scale, a role list or a threshold. Write it
     * `as const satisfies ChartConfig`. The legend lists the keys in config order, and JavaScript
     * orders keys that read as integers, such as "2026", first and ascending, so name a year's
     * series, such as `thisYear`.
     */
    config: TConfig & ChartScatterFieldCheck<TConfig>;
    /** The number column the x axis reads. */
    xKey: TXKey;
    /** The number column the y axis reads. */
    yKey: TYKey;
    /** The string column that names each row's series, one of the config keys. */
    seriesKey: TSeriesKey;
    /** How x values print on the axis, in the tooltip, the options and the table. */
    xFormat?: ValueFormat;
    /** How y values print. A series' config `format` overrides it. */
    valueFormat?: ValueFormat;
    /**
     * The x measure's name, such as "Ukemiddeltemperatur", which the tooltip, the options, the
     * description and the table's header print. The dictionary's "x-verdi" is the default. The axis
     * title is `XAxis`'s own `label`.
     */
    xLabel?: string;
    /** The y measure's name, such as "Ukeforbruk". The dictionary's "y-verdi" is the default. */
    yLabel?: string;
    /** Values the x domain must reach, such as 0 °C. */
    xInclude?: readonly number[];
    /** Values the y domain must reach. A scatter leaves 0 out unless it is listed here. */
    yInclude?: readonly number[];
    /**
     * "none" turns the entrance off. By default the marks sweep in from the left, by x, the first
     * time a third of the plot is in view, and reduced motion draws them at rest.
     */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/**
 * Above this many points a data update snaps the domains: each glide frame redraws every path, and
 * past a few thousand points that costs more than the glide is worth.
 */
const GLIDE_LIMIT = 5_000;

/** A scatter issue names its own row, so no slot maps to one. */
const NO_SLOT_ROWS: readonly number[] = [];

/** The model Root draws and whether the data update that brought it glides the domains to fit. */
type TakenModel = { readonly model: ScatterModel; readonly glides: boolean };

/** Write the active state onto Root, where the CSS reads it. A move restyles no mark. */
function markActive(root: HTMLElement, store: ScatterStore): void {
  const { active, source, pinned } = store.get();
  writeAttribute(root, "data-active", active === null ? null : (source ?? ""));
  writeAttribute(root, "data-pinned", pinned && active !== null ? "" : null);
}

/**
 * The root of scatter charts, which also draws curves over a numeric x. It reads the points from
 * `data`, `xKey`, `yKey` and `seriesKey`, never from its children, and renders a named `figure`
 * that holds the description, the instructions, the plot's single tab stop, the parts and the
 * status region, in that order. The server renders the final HTML around the plot, and the marks
 * draw once the browser measures it.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 * @template TYKey - The y column, inferred from `yKey`.
 * @template TSeriesKey - The series column, inferred from `seriesKey`.
 * @throws A `ChartDataError` of rule `non-finite-x`, `non-finite-y` or `unknown-series` in
 *   development, for the first row that breaks the rule. Production skips such rows and warns once
 *   per rule and column.
 * @beta
 */
export function ScatterChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TXKey extends ChartSeriesKey<TRow>,
  TYKey extends ChartSeriesKey<TRow>,
  TSeriesKey extends ChartCategoryKey<TRow>,
>({
  data,
  config,
  xKey,
  yKey,
  seriesKey,
  xFormat,
  valueFormat,
  xLabel,
  yLabel,
  xInclude,
  yInclude,
  description,
  children,
  ref,
  ...figure
}: ScatterChartRootProps<TRow, TConfig, TXKey, TYKey, TSeriesKey>): ReactElement {
  const { locale } = useLocale();
  const modelConfig = useSteady<ChartConfig>(config, sameConfig);
  const steadyX = useSteady(xInclude, sameItems);
  const steadyY = useSteady(yInclude, sameItems);
  // The model reads the keys alone, so a label, colour, format or icon change keeps it.
  const keys = useSteady(Object.keys(config), sameItems);
  const model = useMemo(
    () =>
      buildScatterModel({
        rows: data,
        xKey,
        yKey,
        seriesKey,
        keys,
        xInclude: steadyX ?? [],
        yInclude: steadyY ?? [],
      }),
    [data, xKey, yKey, seriesKey, keys, steadyX, steadyY]
  );
  const firstIssue = model.issues[0];
  if (firstIssue !== undefined && isChartDevelopment()) {
    throw new ChartDataError("ScatterChart.Root", firstIssue.rule, dataMessage(firstIssue, NO_SLOT_ROWS));
  }
  const warned = useRef(new Set<string>());
  useEffect(() => {
    for (const { rule, subject, first, count } of issueGroups(model.issues)) {
      const key = issueKey(rule, subject);
      if (warned.current.has(key)) continue;
      warned.current.add(key);
      console.warn(`ScatterChart.Root ${dataMessage(first, NO_SLOT_ROWS, count)}`);
    }
  }, [model.issues]);

  const id = useId();
  const [store] = useState(() => createScatterStore(model));
  const [marks] = useState(createScatterMarks);
  const rootRef = useRef<HTMLElement>(null);
  // Root reads its own figure for the active state and the entrance, and a consumer ref gets it too.
  const figureRef = useMergedRefs(rootRef, ref);
  const plotRef = useRef<HTMLDivElement>(null);
  const { plot, probe, reads } = useMeasuredPlot(plotRef);
  // A browser mount draws in the render right after its first commit, which measured the plot. A
  // hydrating Root draws in a microtask after its hydration commit, before the browser paints.
  const clientMount = useClientMount();
  useLayoutEffect(() => {
    if (clientMount) store.drawing.openNow();
    else openDrawingSoon(store.drawing);
  }, [store, clientMount]);
  const reduced = useReducedMotion();
  // The entrance's loop moves no mark. It only holds and releases the entrance's phase.
  const [motion] = useState(() => createChartMotion(BROWSER_FRAMES, reduced, () => undefined));
  const [glide] = useState(() => createDomainGlide({ x: model.x.domain, y: model.y.domain }, BROWSER_FRAMES));
  useLayoutEffect(() => {
    motion.setReduced(reduced);
  }, [motion, reduced]);
  const figureProps = definedProps(figure);
  const intro = figureProps["data-intro"];
  const entrance = intro !== "none" && !reduced;
  useEntrance(store, motion, rootRef, plotRef, entrance);
  // A data update glides the domains to fit, from where they draw, once the chart has entered.
  // Root decides in the update's first render, so an update that snaps draws under its new domains
  // there and builds each path once.
  const [taken, setTaken] = useState<TakenModel>({ model, glides: false });
  let { glides } = taken;
  if (taken.model !== model) {
    const previous = taken.model;
    glides = !previous.empty && !reduced && model.count <= GLIDE_LIMIT && store.get().phase === "started";
    setTaken({ model, glides });
  }
  const domains = useMemo((): ScatterDomains => ({ x: model.x.domain, y: model.y.domain }), [model]);
  const snapped = glides ? null : domains;
  useLayoutEffect(() => {
    // The store's ids belong to the model it last carried its walk into. A data update carries
    // the whole walk into the new model in one step, through the transition every reader uses.
    const previous = store.get().model;
    store.carry(model);
    if (rootRef.current) markActive(rootRef.current, store);
    glide.to(domains, previous !== model && glides ? "glide" : "snap");
    // A change of the motion preference runs it again, which snaps a running glide.
  }, [model, domains, glides, reduced, store, glide]);
  useLayoutEffect(() => () => glide.stop(), [glide]);
  useLayoutEffect(
    () =>
      store.subscribe(() => {
        if (rootRef.current) markActive(rootRef.current, store);
      }),
    [store]
  );
  const name = "aria-label" in figureProps ? figureProps["aria-label"] : undefined;
  const labelledBy = "aria-labelledby" in figureProps ? figureProps["aria-labelledby"] : undefined;
  const getRoot = useCallback((): HTMLElement | null => rootRef.current, []);
  // Inline format objects that name the same options are no change.
  const steadyXFormat = useSteady(xFormat ?? {}, sameShallow);
  const steadyValueFormat = useSteady(valueFormat ?? {}, sameShallow);
  const context = useMemo(
    (): ScatterRootContextValue => ({
      model,
      config: modelConfig,
      locale,
      xFormat: steadyXFormat,
      valueFormat: steadyValueFormat,
      xLabel,
      yLabel,
      store,
      id,
      name,
      root: getRoot,
      marks,
      entrance,
      glide,
      snapped,
    }),
    [
      model,
      modelConfig,
      locale,
      steadyXFormat,
      steadyValueFormat,
      xLabel,
      yLabel,
      store,
      id,
      name,
      getRoot,
      marks,
      entrance,
      glide,
      snapped,
    ]
  );
  const spokenDescription = useMemo(
    () =>
      description ??
      scatterDescription({
        model,
        config: modelConfig,
        locale,
        xFormat: steadyXFormat,
        valueFormat: steadyValueFormat,
        xLabel,
        yLabel,
      }),
    [description, model, modelConfig, locale, steadyXFormat, steadyValueFormat, xLabel, yLabel]
  );
  return (
    <ScatterRootContext value={context}>
      <figure ref={figureRef} data-slot="chart" data-chart="scatter" {...figureProps}>
        <p id={`${id}-description`} data-slot="chart-description">
          {spokenDescription}
        </p>
        <p id={`${id}-instructions`} data-slot="chart-instructions">
          {CHART_STRINGS[locale].instructionsCartesian}
        </p>
        <div data-slot="chart-frame">
          <div ref={plotRef} data-slot="chart-plot" aria-hidden="true">
            {probe}
            {plot === null && !model.empty ? <PlotLoader /> : null}
          </div>
          <ScatterPlotContext value={plot}>
            <PlotReadsContext value={reads}>
              <ScatterSurface labelledBy={labelledBy} />
              {children}
            </PlotReadsContext>
          </ScatterPlotContext>
        </div>
        <ScatterStatus />
      </figure>
    </ScatterRootContext>
  );
}

Object.assign(ScatterChartRoot, { displayName: "ScatterChart.Root" });
