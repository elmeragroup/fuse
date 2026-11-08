"use client";

/**
 * A clock's model: the series adapter over the zoned time domain of one cycle. Each slot takes an
 * equal angle (D11) from the cycle's start at 12 o'clock (D12), each value its radius under the
 * Root's scale (D13), and each series its numbers at rest, which its marks tween from. The readout,
 * the option grammar, the description and the table are the cartesian series ones, and the pick is
 * by angle, then by the nearest series' tip. It reads no plot geometry.
 */
import type { SupportedLocale } from "../../intl/locale-context";
import { seriesPaintOf } from "./chart-paint";
import type { ClockDrawing, ClockSeries, PolarIssue, PolarModel } from "./chart-polar-context";
import { seriesReadout } from "./chart-polar-series";
import { chartDescription, optionName } from "./chart-text";
import type { TextContext } from "./chart-text";
import type { ChartConfig, ChartRow, XFormat } from "./chart-types";
import { countOf } from "./format/chart-strings";
import { POLAR_STRINGS } from "./format/polar-strings";
import { formatSlot, wallTimes } from "./format/time-format";
import type { CartesianModel } from "./layout/cartesian-model";
import { clockRadius, instantAngle, slotAngles } from "./layout/clock";
import type { ClockCycle, RadiusScale } from "./layout/clock";
import { clockLabelSlots, clockTier, fitClockLabels, pageSlot } from "./layout/clock-labels";
import { ownerSlot } from "./layout/clock-path";
import { isRoleList } from "./layout/color-key";
import { labelWidth } from "./layout/label-width";
import { nearestHeld } from "./layout/near-series";
import { pointerAngle, sweepOf } from "./layout/polar-angle";
import { slotOf } from "./layout/x-domain";

/** The radius a spoke label sits at, as a share of the outer radius. */
const CLOCK_LABEL_REACH = 1.1;

/** What a clock model reads from its Root. */
export type ClockInput = {
  readonly model: CartesianModel;
  readonly config: ChartConfig;
  readonly rows: readonly ChartRow[];
  readonly locale: SupportedLocale;
  readonly timeZone: string;
  readonly cycle: ClockCycle;
  /** The hole's radius as a share of the outer radius. */
  readonly inner: number;
  readonly scale: RadiusScale;
  readonly now: number | undefined;
  readonly xFormat: XFormat | undefined;
  /** Root's `aria-label`, which the table's caption reads. */
  readonly name: string | undefined;
  readonly issues: readonly PolarIssue[];
  /** How stacks combine, which decides whether a path may paint by value. */
  readonly stackOffset: "diverging" | "expand";
  /** Root's `yBaseline`: "zero" keeps 0 in the domain, which a Column and an Area need. */
  readonly baseline: "zero" | "none";
};

/** A series' numbers at rest and what its slots hold. */
function clockSeries(
  context: TextContext,
  key: string,
  count: number,
  radius: (value: number) => number,
  inner: number
): ClockSeries | null {
  const { model, config } = context;
  const series = model.series.find((entry) => entry.key === key);
  if (series === undefined) return null;
  const color = config[key]?.color ?? "chart-1";
  const paint = seriesPaintOf(key, color, series);
  const rest: number[] = [1];
  const states: ("reading" | "missing" | "pending" | "covered")[] = [];
  const marked: boolean[] = [];
  const values: (number | null)[] = [];
  const stepAt: number[] = [];
  // A base or a tip outside the domain stays inside the hole's edge, as a bar stays inside its plot.
  const placed = (value: number): number => Math.max(inner, radius(value));
  for (let slot = 0; slot < count; slot += 1) {
    // A coarse slot draws once, from its first Root slot across every Root slot it holds.
    const first = series.coarse?.first[slot] ?? slot;
    const last = series.coarse?.last[slot] ?? slot;
    const { start } = slotAngles(first, count);
    const { end } = slotAngles(last, count);
    const reading = series.readings[slot];
    const extent = series.extents[slot] ?? null;
    let base = placed(0);
    let tip = base;
    if (reading?.kind === "reading" && extent !== null) {
      const [low, high] = extent;
      [base, tip] = reading.value < 0 ? [placed(high), placed(low)] : [placed(low), placed(high)];
    }
    rest.push(start, end, base, tip);
    states.push(first === slot ? (reading?.kind ?? "pending") : "covered");
    marked.push(
      (reading?.kind === "reading" && reading.quality === "estimated") ||
        (reading?.kind === "reading" && slot >= series.projectedFrom)
    );
    const value = reading?.kind === "reading" ? reading.value : null;
    values.push(value);
    stepAt.push(value === null || paint.bins === undefined ? 0 : paint.bins(value) - 1);
  }
  const ramp = paint.ramp;
  const steps =
    ramp === undefined
      ? null
      : ramp.map((step, index) => ({
          paint: step,
          from: index === 0 ? 0 : Math.max(0, radius(paint.edges[index - 1] ?? 0)),
        }));
  const missing = config[key]?.missing ?? "gap";
  return {
    key,
    index: series.seriesIndex,
    paint: paint.base,
    stops: isRoleList(color) ? paint.stops : undefined,
    steps,
    stepAt,
    stack: series.stack,
    slots: { states, marked, missing },
    rest,
    values,
    shown: Array.from({ length: count }, (_, slot) => slot),
  };
}

/** The cycle's labels, printed and fitted, and the fit for texts of a format of its own. */
function labelsOf(
  starts: readonly number[],
  timeZone: string,
  cycle: ClockCycle,
  locale: SupportedLocale
): Pick<ClockDrawing, "labels" | "fitLabels"> {
  const tier = clockTier(cycle);
  const slots = clockLabelSlots(starts, timeZone, cycle);
  const fitLabels = (texts: readonly string[]) =>
    fitClockLabels(
      slots,
      texts.map((text) => labelWidth(text)),
      cycle,
      CLOCK_LABEL_REACH
    );
  const texts = slots.map(({ slot }) =>
    formatSlot(locale, timeZone, starts[slot] ?? 0, tier.unit, tier.preset, "tick")
  );
  const shown = fitLabels(texts.map(({ text }) => text));
  const labels = slots.map(({ slot, angle }, index) => ({
    angle,
    start: starts[slot] ?? 0,
    unit: tier.unit,
    text: texts[index] ?? { text: "", spoken: "" },
    visibility: shown[index] ?? "none",
  }));
  return { labels, fitLabels };
}

/**
 * A clock's model.
 *
 * @param input - The Root's cartesian model over the cycle's slots, its config, rows and props.
 * @returns The model.
 */
export function clockModel(input: ClockInput): PolarModel {
  const { model, config, locale, timeZone, cycle, inner, scale } = input;
  const context: TextContext = { config, locale, model, xFormat: input.xFormat, now: input.now };
  const starts = model.domain.kind === "time" ? model.domain.starts : [];
  const ends = model.domain.kind === "time" ? model.domain.ends : [];
  const count = starts.length;
  const { domain, ticks } = model.y;
  const radius = clockRadius({ inner, outer: 1, domain, scale });
  const series = model.series.flatMap(({ key }) => clockSeries(context, key, count, radius, inner) ?? []);
  const nowSlot = input.now === undefined ? -1 : slotOf(model.domain, input.now);
  const now =
    nowSlot === -1 || input.now === undefined
      ? null
      : {
          slot: nowSlot,
          angle: instantAngle(
            nowSlot,
            (input.now - (starts[nowSlot] ?? 0)) / ((ends[nowSlot] ?? 1) - (starts[nowSlot] ?? 0) || 1),
            count
          ),
        };
  const walls = wallTimes(starts, timeZone);
  const seen = new Set<string>();
  const pairs = walls.map((wall) => {
    const offset = String(wall - (walls[0] ?? 0));
    const key = seen.has(offset) ? `${offset}#2` : offset;
    seen.add(offset);
    return key;
  });
  const clock: ClockDrawing = {
    count,
    starts,
    pairs,
    inner,
    scale,
    domain,
    ticks,
    radius,
    zero: domain[0] < 0 && domain[1] > 0 ? radius(0) : null,
    series,
    ...labelsOf(starts, timeZone, cycle, locale),
    now,
    format: config[model.series[0]?.key ?? ""]?.format ?? {},
    stackOffset: input.stackOffset,
    baseline: input.baseline,
    text: context,
    slotOf: (x) => slotOf(model.domain, x),
  };
  const keys = starts.map((start) => String(start));
  const polarStrings = POLAR_STRINGS[locale];
  const empty = model.empty;
  return {
    family: "clock",
    sweep: sweepOf(0, 360),
    count,
    keys,
    empty,
    description: empty
      ? chartDescription(context)
      : `${polarStrings.descriptionClock(countOf(locale, model.series.length, polarStrings.seriesWord))} ${chartDescription(context)}`,
    instructions: "clock",
    orientation: "horizontal",
    wrap: true,
    series: model.series.length,
    page: (index, direction) => pageSlot(starts, timeZone, cycle, index, direction),
    optionName: (index, focus, order, emphasis) => optionName(context, index, focus, order, emphasis),
    pick: (point, pixels) => {
      if (count === 0) return null;
      const slot = Math.min(count - 1, Math.floor((pointerAngle(point.x, point.y) / 360) * count));
      if (series.length < 2) return { slot, near: null };
      // The nearest series by its tip's radius at the slot, skipping a series with no reading there,
      // and keeping the held series unless another is clearly nearer. A coarse series
      // reads at every slot it covers, through the slot that owns its reading.
      const distance = Math.hypot(point.x, point.y);
      const gaps = series.map((entry) => {
        const own = ownerSlot(entry.slots.states, slot);
        if (entry.slots.states[own] !== "reading") return null;
        return Math.abs((entry.rest[1 + own * 4 + 3] ?? 0) - distance);
      });
      return { slot, near: nearestHeld(gaps, pixels.near ?? null, pixels.nearFirm === true) };
    },
    ray: (index) =>
      index < 0 || index >= count ? null : { angle: slotAngles(index, count).centre, radius: 1 },
    selectKey: (_index, focus) => model.series[focus]?.key ?? null,
    selectable: Object.keys(config),
    table: { kind: "series", context: { ...context, name: input.name, rows: input.rows }, keys },
    readout: (kernel) => seriesReadout(context, kernel),
    issues: input.issues,
    drawing: { kind: "clock", clock },
  };
}
