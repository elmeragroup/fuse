"use client";

/**
 * The clock's Now: a hand at Root's `now`, to the minute, with a ping at its tip and an optional
 * label centred on the hand just inside the rim. The first paint draws it at rest.
 */
import type { ReactElement } from "react";

import { useLabelWidths } from "./chart-label-widths";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps, ChartTone } from "./chart-types";
import { rayPlace, spokePath } from "./clock-chart-dial";
import { PlacedLabel } from "./clock-chart-placed-label";
import { labelWidth } from "./layout/label-width";
import { polarPoint, viewBoxOf } from "./layout/polar-angle";
import { fitHandLabel } from "./layout/ring-labels";
import { pathNumber } from "./layout/rounding";

/** The padding either side of Now's label on its chip, in CSS pixels. */
const NOW_CHIP = 4;

/**
 * Props for `ClockChart.Now`, a closed part.
 *
 * @beta
 */
export type ClockChartNowProps = ChartLayerProps & {
  /** The visible label on the hand inside its tip, such as "Nå". */
  label?: string;
  /**
   * The hand's tone. "default" by default. A muted label keeps the full muted text, and only the
   * hand fades.
   */
  tone?: ChartTone;
};

/**
 * A hand at Root's `now`, to the minute, with a ping at its tip and an optional label on the hand
 * just inside the rim. The label shows only at the widths from which it keeps clear of the hole and
 * its centre text, and otherwise the hand and its dot mark Now alone, as the centre names the slot.
 * It draws nothing when `now` lies outside the cycle.
 *
 * @beta
 */
export function ClockChartNow({
  label,
  tone = "default",
  className,
  style,
}: ClockChartNowProps): ReactElement {
  const { model, box } = usePolarContext("ClockChart.Now", ["clock"]);
  // Now's label is a chip, which is what sits on the hand.
  const measured = useLabelWidths("box");
  const clock = clockDrawingIn(model, "ClockChart.Now");
  const now = clock.now;
  const tip = now === null ? null : polarPoint(now.angle, 1);
  // The label shows from the narrowest width that keeps it clear of the hole.
  const fit =
    now === null || label === undefined
      ? "none"
      : fitHandLabel({ angle: now.angle, width: labelWidth(label) + 2 * NOW_CHIP }, clock.inner);
  const shown = fit === "none" ? undefined : fit;
  return (
    <div
      ref={measured}
      data-slot="clock-chart-now"
      data-tone={tone}
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {now === null || tip === null ? null : (
        <>
          <svg viewBox={viewBoxOf(box)} focusable="false">
            <path
              data-slot="clock-chart-now-path"
              data-part="hand"
              d={spokePath(now.angle, clock.inner, 1)}
            />
            <path
              data-slot="clock-chart-now-path"
              data-part="ping"
              d={`M${pathNumber(tip.x)},${pathNumber(tip.y)}h0`}
            />
            <path
              data-slot="clock-chart-now-path"
              data-part="dot"
              d={`M${pathNumber(tip.x)},${pathNumber(tip.y)}h0`}
            />
          </svg>
          {label === undefined ? null : (
            <PlacedLabel
              place={rayPlace(box, now.angle, labelWidth(label), "inside")}
              min={shown}
              hidden={shown === undefined}>
              {label}
            </PlacedLabel>
          )}
        </>
      )}
    </div>
  );
}

Object.assign(ClockChartNow, { displayName: "ClockChart.Now" });
