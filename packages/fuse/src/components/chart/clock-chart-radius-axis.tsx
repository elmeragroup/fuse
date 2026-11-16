"use client";

/**
 * The clock's RadiusAxis: the ring values along the 12 o'clock spoke, or the 6 o'clock one when
 * the marks leave that more room, each shown only where it clears its neighbours. The first paint
 * draws it at rest.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing } from "./chart-polar-context";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { ownerSlot, slotAt } from "./layout/clock-path";
import { labelBound } from "./layout/label-bound";
import { boxPercent, turnOf } from "./layout/polar-angle";
import { ringAnchor } from "./layout/ring-labels";
import type { MarkCover } from "./layout/ring-labels";

/**
 * Props for `ClockChart.RadiusAxis`, a closed part.
 *
 * @beta
 */
export type ClockChartRadiusAxisProps = ChartLayerProps & {
  /**
   * The tick label format. The first series' `format` is the default. The values show beside the 12
   * o'clock spoke, or the 6 o'clock one when the marks leave that more room, and only where they
   * clear the marks and the labels, so a crowded dial shows fewer values.
   */
  format?: ValueFormat;
};

/**
 * Whether a clock's marks at rest cover a point: a slot's band between its base and its tip, at the
 * slot's angles, in any series, as its Column, Area or Line would draw it. A Line draws only its tip,
 * so the band is the most a series' mark can cover. The point's angle names its slot, as the pick
 * finds it, and only the records that can hold that angle are read: the slot's and its two
 * neighbours', which share its edges, each with every slot its coarse slot spans.
 */
function clockCover(clock: ClockDrawing): MarkCover {
  const { count } = clock;
  return (x, y, radius) => {
    if (count === 0) return false;
    const share = Math.hypot(x, y) / radius;
    const angle = turnOf((Math.atan2(x, -y) * 180) / Math.PI);
    const slot = Math.min(count - 1, Math.floor((angle / 360) * count));
    const near = [(slot + count - 1) % count, slot, (slot + 1) % count];
    return clock.series.some(({ rest, slots }) =>
      near.some((candidate) => {
        const owner = ownerSlot(slots.states, candidate);
        for (let at = owner; at < count && (at === owner || slots.states[at] === "covered"); at += 1) {
          const [start, end, base, tip] = slotAt(rest, at);
          if (angle >= start && angle <= end && share >= Math.min(base, tip) && share <= Math.max(base, tip))
            return true;
        }
        return false;
      })
    );
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
  // The fit probes the marks many times per value, so it runs once per drawing, format and locale.
  const { rings, anchor, shown } = useMemo(() => {
    const kept = clock.ticks.flatMap((tick) => {
      const radius = clock.radius(tick);
      return radius < clock.inner - 1e-9 || radius > 1 + 1e-9 ? [] : [{ tick, radius }];
    });
    // Values stay clear of the angle labels the axis shows past the rim, of the marks at rest, and
    // of the centre text in the hole, along whichever of 12 and 6 o'clock leaves them more room.
    // Each width is the label's bound, the widest any common sans draws it, since the page picks
    // the font.
    const values = kept.map(({ tick, radius }) => ({
      radius,
      width: labelBound(formatValue(locale, tick, format ?? clock.format, "tick").text),
    }));
    const fit = ringAnchor(values, {
      inner: (clock.inner * Math.SQRT2) / 2,
      angles: clock.labels.map((label) => ({
        angle: label.angle,
        width: labelBound(label.text.text),
        shownAt: label.visibility,
      })),
      marks: clockCover(clock),
    });
    return { rings: kept, ...fit };
  }, [clock, format, locale]);
  return (
    <div
      data-slot="clock-chart-radius-axis"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {rings.map(({ tick, radius }, index) => {
        const [left, top] = boxPercent(box, 0, anchor === 180 ? radius : -radius);
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
