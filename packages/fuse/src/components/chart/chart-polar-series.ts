"use client";

import { countOf } from "../../intl/count-of";
/**
 * The series adapter, which Radar and ClockChart read their Roots through. It builds a
 * `CartesianModel` over the family's own domain, a category per spoke here, and reuses the
 * cartesian series readout as it is: an index is a spoke, the legend lists the config keys, the
 * tooltip lists every series at the active spoke, and the option names every series or the focused
 * one, in the cartesian grammar. It reads no plot geometry.
 */
import type { SupportedLocale } from "../../intl/locale-context";
import type { PolarIssue, PolarKernel, PolarModel } from "./chart-polar-context";
import type { ChartReadout } from "./chart-readout-port";
import { seriesReadoutOf } from "./chart-series-readout";
import { extremesSentence, optionName, slotLabel } from "./chart-text";
import type { SlotReading, TextContext } from "./chart-text";
import type { ChartConfig, ChartRow } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { POLAR_STRINGS } from "./format/polar-strings";
import type { CartesianModel } from "./layout/cartesian-model";
import { isRoleList, seriesPaint, singleRole } from "./layout/color-key";
import { nearestHeld } from "./layout/near-series";
import { pointerAngle } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { radarDomain, radarRadius, radarVertices, spokeAngle, spokeAt } from "./layout/radar";

/** The most series a radar compares, CONTRACT section 8.4's cap. */
export const RADAR_SERIES_CAP = 4;

/** What a radar model reads from its Root. */
export type RadarInput = {
  readonly model: CartesianModel;
  readonly config: ChartConfig;
  readonly rows: readonly ChartRow[];
  readonly locale: SupportedLocale;
  readonly sweep: Sweep;
  /** Root's `max`, or undefined. */
  readonly max: number | undefined;
  /** Root's `aria-label`, which the table's caption reads. */
  readonly name: string | undefined;
  /** The data rules the Root's rows broke, which production warns once each. */
  readonly issues: readonly PolarIssue[];
  /**
   * The Root's whole config, which a part's dataKey must name. `config` holds the series it draws,
   * the first `RADAR_SERIES_CAP` keys past the cap.
   */
  readonly known: ChartConfig;
};

/** The spoken extremes of each series, the radar description's sentences after its opening. */
function seriesSentences(context: TextContext): string[] {
  return context.model.series.flatMap(({ key, readings }) => {
    let low: SlotReading | null = null;
    let high: SlotReading | null = null;
    for (const [slot, reading] of readings.entries()) {
      if (reading.kind !== "reading") continue;
      if (low === null || reading.value < low.value) low = { slot, value: reading.value };
      if (high === null || reading.value > high.value) high = { slot, value: reading.value };
    }
    return low === null || high === null ? [] : [extremesSentence(context, key, low, high)];
  });
}

/**
 * A radar's model: one spoke per category, the series as polygons over a radius domain that never
 * clamps a reading, with the cartesian option grammar, the description, the pick by nearest spoke
 * and then nearest vertex, and the series table.
 *
 * @param input - The Root's cartesian model over its spokes, config, rows and props.
 * @returns The model.
 */
export function radarModel(input: RadarInput): PolarModel {
  const { model, config, locale, sweep } = input;
  const context: TextContext = { config, locale, model, xFormat: undefined, now: undefined };
  const strings = CHART_STRINGS[locale];
  const polarStrings = POLAR_STRINGS[locale];
  const count = model.domain.kind === "category" ? model.domain.names.length : 0;
  const values = model.series.flatMap(({ readings }) =>
    readings.flatMap((reading) => (reading.kind === "reading" ? [reading.value] : []))
  );
  const { domain, ticks } = radarDomain(values, input.max);
  const radius = radarRadius(domain, 1);
  const vertices = model.series.map(({ readings }) =>
    radarVertices(
      readings.map((reading) => (reading.kind === "reading" ? reading.value : null)),
      radius
    )
  );
  const keys = model.domain.kind === "category" ? model.domain.names : [];
  const empty = model.empty;
  return {
    family: "radar",
    sweep,
    count,
    keys,
    empty,
    description: empty
      ? `${strings.noData}.`
      : [
          polarStrings.descriptionRadar(
            countOf(locale, model.series.length, polarStrings.seriesWord),
            countOf(locale, count, strings.slots.category)
          ),
          ...seriesSentences(context),
        ].join(" "),
    instructions: "cartesian",
    orientation: "horizontal",
    wrap: true,
    series: model.series.length,
    page: null,
    optionName: (index, focus, order) => optionName(context, index, focus, order),
    pick: (point, pixels) => {
      // Distance from the centre changes nothing, as R6 says.
      if (count === 0) return null;
      const spoke = spokeAt(pointerAngle(point.x, point.y), count);
      // The nearest series' vertex on the spoke, keeping the held series unless another is clearly
      // nearer.
      const gaps = vertices.map((series) => {
        const vertex = series[spoke] ?? null;
        return vertex === null ? null : Math.hypot(vertex.x - point.x, vertex.y - point.y);
      });
      const near =
        model.series.length > 1 ? nearestHeld(gaps, pixels.near ?? null, pixels.nearFirm === true) : null;
      return { slot: spoke, near };
    },
    ray: (index) => (index < 0 || index >= count ? null : { angle: spokeAngle(index, count), radius: 1 }),
    selectKey: (_index, focus) => model.series[focus]?.key ?? null,
    selectable: Object.keys(config),
    table: { kind: "series", context: { ...context, name: input.name, rows: input.rows }, keys },
    readout: (kernel) => seriesReadout(context, kernel, input.known),
    issues: input.issues,
    drawing: {
      kind: "radar",
      radar: {
        count,
        labels: keys.map((_, index) => slotLabel(context, index)),
        domain,
        ticks,
        zero: domain[0] < 0 ? radius(0) : null,
        series: model.series.map(({ key, readings }, index) => {
          const color = config[key]?.color;
          return {
            key,
            index,
            paint: seriesPaint(key, singleRole(color)),
            stops:
              color !== undefined && isRoleList(color)
                ? color.map((stop) => seriesPaint(key, stop))
                : undefined,
            values: readings.map((reading) => (reading.kind === "reading" ? reading.value : null)),
            qualities: readings.map((reading) =>
              reading.kind === "missing"
                ? "missing"
                : reading.kind === "reading" && reading.quality !== "measured"
                  ? reading.quality
                  : undefined
            ),
          };
        }),
        format: config[model.series[0]?.key ?? ""]?.format ?? {},
      },
    },
  };
}

/**
 * A series family's readout, a radar's or a clock's: the shared series readout over the family's
 * slots, through the polar Root's kernel.
 *
 * @param context - The family's series model and words.
 * @param kernel - The polar Root's kernel.
 * @param known - The config a part's dataKey must name, the context's own by default.
 * @returns The readout.
 */
export function seriesReadout(
  context: TextContext,
  kernel: PolarKernel,
  known: ChartConfig = context.config
): ChartReadout {
  return seriesReadoutOf(
    context,
    {
      id: kernel.id,
      root: kernel.root,
      store: kernel.store,
      followers: kernel.followers,
      select: kernel.select,
      registerToggleGroup: kernel.registerToggleGroup,
      highlight: kernel.highlight,
      warnOnce: kernel.warnOnce,
      usePick: kernel.usePick,
    },
    { known }
  );
}
