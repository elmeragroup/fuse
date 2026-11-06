"use client";

/**
 * The numbers in a pie's or radial chart's hole (CONTRACT section 8.13): each prints the active
 * slice's or ring's number, or with nothing active the chart's own, the total, a gauge's share of
 * its maximum, or the maximum. A part with nothing to print renders an empty element, so the text
 * around it still lays out. The numbers roll their digits (S3).
 */
import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { ChartDigitRoll } from "./chart-digit-roll";
import { centreOf, usePolarContext } from "./chart-polar-context";
import type { CentreModel } from "./chart-polar-context";
import { shareDigits, shareText } from "./chart-readout";
import { useChartStore } from "./chart-store";
import type { ChartFractionDigits, ChartLayerProps, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { numberAndUnit } from "./format/formatted-text";
import { formatValue } from "./format/value-format";

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

/** The centre's numbers, null under a family with no centre, and the active item. */
/**
 * A value as its number, whose digits roll, and its unit, in the order the formatter wrote them and
 * joined by a breakable space, so a value too wide for the hole wraps between them instead of
 * overflowing.
 */
function RollingValue({ text, step }: { readonly text: string; readonly step: number | null }): ReactElement {
  const parts = numberAndUnit(text);
  const number = (
    <span data-part="number">
      <ChartDigitRoll text={parts.number} step={step} />
    </span>
  );
  if (parts.unit === null) return number;
  const unit = <span data-part="unit">{parts.unit}</span>;
  return parts.side === "before" ? (
    <>
      {unit} {number}
    </>
  ) : (
    <>
      {number} {unit}
    </>
  );
}

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
      {text === null ? null : <RollingValue text={text} step={active} />}
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
      {share === undefined ? null : <ChartDigitRoll text={shareText(locale, share, format)} step={active} />}
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
      {max === null ? null : (
        <RollingValue text={formatValue(locale, max, shown, "full").text} step={active} />
      )}
    </span>
  );
}

Object.assign(PieChartCenterValue, { displayName: "PieChart.CenterValue" });
Object.assign(PieChartCenterShare, { displayName: "PieChart.CenterShare" });
Object.assign(PieChartCenterMax, { displayName: "PieChart.CenterMax" });
