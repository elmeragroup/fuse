"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useMediaQuery } from "../../hooks/use-media-query";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import {
  ChartLayoutContext,
  ChartRootContext,
  ChartSelectionContext,
  partOutsidePanel,
} from "./chart-context";
import type {
  ChartLayoutContextValue,
  ChartRootContextValue,
  ChartUpdate,
  PanelEntry,
} from "./chart-context";
import { writeAttribute } from "./chart-dom";
import { createChartFollowers } from "./chart-followers";
import type { ActiveSlot } from "./chart-followers";
import { createChartLabels } from "./chart-labels";
import { createChartMotion, createFrameOwner } from "./chart-motion";
import type { ChartMotion, FrameOwner } from "./chart-motion";
import { colourFamilyError } from "./chart-paint";
import { createChartPaths } from "./chart-paths";
import {
  ChartPlotContext,
  ChartRootPlotContext,
  PlotReadsContext,
  useMeasuredPlot,
  usePanelSpan,
} from "./chart-plot";
import { PlotSkeleton } from "./chart-skeleton";
import { sameShallow, useSteady } from "./chart-steady";
import { createChartStore, useClientMount } from "./chart-store";
import type { ChartSnapshot, EmphasisEntry } from "./chart-store";
import { ChartStatus, ChartSurface } from "./chart-surface";
import { chartDescription, seriesLabel } from "./chart-text";
import type { TextContext } from "./chart-text";
import type {
  ChartAccessibleName,
  ChartChangeEventDetails,
  ChartConfig,
  ChartFigureProps,
  ChartIntro,
  ChartRow,
  ChartRowOf,
  ChartScalar,
  ChartSelectionChangeReason,
  ChartSelectionProps,
  ChartSeriesConfig,
  ChartSeriesConfigCheck,
  ChartTimeAxisProps,
  ChartXKey,
  ChartXOut,
  ChartXRange,
  ChartXRangeChangeReason,
  ChartXValue,
} from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { buildCartesianModel, layoutDomain } from "./layout/cartesian-model";
import type { CartesianModel, ModelIssue } from "./layout/cartesian-model";
import { intervalNests } from "./layout/coarse-slots";
import {
  ChartCompositionError,
  ChartDataError,
  dataMessage,
  dataSubject,
  isChartDevelopment,
} from "./layout/errors";
import type { ChartDataRule, ChartHintRule } from "./layout/errors";
import { mountedSeries, relaysPlot } from "./layout/relay";
import { sameItems } from "./layout/same-items";
import { numberOf, stringOf } from "./layout/scalar";
import { pairSlotKeys } from "./layout/slot-keys";
import type { SlotKeys } from "./layout/slot-keys";
import { keepSlot } from "./layout/slot-window";
import { instantOf, slotOf, slotX } from "./layout/x-domain";

/**
 * Props for `Chart.Root`, the root of every cartesian chart.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 * @beta
 */
export type ChartRootProps<
  TRow extends ChartRowOf<TRow> = ChartRow,
  TConfig extends ChartConfig = ChartConfig,
  TXKey extends ChartXKey<TRow> = ChartXKey<TRow>,
> = ChartAccessibleName &
  ChartFigureProps &
  ChartSelectionProps<keyof TConfig & string> &
  ChartTimeAxisProps<TRow[TXKey]> & {
    /** The rows, one per slot or category. Every cell is serialisable, so a server component passes it. */
    data: readonly TRow[];
    /**
     * One entry per series, keyed by the number column it reads. Each entry is a `ChartSeriesConfig`
     * with a required `label` and `color` and an optional `format`, `icon`, `stack`, `missing`,
     * `projectedFrom`, `qualityKey` and `interval`. Write it `as const satisfies ChartConfig`, so a misspelt literal
     * `qualityKey` fails the type.
     */
    config: TConfig & ChartSeriesConfigCheck<TConfig, TRow>;
    /**
     * The x column. It names a column with no null values. A `Date` or epoch-milliseconds column
     * makes a time axis, which needs `interval`, and a string column makes a category axis in data
     * order.
     */
    xKey: TXKey;
    /** "band" by default. Line and area charts usually pass "point". */
    xScale?: "band" | "point";
    /**
     * "horizontal" draws the x column down the left edge and values left to right, for horizontal
     * bars. Axes keep their data roles in both orientations, so `XAxis` is always the `xKey` axis and
     * `YAxis` always the value axis. Each category row is `--chart-row-height` tall.
     */
    orientation?: "vertical" | "horizontal";
    /** "diverging" by default, so negative values stack below zero. */
    stackOffset?: "diverging" | "expand";
    /**
     * "zero" by default. "none" lets a Line-only layout leave 0 out, and Bar and Area throw under it.
     * It governs the default layout only. Each Panel takes its own.
     */
    yBaseline?: "zero" | "none";
    /** Values the default layout's y domain must reach, such as a price cap. Each Panel takes its own. */
    yInclude?: readonly number[];
    /**
     * The first and last slot of the brushed window, both inclusive. Prefer the uncontrolled
     * `defaultXRange` with `onXRangeCommitted`, because a controlled range renders every series on
     * each brush step.
     */
    xRange?: ChartXRange<TRow[TXKey]>;
    /** The brushed window on first render. */
    defaultXRange?: ChartXRange<TRow[TXKey]>;
    /** Called on every brush step with the first and last slot. A data update never calls it. */
    onXRangeChange?: (
      range: readonly [first: ChartXOut<TRow[TXKey]>, last: ChartXOut<TRow[TXKey]>],
      details: ChartChangeEventDetails<ChartXRangeChangeReason>
    ) => void;
    /** Called once when a brush drag, track press or key press ends. Fetch new data here. */
    onXRangeCommitted?: (
      range: readonly [first: ChartXOut<TRow[TXKey]>, last: ChartXOut<TRow[TXKey]>],
      details: ChartChangeEventDetails<ChartXRangeChangeReason>
    ) => void;
    /** The slot that is active before any pointer or key moves. An x survives a reload where an index would not. */
    defaultActiveX?: ChartXValue<TRow[TXKey]>;
    /**
     * The entrance wipe origin, physical under `dir="rtl"` too. "none" turns the entrance off. The
     * entrance runs once, when Root first mounts in the browser, and a server-rendered chart that
     * hydrates starts none. A bar that a data update adds writes `data-intro="fade"` on itself and
     * fades in. A bar that an `xRange` change, a brush step or a pan adds writes `data-intro="none"`
     * and takes its place at once.
     */
    "data-intro"?: ChartIntro;
    /** "past" fades marks whose slot ended before `now`. */
    "data-fade"?: "past";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/** Each config key's layout value domain, by key. */
type KeyDomains = ReadonlyMap<string, readonly [number, number]>;

/** One commit's motion facts, kept across renders so the next commit can compare. */
type ChartCommit = {
  readonly model: CartesianModel;
  readonly data: unknown;
  readonly config: unknown;
  /** The steady range object, which changes only when the range names other values. */
  readonly range: unknown;
  readonly update: ChartUpdate;
  readonly keys: SlotKeys;
  /** The value domain of the layout each key draws in. */
  readonly domains: KeyDomains;
  /**
   * The keys whose layout's value domain moved since the motion loop last rested, so a tween that
   * glides one Panel between two domains leaves the other Panels alone. A domain that returns to
   * where it started mid-tween stays moved, because its marks still glide back.
   */
  readonly moved: ReadonlySet<string>;
};

/**
 * The value domain each config key draws in: its Panel's, or the default layout's without Panels.
 * Root computes a Panel's domain from what the Panel registered, as the Panel computes it during
 * render, so both read the same model.
 */
function keyDomains(
  model: CartesianModel,
  stackOffset: "diverging" | "expand",
  panels: readonly PanelEntry[]
): KeyDomains {
  if (panels.length === 0) return new Map(model.series.map(({ key }) => [key, model.y.domain]));
  const stacked = { ...model, stackOffset };
  return new Map(
    panels.flatMap(({ layout }) => {
      const { domain } = layoutDomain(stacked, layout);
      return layout.keys.map((key) => [key, domain] as const);
    })
  );
}

/** Order two Panels as their plots sit on the page. */
function inPageOrder(a: PanelEntry, b: PanelEntry): number {
  const [first, second] = [a.plot(), b.plot()];
  if (first === null || second === null || first === second) return 0;
  return first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** Whether two key domain maps hold the same domain for a key. */
function sameDomain(a: KeyDomains, b: KeyDomains, key: string): boolean {
  const [lowA, highA] = a.get(key) ?? [0, 1];
  const [lowB, highB] = b.get(key) ?? [0, 1];
  return lowA === lowB && highA === highB;
}

/**
 * The error of Panels that break section 8.3's layouts: a key listed by two Panels and a config key
 * that no Panel lists. It reads every Panel of the current tree, so it runs once their effects
 * have registered them all.
 *
 * @returns The error, or null when the Panels cover every key once.
 */
function panelsError(config: ChartConfig, panels: readonly PanelEntry[]): ChartCompositionError | null {
  const owners = new Set<string>();
  for (const { layout } of panels) {
    for (const key of layout.keys) {
      if (owners.has(key)) {
        return new ChartCompositionError(
          "Chart.Panel",
          "series-in-two-panels",
          `lists ${JSON.stringify(key)}, which another Chart.Panel lists too, so it would have two y domains. List each config key in one Panel.`
        );
      }
      owners.add(key);
    }
  }
  const outside = Object.keys(config).find((key) => !owners.has(key));
  return outside === undefined
    ? null
    : new ChartCompositionError(
        "Chart.Root",
        "key-outside-panels",
        `has config key ${JSON.stringify(outside)}, which no Chart.Panel lists, so it has no y domain. Add it to one Panel's series.`
      );
}

/** One end of an x range as a comparable string. */
function rangePart(value: ChartScalar): string {
  if (value instanceof Date) return `t${String(value.getTime())}`;
  return stringOf(value) === undefined ? `n${String(numberOf(value))}` : `s${stringOf(value) ?? ""}`;
}

/** Whether two ranges name the same two values, compared as tuples. */
function sameRange(
  a: readonly [ChartScalar, ChartScalar] | undefined,
  b: readonly [ChartScalar, ChartScalar] | undefined
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return rangePart(a[0]) === rangePart(b[0]) && rangePart(a[1]) === rangePart(b[1]);
}

/** One field value of a series config. */
type ConfigField = ChartSeriesConfig[keyof ChartSeriesConfig];

/** A series config's fields in order. */
function fieldsOf(entry: ChartSeriesConfig): (readonly [string, ConfigField])[] {
  // SAFETY: Object.entries of a ChartSeriesConfig yields its own fields, each a ConfigField.
  return Object.entries(entry) as (readonly [string, ConfigField])[];
}

/**
 * Whether two configs say the same thing. A config written inline in JSX is a new object on every
 * render, and only a change of what it says counts as a data update.
 */
function sameConfig(a: ChartConfig, b: ChartConfig): boolean {
  const left = Object.entries(a);
  const right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, entry], index) => {
      const other = right[index];
      if (other?.[0] !== key) return false;
      const fields = fieldsOf(entry);
      const otherFields = new Map(fieldsOf(other[1]));
      return (
        fields.length === otherFields.size &&
        fields.every(([name, value]) => otherFields.has(name) && sameShallow(value, otherFields.get(name)))
      );
    })
  );
}

/** Throw for config that cannot draw: a key that names no column of any row. */
function assertConfigFits(config: ChartConfig, data: readonly ChartRow[]): void {
  const keys = Object.keys(config);
  if (data.length > 0) {
    const absent = keys.find((key) => data.every((row) => !Object.hasOwn(row, key)));
    if (absent !== undefined) {
      throw new ChartCompositionError(
        "Chart.Root",
        "unknown-key",
        `has config key ${JSON.stringify(absent)}, which names no column of any row. Name a number column of the rows.`
      );
    }
  }
}

/** Whether an animation ends, so `finish()` can jump it to its end. */
function isFinite(animation: Animation): boolean {
  return Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Number.POSITIVE_INFINITY);
}

/**
 * The model's data issues grouped by rule and subject, each group's first issue with its count, in
 * the order the groups first appear.
 */
function issueGroups(issues: readonly ModelIssue[]) {
  const groups = new Map<ChartDataRule, Map<string, { readonly first: ModelIssue; count: number }>>();
  for (const issue of issues) {
    const subjects =
      groups.get(issue.rule) ?? new Map<string, { readonly first: ModelIssue; count: number }>();
    groups.set(issue.rule, subjects);
    const subject = dataSubject(issue);
    const group = subjects.get(subject);
    if (group === undefined) subjects.set(subject, { first: issue, count: 1 });
    else group.count += 1;
  }
  return [...groups].flatMap(([rule, subjects]) =>
    [...subjects].map(([subject, { first, count }]) => ({ rule, subject, first, count }))
  );
}

/** The active slot inside the effective window, which the followers draw. */
function activeSlot(snapshot: ChartSnapshot, model: CartesianModel): ActiveSlot {
  const window = model.window;
  const { active, near } = snapshot;
  if (window === null || active === null || active < window.first || active > window.last) return null;
  return { slot: active, near };
}

/**
 * Write the active state onto Root, where the dim rules read it. Only these attributes change on
 * enter and leave, so a pointer move restyles no mark.
 */
function markActive(root: HTMLElement, snapshot: ChartSnapshot, active: ActiveSlot): void {
  writeAttribute(root, "data-active", active === null ? null : (snapshot.source ?? ""));
  writeAttribute(root, "data-pinned", snapshot.pinned && active !== null ? "" : null);
  writeAttribute(root, "data-near", active !== null && snapshot.near !== null ? snapshot.near : null);
}

/** The reader's motion preference, which snaps every chart update. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Root's animation loop on the browser's frame clock. */
function browserMotion(reduced: boolean): ChartMotion {
  return createChartMotion(
    {
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (handle) => {
        cancelAnimationFrame(handle);
      },
    },
    reduced
  );
}

/**
 * The root of every cartesian chart, also exported as `AreaChart.Root`, `BarChart.Root` and
 * `LineChart.Root`. It reads the series from `config`, never from its children, and renders a
 * named `figure` that holds the description, the instructions, the plot's single tab stop, the
 * parts and the status region, in that order.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 * @beta
 */
export function ChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TXKey extends ChartXKey<TRow>,
>({
  data,
  config,
  xKey,
  xScale = "band",
  orientation = "vertical",
  stackOffset = "diverging",
  yBaseline = "zero",
  yInclude,
  xRange,
  defaultXRange,
  onXRangeChange: _onXRangeChange,
  onXRangeCommitted: _onXRangeCommitted,
  defaultActiveX,
  selectedKey,
  defaultSelectedKey,
  onSelectedKeyChange,
  interval,
  period,
  now,
  timeZone: ownZone,
  xFormat,
  description,
  children,
  style,
  ...figure
}: ChartRootProps<TRow, TConfig, TXKey>): ReactElement {
  const { locale, timeZone: providerZone } = useLocale();
  const timeZone = ownZone ?? providerZone;
  if (interval !== undefined && timeZone === undefined) {
    throw new ChartCompositionError(
      "Chart.Root",
      "time-axis-without-zone",
      'draws a time axis with no time zone. Pass timeZone on the Root or on LocaleProvider, the IANA zone of the data\'s market, such as "Europe/Oslo".'
    );
  }
  assertConfigFits(config, data);
  for (const [key, entry] of Object.entries(config)) {
    if (
      entry.interval !== undefined &&
      (interval === undefined || !intervalNests(interval, entry.interval))
    ) {
      throw new ChartCompositionError(
        "Chart.Root",
        "interval-not-nested",
        interval === undefined
          ? `has config ${JSON.stringify(key)} interval ${JSON.stringify(entry.interval)} on a category axis. A series interval needs Root's time axis, so pass interval on Chart.Root.`
          : `has config ${JSON.stringify(key)} interval ${JSON.stringify(entry.interval)}, which does not nest Root's ${JSON.stringify(interval)}. Root's interval is the finest in the chart, so give Root the finest one, and give a series an interval that holds whole Root slots.`
      );
    }
    if (
      entry.projectedFrom === undefined ||
      (interval !== undefined) !== (stringOf(entry.projectedFrom) !== undefined)
    ) {
      continue;
    }
    throw new ChartCompositionError(
      "Chart.Root",
      "x-type-mismatch",
      interval === undefined
        ? `received a Date or number as config ${JSON.stringify(key)} projectedFrom on a category axis. Pass the category string.`
        : `received a string as config ${JSON.stringify(key)} projectedFrom on a time axis. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day.`
    );
  }
  const nowInstant = now === undefined ? undefined : instantOf(now);
  const range = xRange ?? defaultXRange;
  // A range compares by value, part by part, so an inline xRange array that names the same slots
  // is no change, and no delimiter can make two different ranges look alike. yInclude, period and
  // config compare by value too, so a parent's re-render never reads as a data update that
  // restarts every tween, and never hands the parts a new context.
  const windowRange = useSteady(range, sameRange);
  const include = useSteady(yInclude, sameItems);
  const modelPeriod = useSteady(period, sameRange);
  const modelConfig = useSteady<ChartConfig>(config, sameConfig);
  const model = useMemo(
    () =>
      buildCartesianModel({
        rows: data,
        series: Object.entries(modelConfig).map(
          ([key, entry]) =>
            [
              key,
              {
                stack: entry.stack,
                qualityKey: entry.qualityKey,
                projectedFrom: entry.projectedFrom,
                interval: entry.interval,
              },
            ] as const
        ),
        xKey,
        time:
          interval === undefined || timeZone === undefined
            ? undefined
            : {
                interval,
                timeZone,
                period:
                  modelPeriod === undefined
                    ? undefined
                    : [instantOf(modelPeriod[0]), instantOf(modelPeriod[1])],
                now: nowInstant,
              },
        stackOffset,
        baseline: yBaseline,
        include: include ?? [],
        xRange: windowRange,
      }),
    [
      data,
      modelConfig,
      xKey,
      interval,
      timeZone,
      modelPeriod,
      nowInstant,
      stackOffset,
      yBaseline,
      include,
      windowRange,
    ]
  );
  const reduced = useMediaQuery(REDUCED_MOTION);
  const [motion] = useState(() => browserMotion(reduced));
  // The mounted Panels: the registry their effects write, and its snapshot in Panel order, which
  // renders. A Panel rule breaks only once the whole current tree has registered.
  const [registry] = useState(() => new Set<PanelEntry>());
  const [panels, setPanels] = useState<readonly PanelEntry[]>([]);
  const domains = useMemo(() => keyDomains(model, stackOffset, panels), [model, stackOffset, panels]);
  const colourRule = useMemo(
    () => colourFamilyError("Chart.Root", modelConfig, Object.keys(modelConfig)),
    [modelConfig]
  );
  // The mounted Bars, which register after they mount, so a data update knows which series draw bars.
  const [bars] = useState(
    () =>
      new Map<
        object,
        {
          readonly key: string;
          readonly grouped: boolean;
          readonly layout: FrameOwner;
        }
      >()
  );
  // Which kind of commit produced this model, and the keys its marks render under.
  const [seen, setSeen] = useState((): ChartCommit => {
    const keys = pairSlotKeys(null, model.domain);
    return {
      model,
      data,
      config: modelConfig,
      range: windowRange,
      update: {
        kind: "initial",
        keys: keys.keys,
        relays: false,
        from: domains,
        mounted: new Set(),
        gliding: new Set(),
        layouts: { relays: false, moved: new Set() },
      },
      keys,
      domains,
      moved: new Set(),
    };
  });
  let commit = seen;
  if (seen.model !== model || seen.domains !== domains) {
    const rangeOnly = seen.data === data && seen.config === modelConfig && seen.range !== windowRange;
    const keys = pairSlotKeys(seen.keys, model.domain);
    // A layout's marks draw between two value domains while a tween that set out from another runs,
    // unless a Panel relayed the update that started it, which snapped every mark.
    const running = motion.running() && !seen.update.layouts.relays;
    const gliding = running ? new Set([...seen.moved, ...seen.update.layouts.moved]) : new Set<string>();
    // A Panel computes its domain from inputs Root sees only once it registers, so each Panel
    // decides whether an update moves its own domain as it commits, through
    // `reportLayoutDomain`. Root decides for its default layout, and leaves the Panels' keys where
    // they drew.
    const panelKeys = new Set(panels.flatMap(({ layout }) => layout.keys));
    const own = new Map(domains);
    for (const key of panelKeys) own.set(key, seen.domains.get(key) ?? domains.get(key) ?? [0, 1]);
    const drawn = new Set([...bars.values()].map(({ key }) => key));
    const relays =
      !rangeOnly &&
      relaysPlot(
        { model: seen.model, keys: seen.update.keys, domains: seen.domains },
        { model, keys: keys.keys, domains: own },
        orientation,
        gliding,
        drawn
      );
    // Panels that register leave the model alone, and their first domains are no update.
    const registered = seen.model === model;
    commit = {
      model,
      data,
      config: modelConfig,
      range: windowRange,
      update: registered
        ? seen.update
        : {
            kind: rangeOnly ? "range" : "data",
            keys: keys.keys,
            relays,
            from: seen.domains,
            mounted: mountedSeries(
              { model: seen.model, keys: seen.update.keys },
              { model, keys: keys.keys },
              orientation,
              drawn
            ),
            gliding,
            layouts: { relays: false, moved: new Set() },
          },
      keys,
      domains,
      // A commit that snaps the marks lands them on its domains. One that only registers leaves the
      // running tweens alone, so their keys still glide. One that moves the marks adds the keys
      // whose domain it changes to those the tweens it interrupts still glide.
      moved:
        relays || rangeOnly
          ? new Set()
          : registered
            ? gliding
            : new Set([
                ...gliding,
                ...[...domains.keys()].filter(
                  (key) => !panelKeys.has(key) && !sameDomain(seen.domains, domains, key)
                ),
              ]),
    };
    setSeen(commit);
  }
  const firstIssue = model.issues[0];
  if (firstIssue !== undefined && isChartDevelopment()) {
    throw new ChartDataError("Chart.Root", firstIssue.rule, dataMessage(firstIssue, model.rowAt));
  }
  const warned = useRef(new Map<ChartDataRule | ChartHintRule, Set<string>>());
  // Each rule warns once per subject: a second absent column under the same rule warns too, a
  // thousand broken cells of one column warn once, and a render that repeats a problem stays quiet.
  const warnOnce = useCallback(
    (rule: ChartDataRule | ChartHintRule, subject: string, message: string): void => {
      const subjects = warned.current.get(rule) ?? new Set<string>();
      if (subjects.has(subject)) return;
      subjects.add(subject);
      warned.current.set(rule, subjects);
      console.warn(message);
    },
    []
  );
  useEffect(() => {
    for (const { rule, subject, first, count } of issueGroups(model.issues)) {
      warnOnce(rule, subject, `Chart.Root ${dataMessage(first, model.rowAt, count)}`);
    }
  }, [model.issues, model.rowAt, warnOnce]);

  const id = useId();
  const [store] = useState(() => {
    const slot = defaultActiveX === undefined ? -1 : slotOf(model.domain, defaultActiveX);
    return createChartStore(slot === -1 ? null : slot);
  });
  const rootRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  // Root's plot spans its Panels' plots, so their span is written before Root measures it.
  const placeSpan = usePanelSpan(frameRef, panels);
  const { plot, probe, reads, measure: measurePlot } = useMeasuredPlot(plotRef);
  // Under Panels the plot spans their plots, which the span's own layout effect just placed, so
  // the plot measures again once the span stands.
  const spans = panels.length > 0;
  useLayoutEffect(() => {
    if (spans) measurePlot();
  });
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    motion.setReduced(reduced);
  }, [motion, reduced]);
  const [followers] = useState(createChartFollowers);
  const [labels] = useState(createChartLabels);
  const [paths] = useState(createChartPaths);
  // The default layout's frame, which names its marks' tweens to the loop for the Root's life.
  const [owner] = useState(() => createFrameOwner("root"));
  // The active slot and series last painted, so a store change that moves neither paints nothing.
  const paintedRef = useRef<readonly [number | null, number | null]>([null, null]);
  useLayoutEffect(() => {
    const previous = modelRef.current;
    modelRef.current = model;
    const { active } = store.get();
    if (previous !== model && active !== null) {
      // The active slot keeps its x across new data, or gives way to the window's first slot.
      const window = model.window;
      const kept = window === null ? null : keepSlot(model.domain, window, slotX(previous.domain, active));
      paintedRef.current = [kept, store.get().near];
      store.set({ active: kept });
    }
    const slot = activeSlot(store.get(), model);
    if (rootRef.current) markActive(rootRef.current, store.get(), slot);
    // Each follower asks its own commit classifier how to reach the carried-over slot.
    followers.paint(slot, "commit");
  }, [model, store, followers, commit.update, plot, orientation]);
  // A range step applies every mark's geometry at once and cancels a running data update, the
  // tweens of the loop and the opacity fade of a bar that the update added alike. An update that
  // relays the plot ends every tween too, so no mark it leaves alone glides through the new ones.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (commit.update.relays) motion.finish();
    if (commit.update.kind !== "range" || root === null) return;
    motion.finish();
    for (const animation of root.getAnimations({ subtree: true }))
      if (isFinite(animation)) animation.finish();
  }, [commit.update, motion]);
  useLayoutEffect(
    () =>
      store.subscribe(() => {
        const snapshot = store.get();
        const slot = activeSlot(snapshot, modelRef.current);
        if (rootRef.current) markActive(rootRef.current, snapshot, slot);
        const [active, near] = paintedRef.current;
        if (snapshot.active === active && snapshot.near === near) return;
        paintedRef.current = [snapshot.active, snapshot.near];
        // A pointer or key step applies at once, so a follower never glides after the pointer.
        followers.paint(slot, "step");
      }),
    [store, followers]
  );
  // The plot first draws once the browser measures it, so marks of that commit run the entrance
  // and marks that mount later snap or fade in.
  const measured = plot !== null;
  useEffect(() => {
    if (measured) store.set({ phase: "mounted" });
  }, [store, measured]);

  const figureProps = definedProps(figure);
  const name = "aria-label" in figureProps ? figureProps["aria-label"] : undefined;
  const labelledBy = "aria-labelledby" in figureProps ? figureProps["aria-labelledby"] : undefined;
  const [ownSelected, setOwnSelected] = useState<string | null>(defaultSelectedKey ?? null);
  const requested = selectedKey === undefined ? ownSelected : selectedKey;
  // A key that names no config key acts as null, and Root calls no callback for it.
  const selected = requested !== null && Object.hasOwn(modelConfig, requested) ? requested : null;
  const strings = CHART_STRINGS[locale];
  // An inline xFormat object that names the same options is no change either.
  const steadyFormat = useSteady(xFormat, sameShallow);
  const text = useMemo(
    (): TextContext => ({ config: modelConfig, locale, model, xFormat: steadyFormat, now: nowInstant }),
    [modelConfig, locale, model, steadyFormat, nowInstant]
  );
  // What a selection reads when it happens, so `select` keeps one identity for the Root's life and
  // an inline `onSelectedKeyChange` never hands the parts a new context.
  const selection = useRef({ selected, onSelectedKeyChange, text });
  useLayoutEffect(() => {
    selection.current = { selected, onSelectedKeyChange, text };
  });
  const select = useCallback(
    (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined): void => {
      const latest = selection.current;
      if (key === latest.selected) return;
      setOwnSelected(key);
      // SAFETY: key is a config key or null, which is what TConfig's key union holds at runtime.
      latest.onSelectedKeyChange?.(key as (keyof TConfig & string) | null, { reason, event });
      const words = CHART_STRINGS[latest.text.locale];
      store.announce(
        key === null || !Object.hasOwn(latest.text.config, key)
          ? words.selectionCleared
          : words.selected(seriesLabel(latest.text, key).text)
      );
    },
    [store]
  );
  const toggleGroups = useRef(0);
  const registerToggleGroup = useCallback((): (() => void) => {
    toggleGroups.current += 1;
    return () => {
      toggleGroups.current -= 1;
    };
  }, []);
  const getRoot = useCallback((): HTMLElement | null => rootRef.current, []);
  const hasToggles = useCallback((): boolean => toggleGroups.current > 0, []);
  const highlight = useCallback(
    (key: string | null): void => {
      const root = rootRef.current;
      if (root === null) return;
      const seriesIndex = key === null ? -1 : Object.keys(modelConfig).indexOf(key);
      if (seriesIndex === -1) {
        root.removeAttribute("data-highlight");
        root.style.removeProperty("--chart-highlight");
      } else {
        root.setAttribute("data-highlight", "");
        root.style.setProperty("--chart-highlight", String(seriesIndex));
      }
    },
    [modelConfig]
  );
  const registerBar = useCallback(
    (key: string, grouped: boolean, layout: FrameOwner): (() => void) => {
      const token = {};
      bars.set(token, { key, grouped, layout });
      if (isChartDevelopment()) {
        // Bars in two Panels draw in two plots, so only loose Bars of one layout overlap.
        const loose = [...bars.values()]
          .filter((bar) => !bar.grouped && bar.layout === layout)
          .map((bar) => bar.key);
        const stackOf = new Map(Object.entries(modelConfig).map(([name, entry]) => [name, entry.stack]));
        const pair = loose.flatMap((first, index) =>
          loose
            .slice(index + 1)
            .filter((second) => second !== first)
            .filter(
              (second) => stackOf.get(first) === undefined || stackOf.get(first) !== stackOf.get(second)
            )
            .map((second) => [first, second] as const)
        )[0];
        if (pair !== undefined) {
          warnOnce(
            "bars-overlap",
            pair.join(" "),
            `Chart.Bar draws ${JSON.stringify(pair[0])} and ${JSON.stringify(pair[1])} over each other, because they sit outside a Chart.BarGroup and share no stack id. Wrap them in <Chart.BarGroup series={[…]}> to draw them side by side.`
          );
        }
      }
      return () => {
        bars.delete(token);
      };
    },
    [bars, modelConfig, warnOnce]
  );
  const drawsBar = useCallback(
    (key: string): boolean => [...bars.values()].some((bar) => bar.key === key),
    [bars]
  );
  const registerEmphasis = useCallback(
    (key: string, entry: EmphasisEntry): (() => void) => {
      store.set({ emphasis: { ...store.get().emphasis, [key]: entry } });
      return () => {
        store.set({
          emphasis: Object.fromEntries(Object.entries(store.get().emphasis).filter(([name]) => name !== key)),
        });
      };
    },
    [store]
  );
  // The plot parts that draw in the default layout. One beside a Panel breaks the Panel rules, and
  // a registration while Panels exist renders Root again, so its check below runs.
  const [rootParts] = useState(() => new Map<object, string>());
  const [rootPartsSeen, setRootPartsSeen] = useState(0);
  const registerRootPart = useCallback(
    (part: string): (() => void) => {
      const token = {};
      rootParts.set(token, part);
      if (registry.size > 0) setRootPartsSeen((count) => count + 1);
      return () => {
        rootParts.delete(token);
      };
    },
    [registry, rootParts]
  );
  const registerPanel = useCallback(
    (panel: PanelEntry): (() => void) => {
      // A Panel whose layout changes registers anew, so the list keeps the Panels' order on the page.
      registry.add(panel);
      setPanels([...registry].sort(inPageOrder));
      return () => {
        registry.delete(panel);
        setPanels([...registry].sort(inPageOrder));
      };
    },
    [registry, setPanels]
  );
  // Root's layout effects run after its Panels' in every commit, so the registry holds the current
  // tree's Panels, and an error thrown here reaches the error boundary as one thrown in render
  // does. A Panel whose server HTML hydrates later is on the page but not yet registered, and its
  // keys are unknown, so the rules wait for it.
  useLayoutEffect(() => {
    if (registry.size === 0) return;
    const [stray] = rootParts.values();
    if (stray !== undefined) throw partOutsidePanel(stray);
    const onPage =
      rootRef.current?.querySelectorAll(':scope > [data-slot="chart-frame"] > [data-slot="chart-panel"]')
        .length ?? 0;
    if (onPage > registry.size) return;
    const error = panelsError(modelConfig, [...registry]);
    if (error !== null) throw error;
  }, [modelConfig, panels, registry, rootParts, rootPartsSeen]);
  const intro = figureProps["data-intro"];
  const fade = figureProps["data-fade"];
  // Only a browser mount runs the entrance. The server and a hydrating Root read `false`.
  const entrance = useClientMount() && intro !== "none";
  const context = useMemo(
    (): ChartRootContextValue => ({
      config: modelConfig,
      locale,
      model,
      xFormat,
      now: nowInstant,
      xScale,
      orientation,
      stackOffset,
      baseline: yBaseline,
      store,
      id,
      name,
      select,
      registerToggleGroup,
      hasToggles,
      highlight,
      root: getRoot,
      rows: data,
      warnOnce,
      intro,
      entrance,
      fade,
      update: commit.update,
      motion,
      followers,
      paths,
      registerBar,
      drawsBar,
      registerEmphasis,
      registerPanel,
      registerRootPart,
      placeSpan,
      panels,
      domains,
      colourRule,
    }),
    [
      colourRule,
      placeSpan,
      registerPanel,
      registerRootPart,
      panels,
      domains,
      data,
      warnOnce,
      intro,
      entrance,
      fade,
      commit.update,
      motion,
      followers,
      paths,
      registerBar,
      drawsBar,
      registerEmphasis,
      modelConfig,
      locale,
      model,
      xFormat,
      nowInstant,
      xScale,
      orientation,
      stackOffset,
      yBaseline,
      store,
      id,
      name,
      select,
      registerToggleGroup,
      hasToggles,
      highlight,
      getRoot,
    ]
  );
  const layout = useMemo(
    (): ChartLayoutContextValue => ({
      kind: "root",
      keys: Object.keys(modelConfig),
      y: model.y,
      baseline: yBaseline,
      owner,
      labels,
    }),
    [modelConfig, model.y, yBaseline, owner, labels]
  );
  const slots = model.window === null ? 0 : model.window.last - model.window.first + 1;
  // The description reads every series over the window, so it waits for a change of what it says.
  const spokenDescription = useMemo(() => description ?? chartDescription(text), [description, text]);
  return (
    <ChartRootContext value={context}>
      <ChartSelectionContext value={selected}>
        <ChartLayoutContext value={layout}>
          <figure
            ref={rootRef}
            data-slot="chart"
            data-orientation={orientation}
            data-x-scale={xScale}
            data-selected={selected === null ? undefined : ""}
            style={{
              "--chart-selected": selected === null ? undefined : Object.keys(modelConfig).indexOf(selected),
              ...style,
            }}
            {...figureProps}>
            <p id={`${id}-description`} data-slot="chart-description">
              {spokenDescription}
            </p>
            <p id={`${id}-instructions`} data-slot="chart-instructions">
              {strings.instructionsCartesian}
            </p>
            <div ref={frameRef} data-slot="chart-frame" style={{ "--chart-slots": slots }}>
              <div ref={plotRef} data-slot="chart-plot" aria-hidden="true">
                {probe}
                {plot === null && !model.empty ? <PlotSkeleton /> : null}
              </div>
              <ChartRootPlotContext value={plot}>
                <ChartPlotContext value={plot}>
                  <PlotReadsContext value={reads}>
                    <ChartSurface name={name} labelledBy={labelledBy} />
                    {children}
                  </PlotReadsContext>
                </ChartPlotContext>
              </ChartRootPlotContext>
            </div>
            <ChartStatus />
          </figure>
        </ChartLayoutContext>
      </ChartSelectionContext>
    </ChartRootContext>
  );
}

Object.assign(ChartRoot, { displayName: "Chart.Root" });
