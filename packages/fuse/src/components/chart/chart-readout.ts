"use client";

/**
 * How the shared readout parts read their Root: the hooks over the Root's readout port, which give
 * every part the same active index and key the option names. The contexts that say where a part
 * sits live in `chart-scope-contexts`, which every Root's own scope resets. A template row supplies
 * its own key. The module reads
 * no family's model, so a family's route ships only its own.
 */
import { use } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { ChartReadoutContext } from "./chart-readout-port";
import type { ChartReadout } from "./chart-readout-port";
import { ChartLegendSideContext, ChartLiveContext, ChartRowContext } from "./chart-scope-contexts";
import { useChartStore } from "./chart-store";
import type { ChartFractionDigits, ChartThresholdSide } from "./chart-types";
import { formatValue } from "./format/value-format";
import { ChartCompositionError } from "./layout/errors";

/**
 * The threshold side a Swatch or a SeriesLabel of one series shows: its legend entry's side, or
 * null outside a threshold series' legend entry and for a part that shows another series. It
 * compares the part's key with the entry's own key, never the nearest row's, so a row of another
 * series nested inside the entry keeps that series' paint and label.
 *
 * @param key - The series the part shows, or null.
 * @returns The side, or null.
 */
export function useLegendSide(key: string | null): ChartThresholdSide | null {
  const entry = use(ChartLegendSideContext);
  return entry?.key === key ? entry.side : null;
}

/**
 * Read the enclosing Root's readout.
 *
 * @param part - The calling part's display name, which the error names.
 * @returns The Root's readout.
 * @throws {ChartCompositionError} `part-outside-root` when no Root with a readout encloses the part.
 */
export function useChartReadout(part: string): ChartReadout {
  const readout = use(ChartReadoutContext);
  if (readout === null) {
    throw new ChartCompositionError(
      part,
      "part-outside-root",
      "must be used within Chart.Root. Wrap the chart's parts in Chart.Root, or in BarChart.Root, AreaChart.Root or LineChart.Root."
    );
  }
  return readout;
}

/**
 * The key a readout part prints: its own `dataKey`, else its template row's, else the active
 * point's nearest or focused key. An explicit `dataKey` must name a config key.
 *
 * @param part - The part's display name, which the error names.
 * @param readout - The Root's readout.
 * @param own - The part's `dataKey`.
 * @param near - The active point's key, or null under "all series".
 * @returns The key, or null when none applies.
 * @throws {ChartCompositionError} `unknown-key` for an explicit key the config lacks.
 */
export function useReadoutKey(
  part: string,
  readout: ChartReadout,
  own: string | undefined,
  near: string | null
): string | null {
  const row = use(ChartRowContext);
  if (own !== undefined) readout.assertKey(part, own);
  return own ?? row ?? near;
}

/**
 * The active index inside the readout's window, or null, for a part that prints no key. It never
 * renders when the pointer moves between series inside one slot. Outside a live scope it reads null
 * and never renders on a pointer move.
 *
 * @param readout - The Root's readout.
 * @param live - Whether to follow the store, which forces it on for parts such as LegendValue.
 * @returns The active index.
 */
export function useActiveIndex(readout: ChartReadout, live?: boolean): number | null {
  const scoped = use(ChartLiveContext);
  const follow = live ?? scoped;
  const active = useChartStore(readout.store, (snapshot) => (follow ? snapshot.active : null));
  const window = readout.window;
  return active !== null && window !== null && active >= window.first && active <= window.last
    ? active
    : null;
}

/** The active index and the key a readout part prints there, each null when there is none. */
export type ActiveItem = { readonly index: number | null; readonly key: string | null };

/**
 * The active index inside the readout's window and the nearest or focused key there, or null.
 * Outside a live scope it reads null and never renders on a pointer move. A part that prints no key
 * reads `useActiveIndex`.
 *
 * @param readout - The Root's readout.
 * @param live - Whether to follow the store, which forces it on for parts such as LegendValue.
 * @returns The active index and its key.
 */
export function useActiveItem(readout: ChartReadout, live?: boolean): ActiveItem {
  const scoped = use(ChartLiveContext);
  const follow = live ?? scoped;
  const index = useActiveIndex(readout, follow);
  const near = useChartStore(readout.store, (snapshot) => (follow ? snapshot.near : null));
  return { index, key: readout.pointKey(index, near) };
}

/**
 * A share as a percentage at the format's digits, or the dictionary dash.
 *
 * @param locale - The Root's locale.
 * @param share - The share in percent, or null for a zero denominator.
 * @param format - The share's digits.
 * @returns The visual text.
 */
export function shareText(
  locale: SupportedLocale,
  share: number | null,
  format: ChartFractionDigits | undefined
): string {
  if (share === null) return "–";
  return formatValue(
    locale,
    share / 100,
    {
      style: "percent",
      minimumFractionDigits: format?.minimumFractionDigits ?? 0,
      maximumFractionDigits: shareDigits(format),
    },
    "full"
  ).text;
}

/**
 * The share digits of a format, which decide how a share set rounds together.
 *
 * @param format - The share's digits.
 * @returns The fraction digits of the printed percentage.
 */
export function shareDigits(format: ChartFractionDigits | undefined): number {
  return format?.maximumFractionDigits ?? format?.minimumFractionDigits ?? 0;
}
