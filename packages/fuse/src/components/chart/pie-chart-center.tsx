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
import { centreOf, pieDrawingOf, radialDrawingOf, usePolarContext } from "./chart-polar-context";
import type { CentreModel } from "./chart-polar-context";
import { shareDigits, shareText } from "./chart-readout";
import { useChartStore } from "./chart-store";
import type { ChartFractionDigits, ChartLayerProps, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { formatValue } from "./format/value-format";

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
 * The text in the hole of a donut or a gauge: its parts sit in the square inscribed in the hole,
 * centred on the dial and kept to the sweep's box, so a semicircle's sits above its flat edge. Every part prints the active slice, or with nothing active the pie's own
 * number.
 *
 * @beta
 */
export function PieChartCenter({ children, className, style }: PieChartCenterProps): ReactElement {
  const { model, box } = usePolarContext("PieChart.Center", ["pie", "radial"]);
  const hole = pieDrawingOf(model)?.innerRadius ?? radialDrawingOf(model)?.innerRadius;
  if (hole === undefined) return <></>;
  // A pie with no hole lays its centre in the square inscribed in half the radius. The square
  // keeps to the sweep's box, so a semicircle's centre sits above its flat edge.
  const half = (Math.SQRT2 * (hole > 0 ? hole : 0.5)) / 2;
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

/** The centre's numbers, null under a family with no centre, and the active item. */
type ActiveItem = { readonly centre: CentreModel | null; readonly active: number | null };

/** The active slice's or ring's index, or null while nothing is active. */
function useActiveItem(part: string): ActiveItem {
  const { model, kernel } = usePolarContext(part, ["pie", "radial"]);
  const centre = centreOf(model);
  const active = useChartStore(kernel.store, (snapshot) => snapshot.active);
  return { centre, active: active !== null && active >= 0 && active < model.count ? active : null };
}

/**
 * The active slice's or ring's value. With nothing active, the total, or nothing when the
 * categories' formats differ, because a sum of kWh and kr means nothing. Its digits roll from one
 * value to the next, and count up as the marks sweep in.
 *
 * @beta
 */
export function PieChartCenterValue({ format, className, style }: PieChartCenterValueProps): ReactElement {
  const { centre, active } = useActiveItem("PieChart.CenterValue");
  const { locale } = useLocale();
  let text: string | null = null;
  if (centre !== null && active !== null) {
    const value = centre.value(active);
    text =
      value === null
        ? CHART_STRINGS[locale].missing
        : formatValue(locale, value, format ?? centre.format(active), "full").text;
  } else if (centre?.total) {
    text = formatValue(locale, centre.total.value, format ?? centre.total.format, "full").text;
  }
  return (
    <span data-slot="pie-chart-center-value" className={className} style={style}>
      {text === null ? null : <ChartDigitRoll text={text} />}
    </span>
  );
}

/**
 * The active slice's or ring's share as a percentage: a slice over the absolute total of the
 * slices, the number its label, legend and tooltip print, since the slices' shares round together
 * and sum to 100 %, and a ring over its own maximum. With nothing active, a gauge pie prints its
 * total over `max`, and a radial chart the sum of its values over the sum of its maxima when every
 * ring shares one format. Otherwise it renders an empty element.
 *
 * @beta
 */
export function PieChartCenterShare({ format, className, style }: PieChartCenterShareProps): ReactElement {
  const { centre, active } = useActiveItem("PieChart.CenterShare");
  const { locale } = useLocale();
  const digits = shareDigits(format);
  const share =
    centre === null
      ? undefined
      : active === null
        ? (centre.totalShare(digits) ?? undefined)
        : centre.share(active, digits);
  return (
    <span data-slot="pie-chart-center-share" className={className} style={style}>
      {share === undefined ? null : <ChartDigitRoll text={shareText(locale, share, format)} />}
    </span>
  );
}

/**
 * The maximum the value fills: a gauge pie's `max`, or the active ring's `max` or `maxKey` value.
 * With nothing active, a radial chart prints the sum of its maxima when every ring shares one
 * format. It renders an empty element without a maximum. A maximum is a value, not a share, so it
 * prints through the value format and never rounds with a share set. `CenterValue`, a `CenterLabel`
 * reading "av" and `CenterMax` give "3,9 av 5 kWh".
 *
 * @beta
 */
export function PieChartCenterMax({ format, className, style }: PieChartCenterMaxProps): ReactElement {
  const { centre, active } = useActiveItem("PieChart.CenterMax");
  const { locale } = useLocale();
  const max = centre === null ? null : active === null ? centre.totalMax : centre.max(active);
  const shown =
    format ??
    (centre === null
      ? {}
      : active === null
        ? (centre.total?.format ?? centre.format(0))
        : centre.format(active));
  return (
    <span data-slot="pie-chart-center-max" className={className} style={style}>
      {max === null ? null : <ChartDigitRoll text={formatValue(locale, max, shown, "full").text} />}
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

Object.assign(PieChartCenter, { displayName: "PieChart.Center" });
Object.assign(PieChartCenterValue, { displayName: "PieChart.CenterValue" });
Object.assign(PieChartCenterShare, { displayName: "PieChart.CenterShare" });
Object.assign(PieChartCenterMax, { displayName: "PieChart.CenterMax" });
Object.assign(PieChartCenterLabel, { displayName: "PieChart.CenterLabel" });
