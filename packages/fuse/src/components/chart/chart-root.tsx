"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useMediaQuery } from "../../hooks/use-media-query";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { ChartLayoutContext, ChartRootContext } from "./chart-context";
import type { ChartLayoutContextValue, ChartRootContextValue, ChartUpdate } from "./chart-context";
import { createChartFollowers } from "./chart-followers";
import type { ActiveSlot } from "./chart-followers";
import { createChartLabels } from "./chart-labels";
import { createChartMotion } from "./chart-motion";
import type { ChartMotion } from "./chart-motion";
import { createChartPaths } from "./chart-paths";
import { ChartPlotContext, useMeasuredPlot } from "./chart-plot";
import { PlotSkeleton } from "./chart-skeleton";
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
import { buildCartesianModel } from "./layout/cartesian-model";
import type { CartesianModel, ModelIssue } from "./layout/cartesian-model";
import { ChartCompositionError, ChartDataError, DATA_MESSAGES, isChartDevelopment } from "./layout/errors";
import { relaysPlot } from "./layout/relay";
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

/** One commit's motion facts, kept across renders so the next commit can compare. */
type ChartCommit = {
  readonly model: CartesianModel;
  readonly data: unknown;
  readonly config: unknown;
  /** The steady range object, which changes only when the range names other values. */
  readonly range: unknown;
  readonly update: ChartUpdate;
  readonly keys: SlotKeys;
  /** The value domain the marks' running tweens set out from, the model's own once they rest. */
  readonly glidesFrom: readonly [number, number];
};

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

/** Whether two `yInclude` lists name the same values in the same order. */
function sameValues(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/** One field value of a series config. */
type ConfigField = ChartSeriesConfig[keyof ChartSeriesConfig];

/** A series config's fields in order. */
function fieldsOf(entry: ChartSeriesConfig): (readonly [string, ConfigField])[] {
  // SAFETY: Object.entries of a ChartSeriesConfig yields its own fields, each a ConfigField.
  return Object.entries(entry) as (readonly [string, ConfigField])[];
}

/** Whether two config field values match, one level deep, as an inline literal rebuilds them. */
function sameField(a: ConfigField, b: ConfigField): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  }
  if (a === undefined || b === undefined) return false;
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype)
    return false;
  const left = Object.entries(a);
  const right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, value], index) => right[index]?.[0] === key && Object.is(value, right[index][1]))
  );
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
        fields.every(([name, value]) => otherFields.has(name) && sameField(value, otherFields.get(name)))
      );
    })
  );
}

/** The roles of a colour, a list's every role. */
function rolesOf(color: ChartSeriesConfig["color"]): readonly string[] {
  return isRoleList(color) ? color : [color];
}

/** Whether a colour is a role list. */
function isRoleList(
  color: ChartSeriesConfig["color"]
): color is Extract<ChartSeriesConfig["color"], readonly unknown[]> {
  return Array.isArray(color);
}

/**
 * Throw for config that cannot draw: a key that names no column of any row, and one layout that
 * mixes a sentiment role with a categorical role, which D4 forbids.
 */
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
  const roles = Object.values(config).flatMap((entry) => rolesOf(entry.color));
  const sentiment = roles.some((role) => role.startsWith("chart-sentiment-"));
  const categorical = roles.some((role) => /^chart-\d$/u.test(role));
  if (sentiment && categorical) {
    throw new ChartCompositionError(
      "Chart.Root",
      "mixed-sentiment-categorical",
      "mixes a sentiment role with a categorical role in one layout. Colour every series of the layout by sentiment, or every series by category."
    );
  }
}

/** Whether an animation ends, so `finish()` can jump it to its end. */
function isFinite(animation: Animation): boolean {
  return Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Number.POSITIVE_INFINITY);
}

/** The first data issue a development build throws for. */
function dataError(issue: ModelIssue): ChartDataError {
  const where = "row" in issue ? `Row ${String(issue.row)}` : `Slot ${String(issue.slot)}`;
  const key = "key" in issue ? ` of ${JSON.stringify(issue.key)}` : "";
  return new ChartDataError("Chart.Root", issue.rule, `${DATA_MESSAGES[issue.rule]} ${where}${key}.`);
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
  const toggle = (name: string, value: string | null): void => {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  };
  toggle("data-active", active === null ? null : (snapshot.source ?? ""));
  toggle("data-pinned", snapshot.pinned && active !== null ? "" : null);
  toggle("data-near", active !== null && snapshot.near !== null ? String(snapshot.near) : null);
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
  // is no change, and no delimiter can make two different ranges look alike.
  const [steadyRange, setSteadyRange] = useState(range);
  let windowRange = steadyRange;
  if (steadyRange !== range && !sameRange(steadyRange, range)) {
    windowRange = range;
    setSteadyRange(range);
  }
  // yInclude and period compare by value too, so an inline array that names the same values is no
  // change, and a parent's re-render never reads as a data update that restarts every tween.
  const [steadyInclude, setSteadyInclude] = useState(yInclude);
  let include = steadyInclude;
  if (steadyInclude !== yInclude && !sameValues(steadyInclude, yInclude)) {
    include = yInclude;
    setSteadyInclude(yInclude);
  }
  const [steadyPeriod, setSteadyPeriod] = useState(period);
  let modelPeriod = steadyPeriod;
  if (steadyPeriod !== period && !sameRange(steadyPeriod, period)) {
    modelPeriod = period;
    setSteadyPeriod(period);
  }
  const [steadyConfig, setSteadyConfig] = useState<ChartConfig>(config);
  let modelConfig = steadyConfig;
  if (steadyConfig !== config && !sameConfig(steadyConfig, config)) {
    modelConfig = config;
    setSteadyConfig(config);
  }
  const model = useMemo(
    () =>
      buildCartesianModel({
        rows: data,
        series: Object.entries(modelConfig).map(
          ([key, entry]) =>
            [
              key,
              { stack: entry.stack, qualityKey: entry.qualityKey, projectedFrom: entry.projectedFrom },
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
  // The mounted Bars, which register after they mount, so a data update knows which series draw bars.
  const [bars] = useState(() => new Map<object, { readonly key: string; readonly grouped: boolean }>());
  // Which kind of commit produced this model, and the keys its marks render under.
  const [seen, setSeen] = useState((): ChartCommit => {
    const keys = pairSlotKeys(null, model.domain);
    return {
      model,
      data,
      config: modelConfig,
      range: windowRange,
      update: { kind: "initial", keys: keys.keys, relays: false },
      keys,
      glidesFrom: model.y.domain,
    };
  });
  let commit = seen;
  if (seen.model !== model) {
    const rangeOnly = seen.data === data && seen.config === modelConfig && seen.range !== windowRange;
    const keys = pairSlotKeys(seen.keys, model.domain);
    // The marks draw between two value domains while a tween that set out from another runs.
    const running = motion.running();
    const [low, high] = seen.model.y.domain;
    const gliding = running && (seen.glidesFrom[0] !== low || seen.glidesFrom[1] !== high);
    const relays =
      !rangeOnly &&
      relaysPlot(
        { model: seen.model, keys: seen.update.keys },
        { model, keys: keys.keys },
        orientation,
        gliding,
        new Set([...bars.values()].map(({ key }) => key))
      );
    commit = {
      model,
      data,
      config: modelConfig,
      range: windowRange,
      update: { kind: rangeOnly ? "range" : "data", keys: keys.keys, relays },
      keys,
      // A commit that snaps the marks lands them on its domain, and one that moves them sets out
      // from where they rest, or from where the tweens they interrupt set out.
      glidesFrom: relays || rangeOnly ? model.y.domain : running ? seen.glidesFrom : seen.model.y.domain,
    };
    setSeen(commit);
  }
  const firstIssue = model.issues[0];
  if (firstIssue !== undefined && isChartDevelopment()) throw dataError(firstIssue);
  const warned = useRef(new Set<string>());
  useEffect(() => {
    for (const issue of model.issues) {
      if (warned.current.has(issue.rule)) continue;
      warned.current.add(issue.rule);
      console.warn(dataError(issue).message);
    }
  }, [model.issues]);

  const id = useId();
  const [store] = useState(() => {
    const slot = defaultActiveX === undefined ? -1 : slotOf(model.domain, defaultActiveX);
    return createChartStore(slot === -1 ? null : slot);
  });
  const rootRef = useRef<HTMLElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const plot = useMeasuredPlot(plotRef);
  const modelRef = useRef(model);
  useLayoutEffect(() => {
    motion.setReduced(reduced);
  }, [motion, reduced]);
  const [followers] = useState(createChartFollowers);
  const [labels] = useState(createChartLabels);
  const [paths] = useState(createChartPaths);
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
  const selected = requested !== null && Object.hasOwn(config, requested) ? requested : null;
  const strings = CHART_STRINGS[locale];
  const text = useMemo(
    (): TextContext => ({ config, locale, model, xFormat, now: nowInstant }),
    [config, locale, model, xFormat, nowInstant]
  );
  const selectedRef = useRef(selected);
  useLayoutEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const select = useCallback(
    (key: string | null, reason: ChartSelectionChangeReason, event: Event | undefined): void => {
      if (key === selectedRef.current) return;
      setOwnSelected(key);
      // SAFETY: key is a config key or null, which is what TConfig's key union holds at runtime.
      onSelectedKeyChange?.(key as (keyof TConfig & string) | null, { reason, event });
      store.announce(
        key === null || !Object.hasOwn(config, key)
          ? strings.selectionCleared
          : strings.selected(seriesLabel(text, key).text)
      );
    },
    [config, onSelectedKeyChange, store, strings, text]
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
      const seriesIndex = key === null ? -1 : Object.keys(config).indexOf(key);
      if (seriesIndex === -1) {
        root.removeAttribute("data-highlight");
        root.style.removeProperty("--chart-highlight");
      } else {
        root.setAttribute("data-highlight", "");
        root.style.setProperty("--chart-highlight", String(seriesIndex));
      }
    },
    [config]
  );
  const overlapWarned = useRef(false);
  const registerBar = useCallback(
    (key: string, grouped: boolean): (() => void) => {
      const token = {};
      bars.set(token, { key, grouped });
      if (isChartDevelopment() && !overlapWarned.current) {
        const loose = [...bars.values()].filter((bar) => !bar.grouped).map((bar) => bar.key);
        const stackOf = new Map(Object.entries(config).map(([name, entry]) => [name, entry.stack]));
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
          overlapWarned.current = true;
          console.warn(
            `Chart.Bar draws ${JSON.stringify(pair[0])} and ${JSON.stringify(pair[1])} over each other, because they sit outside a Chart.BarGroup and share no stack id. Wrap them in <Chart.BarGroup series={[…]}> to draw them side by side.`
          );
        }
      }
      return () => {
        bars.delete(token);
      };
    },
    [bars, config]
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
  const warnOnce = useCallback((rule: string, message: string): void => {
    if (warned.current.has(rule)) return;
    warned.current.add(rule);
    console.warn(message);
  }, []);
  const intro = figureProps["data-intro"];
  const fade = figureProps["data-fade"];
  // Only a browser mount runs the entrance. The server and a hydrating Root read `false`.
  const entrance = useClientMount() && intro !== "none";
  const context = useMemo(
    (): ChartRootContextValue => ({
      config,
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
      selectedKey: selected,
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
      labels,
      paths,
      registerBar,
      drawsBar,
      registerEmphasis,
    }),
    [
      data,
      warnOnce,
      intro,
      entrance,
      fade,
      commit,
      motion,
      followers,
      labels,
      paths,
      registerBar,
      drawsBar,
      registerEmphasis,
      config,
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
      selected,
      select,
      registerToggleGroup,
      hasToggles,
      highlight,
      getRoot,
    ]
  );
  const layout = useMemo(
    (): ChartLayoutContextValue => ({ keys: Object.keys(config), y: model.y, baseline: yBaseline }),
    [config, model.y, yBaseline]
  );
  const slots = model.window === null ? 0 : model.window.last - model.window.first + 1;
  return (
    <ChartRootContext value={context}>
      <ChartLayoutContext value={layout}>
        <figure
          ref={rootRef}
          data-slot="chart"
          data-orientation={orientation}
          data-x-scale={xScale}
          data-selected={selected === null ? undefined : ""}
          style={{
            "--chart-selected": selected === null ? undefined : Object.keys(config).indexOf(selected),
            ...style,
          }}
          {...figureProps}>
          <p id={`${id}-description`} data-slot="chart-description">
            {description ?? chartDescription(text)}
          </p>
          <p id={`${id}-instructions`} data-slot="chart-instructions">
            {strings.instructionsCartesian}
          </p>
          <div data-slot="chart-frame" style={{ "--chart-slots": slots }}>
            <div ref={plotRef} data-slot="chart-plot" aria-hidden="true">
              {plot === null && !model.empty ? <PlotSkeleton /> : null}
            </div>
            <ChartPlotContext value={plot}>
              <ChartSurface name={name} labelledBy={labelledBy} />
              {children}
            </ChartPlotContext>
          </div>
          <ChartStatus />
        </figure>
      </ChartLayoutContext>
    </ChartRootContext>
  );
}

Object.assign(ChartRoot, { displayName: "Chart.Root" });
