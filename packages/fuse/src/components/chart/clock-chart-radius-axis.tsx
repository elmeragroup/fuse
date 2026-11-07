"use client";

/**
 * The clock's RadiusAxis: the ring values along the 12 o'clock spoke, or the 6 o'clock one when
 * the marks leave that more room, each shown only where it clears its neighbours. The first paint
 * draws it at rest (D18).
 */
import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing } from "./chart-polar-context";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { percent } from "./clock-chart-dial";
import { formatValue } from "./format/value-format";
import { labelBound } from "./layout/label-bound";
import { fitRingLabels, ringAnchor } from "./layout/ring-labels";
import type { MarkCover } from "./layout/ring-labels";

/**
 * Props for `ClockChart.RadiusAxis`, a closed part.
 *
 * @beta
 */
export type ClockChartRadiusAxisProps = ChartLayerProps & {
  /** The tick label format. The first series' `format` is the default. */
  format?: ValueFormat;
};

/**
 * Whether a clock's marks at rest cover a point: any slot's band between its base and its tip, at
 * the slot's angles, in every series, as its Column, Area or Line would draw it. A Line draws only
 * its tip, so the band is the most a series' mark can cover.
 */
function clockCover(clock: ClockDrawing): MarkCover {
  return (x, y, radius) => {
    const share = Math.hypot(x, y) / radius;
    const angle = ((((Math.atan2(x, -y) * 180) / Math.PI) % 360) + 360) % 360;
    return clock.series.some((series) => {
      for (let at = 1; at + 3 < series.rest.length; at += 4) {
        const [start = 0, end = 0, base = 0, tip = 0] = series.rest.slice(at, at + 4);
        if (angle >= start && angle <= end && share >= Math.min(base, tip) && share <= Math.max(base, tip))
          return true;
      }
      return false;
    });
  };
}

/**
 * The ring values beside the 12 o'clock spoke, each on its ring, or beside the 6 o'clock spoke
 * when the marks leave that more room. A value shows only at the widths where it clears its
 * neighbours, the marks, the cycle labels the AngleAxis shows and the centre's text, so a crowded
 * dial shows fewer values, or none.
 *
 * @beta
 */
export function ClockChartRadiusAxis({ format, className, style }: ClockChartRadiusAxisProps): ReactElement {
  const { model, box } = usePolarContext("ClockChart.RadiusAxis", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.RadiusAxis");
  const { locale } = useLocale();
  const rings = clock.ticks.flatMap((tick) => {
    const radius = clock.radius(tick);
    return radius < clock.inner - 1e-9 || radius > 1 + 1e-9 ? [] : [{ tick, radius }];
  });
  // Values stay clear of the angle labels the axis shows past the rim, of the marks at rest, and of
  // the centre text in the hole, along whichever of 12 and 6 o'clock leaves them more room. Each
  // width is the label's bound, the widest any common sans draws it, since the page picks the font.
  const values = rings.map(({ tick, radius }) => ({
    radius,
    width: labelBound(formatValue(locale, tick, format ?? clock.format, "tick").text),
  }));
  const clearance = {
    inner: (clock.inner * Math.SQRT2) / 2,
    angles: clock.labels.map((label) => ({
      angle: label.angle,
      width: labelBound(label.text.text),
      shownAt: label.visibility,
    })),
    marks: clockCover(clock),
  };
  const anchor = ringAnchor(values, clearance);
  const shown = fitRingLabels(values, { ...clearance, anchor });
  return (
    <div
      data-slot="clock-chart-radius-axis"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {rings.map(({ tick, radius }, index) => {
        const [left, top] = percent(box, 0, anchor === 180 ? radius : -radius);
        const min = shown[index] ?? "none";
        return (
          <span
            key={tick}
            data-slot="clock-chart-radius-label"
            data-min={min === "none" ? undefined : min}
            data-hidden={min === "none" ? "" : undefined}
            style={{ "--_x": left, "--_y": top }}>
            {formatValue(locale, tick, format ?? clock.format, "tick").text}
          </span>
        );
      })}
    </div>
  );
}

Object.assign(ClockChartRadiusAxis, { displayName: "ClockChart.RadiusAxis" });
