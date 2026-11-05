"use client";

/**
 * The pie's Track and the text in its hole (CONTRACT section 8.13). The Track draws the whole sweep
 * behind the slices, which a gauge fills only to its total's share. The Center lays its parts in
 * the square inscribed in the hole, and each part prints the active slice's number, or with nothing
 * active the pie's own: the total, a gauge's share of its maximum, or the maximum. A part with
 * nothing to print renders an empty element, so the text around it still lays out. The numbers
 * roll their digits (S3). The Center is plot output, hidden from readers, who read the same numbers
 * from the options.
 */
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { ChartDigitRoll } from "./chart-digit-roll";
import { viewBoxOf } from "./chart-pie-frame";
import { pieDrawingOf, usePolarContext } from "./chart-polar-context";
import type { PieDrawing } from "./chart-polar-context";
import { shareDigits, shareText } from "./chart-readout";
import { useChartStore } from "./chart-store";
import type { ChartFractionDigits, ChartLayerProps, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { formatValue } from "./format/value-format";
import { arcPath } from "./layout/arc-path";

/**
 * Props for `PieChart.Track`, a closed part.
 *
 * @beta
 */
export type PieChartTrackProps = ChartLayerProps;

/**
 * Props for `PieChart.Center`, a closed part.
 *
 * @beta
 */
export type PieChartCenterProps = ChartLayerProps & {
  /** The centre's content, such as `CenterValue` over a `CenterLabel`. */
  children?: ReactNode;
};

/**
 * Props for `PieChart.CenterValue`, a closed part.
 *
 * @beta
 */
export type PieChartCenterValueProps = ChartLayerProps & {
  /** The value format. The category's config `format`, then Root's `valueFormat`, is the default. */
  format?: ValueFormat;
};

/**
 * Props for `PieChart.CenterShare`, a closed part.
 *
 * @beta
 */
export type PieChartCenterShareProps = ChartLayerProps & {
  /** The percentage digits. */
  format?: ChartFractionDigits;
};

/**
 * Props for `PieChart.CenterMax`, a closed part.
 *
 * @beta
 */
export type PieChartCenterMaxProps = ChartLayerProps & {
  /** The maximum's format. The value's format is the default. */
  format?: ValueFormat;
};

/**
 * Props for `PieChart.CenterLabel`, a closed part.
 *
 * @beta
 */
export type PieChartCenterLabelProps = ChartLayerProps & {
  /** The label text, such as "av" between the value and the maximum. */
  children?: ReactNode;
};

/**
 * The unfilled sweep behind a gauge: the whole sweep from `startAngle` to `endAngle`, which the
 * slices fill only to their total's share of `max`. It draws at once, before the slices' entrance.
 *
 * @beta
 */
export function PieChartTrack({ className, style }: PieChartTrackProps): ReactElement {
  const { model, box } = usePolarContext("PieChart.Track", ["pie", "radial"]);
  const pie = pieDrawingOf(model);
  if (pie === null) return <></>;
  const d = arcPath({
    innerRadius: pie.innerRadius,
    outerRadius: 1,
    startAngle: pie.track.start,
    endAngle: pie.track.end,
  });
  return (
    <svg
      data-layer="track"
      data-polar-layer=""
      aria-hidden="true"
      focusable="false"
      viewBox={viewBoxOf(box)}
      className={className}
      style={style}>
      <path data-slot="pie-chart-track" d={d} />
    </svg>
  );
}

/**
 * The text in the hole of a donut or a gauge: its parts sit in the square inscribed in the hole,
 * centred on the dial and kept to the sweep's box, so a semicircle's sits above its flat edge. Every part prints the active slice, or with nothing active the pie's own
 * number.
 *
 * @beta
 */
export function PieChartCenter({ children, className, style }: PieChartCenterProps): ReactElement {
  const { model, box } = usePolarContext("PieChart.Center", ["pie", "radial"]);
  const pie = pieDrawingOf(model);
  if (pie === null) return <></>;
  // A pie with no hole lays its centre in the square inscribed in half the radius. The square
  // keeps to the sweep's box, so a semicircle's centre sits above its flat edge.
  const half = (Math.SQRT2 * (pie.innerRadius > 0 ? pie.innerRadius : 0.5)) / 2;
  const left = Math.max(-half, box.left);
  const right = Math.min(half, box.right);
  const top = Math.max(-half, box.top);
  const bottom = Math.min(half, box.bottom);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const percent = (value: number, of: number): string => `${((value / of) * 100).toFixed(3)}%`;
  return (
    <div
      data-slot="pie-chart-center"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <div
        data-part="hole"
        style={{
          "--_left": percent(left - box.left, width),
          "--_top": percent(top - box.top, height),
          "--_width": percent(right - left, width),
          "--_height": percent(bottom - top, height),
        }}>
        {children}
      </div>
    </div>
  );
}

/** The pie a centre part reads, null under a family that draws none, and its active slice. */
type ActiveSlice = { readonly pie: PieDrawing | null; readonly active: number | null };

/** The active slice's index, or null while nothing is active. */
function useActiveSlice(part: string): ActiveSlice {
  const { model, kernel } = usePolarContext(part, ["pie", "radial"]);
  const pie = pieDrawingOf(model);
  const active = useChartStore(kernel.store, (snapshot) => snapshot.active);
  const count = pie?.slices.length ?? 0;
  return { pie, active: active !== null && active >= 0 && active < count ? active : null };
}

/**
 * The active slice's value. With nothing active, the total, or nothing when the categories'
 * formats differ, because a sum of kWh and kr means nothing. Its digits roll from one value to the
 * next, and count up as the slices sweep in.
 *
 * @beta
 */
export function PieChartCenterValue({ format, className, style }: PieChartCenterValueProps): ReactElement {
  const { pie, active } = useActiveSlice("PieChart.CenterValue");
  const { locale } = useLocale();
  if (pie === null) return <span data-slot="pie-chart-center-value" className={className} style={style} />;
  const slice = active === null ? null : pie.slices[active];
  let text: string | null = null;
  if (slice !== null && slice !== undefined) {
    text =
      slice.value === null
        ? CHART_STRINGS[locale].missing
        : formatValue(locale, slice.value, format ?? slice.format, "full").text;
  } else {
    const total = format ?? pie.totalFormat;
    text = total === null ? null : formatValue(locale, pie.total, total, "full").text;
  }
  return (
    <span data-slot="pie-chart-center-value" className={className} style={style}>
      {text === null ? null : <ChartDigitRoll text={text} />}
    </span>
  );
}

/**
 * The active slice's share of the absolute total, the number its label, legend and tooltip print,
 * since the slices' shares round together and sum to 100 %. With nothing active, a gauge prints
 * its total over `max`, and a plain pie prints nothing.
 *
 * @beta
 */
export function PieChartCenterShare({ format, className, style }: PieChartCenterShareProps): ReactElement {
  const { pie, active } = useActiveSlice("PieChart.CenterShare");
  const { locale } = useLocale();
  if (pie === null) return <span data-slot="pie-chart-center-share" className={className} style={style} />;
  const digits = shareDigits(format);
  let share: number | null | undefined;
  if (active !== null) share = pie.share(active, digits);
  else if (pie.max !== null && pie.max > 0) {
    // A gauge's own share rounds alone, as a ring's does.
    const unit = 10 ** digits;
    share = Math.round((pie.total / pie.max) * 100 * unit) / unit;
  }
  return (
    <span data-slot="pie-chart-center-share" className={className} style={style}>
      {share === undefined ? null : <ChartDigitRoll text={shareText(locale, share, format)} />}
    </span>
  );
}

/**
 * A gauge's `max`, which the value fills. It renders an empty element on a plain pie. A maximum is
 * a value, not a share, so it prints through the value format and never rounds with a share set.
 * `CenterValue`, a `CenterLabel` reading "av" and `CenterMax` give "3,9 av 5 kWh".
 *
 * @beta
 */
export function PieChartCenterMax({ format, className, style }: PieChartCenterMaxProps): ReactElement {
  const { model } = usePolarContext("PieChart.CenterMax", ["pie", "radial"]);
  const pie = pieDrawingOf(model);
  const { locale } = useLocale();
  const shown = format ?? pie?.totalFormat ?? pie?.slices[0]?.format ?? {};
  return (
    <span data-slot="pie-chart-center-max" className={className} style={style}>
      {pie === null || pie.max === null ? null : (
        <ChartDigitRoll text={formatValue(locale, pie.max, shown, "full").text} />
      )}
    </span>
  );
}

/**
 * A text line in the centre, such as the word between the value and the maximum.
 *
 * @beta
 */
export function PieChartCenterLabel({ children, className, style }: PieChartCenterLabelProps): ReactElement {
  usePolarContext("PieChart.CenterLabel", ["pie", "radial"]);
  return (
    <span data-slot="pie-chart-center-label" className={className} style={style}>
      {children}
    </span>
  );
}

Object.assign(PieChartTrack, { displayName: "PieChart.Track" });
Object.assign(PieChartCenter, { displayName: "PieChart.Center" });
Object.assign(PieChartCenterValue, { displayName: "PieChart.CenterValue" });
Object.assign(PieChartCenterShare, { displayName: "PieChart.CenterShare" });
Object.assign(PieChartCenterMax, { displayName: "PieChart.CenterMax" });
Object.assign(PieChartCenterLabel, { displayName: "PieChart.CenterLabel" });
