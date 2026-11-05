"use client";

/**
 * The clock's ReferenceArea: an annulus between two values, as `y1` and `y2`, or a sector from one
 * instant's slot to another's, as `x1` and `x2`, with an optional label. The first paint draws it
 * at rest (D18).
 */
import type { ReactElement } from "react";

import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";
import { labelPlace, slotOfX } from "./clock-chart-dial";
import type { LabelPlace } from "./clock-chart-dial";
import { PlacedLabel } from "./clock-chart-placed-label";
import { formatSlot, nextSlotStart } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { slotAngles } from "./layout/clock";
import { sectorPath } from "./layout/clock-path";

/**
 * Props for `ClockChart.ReferenceArea`, a closed part. It takes either `y1` and `y2` or `x1` and `x2`.
 *
 * @beta
 */
export type ClockChartReferenceAreaProps = ChartLayerProps &
  (
    | {
        /** The annulus's first value. */
        y1: number;
        /** Its last value. */
        y2: number;
        /** Not on an annulus. */
        x1?: never;
        /** Not on an annulus. */
        x2?: never;
        /** How `{value}` in `label` prints the range. */
        format?: ValueFormat;
      }
    | {
        /** The sector's first instant. A string throws `x-type-mismatch`. */
        x1: ChartX;
        /** Its last instant. */
        x2: ChartX;
        /** Not on a sector. */
        y1?: never;
        /** Not on a sector. */
        y2?: never;
        /**
         * How `{value}` in `label` prints the range's ends, the first slot's start and the last
         * slot's end, joined by an en dash. "time" by default, and a range preset prints each end
         * in its point form, as "hour-range" does in "hour".
         */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the range. */
    label?: string;
    /** The band's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * An annulus between two values, as `y1` and `y2`, or a sector from one instant's slot to another's,
 * as `x1` and `x2`, with an optional label.
 *
 * @beta
 */
export function ClockChartReferenceArea({ style, ...props }: ClockChartReferenceAreaProps): ReactElement {
  const { label, tone = "default", className } = props;
  const { model, box, kernel } = usePolarContext("ClockChart.ReferenceArea", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.ReferenceArea");
  let d: string;
  let text: string | undefined;
  let place: LabelPlace;
  if (props.y1 !== undefined) {
    const [a, b] = [clock.radius(props.y1), clock.radius(props.y2)];
    d = sectorPath(0, 360, Math.min(a, b), Math.max(a, b));
    const valueFormat = props.format ?? clock.format;
    text = label?.replace(
      "{value}",
      `${formatValue(kernel.locale, props.y1, valueFormat, "full").text}–${formatValue(kernel.locale, props.y2, valueFormat, "full").text}`
    );
    place = labelPlace(box, 0, Math.max(a, b));
  } else {
    const first = slotOfX(clock, "ClockChart.ReferenceArea", props.x1);
    const last = slotOfX(clock, "ClockChart.ReferenceArea", props.x2);
    const ok = first !== -1 && last !== -1;
    const start = ok ? slotAngles(Math.min(first, last), clock.count).start : 0;
    const end = ok ? slotAngles(Math.max(first, last), clock.count).end : 0;
    d = ok ? sectorPath(start, end, clock.inner, 1) : "";
    // `{value}` prints the first slot's start and the last slot's end, in Root's locale and zone.
    const domain = clock.text.model.domain;
    const timeZone = domain.kind === "time" ? domain.timeZone : "UTC";
    const interval = domain.kind === "time" ? domain.interval : "hour";
    const from = clock.starts[Math.min(first, last)];
    const until = clock.starts[Math.max(first, last)];
    // A range preset prints one slot as a range, so each end prints its own point preset.
    const format =
      props.format === "hour-range"
        ? "hour"
        : props.format === "time-range"
          ? "time"
          : (props.format ?? "time");
    const at = (instant: number): string =>
      formatSlot(kernel.locale, timeZone, instant, interval, format, "full").text;
    text =
      !ok || from === undefined || until === undefined
        ? label
        : label?.replace("{value}", `${at(from)}\u2013${at(nextSlotStart(until, interval, timeZone))}`);
    place = labelPlace(box, (start + end) / 2, 1.02);
  }
  return (
    <div
      data-slot="clock-chart-reference-area"
      data-tone={tone}
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <svg viewBox={viewBoxOf(box)} focusable="false">
        <path data-slot="clock-chart-reference-path" data-part="area" d={d} />
      </svg>
      {text === undefined ? null : <PlacedLabel place={place}>{text}</PlacedLabel>}
    </div>
  );
}

Object.assign(ClockChartReferenceArea, { displayName: "ClockChart.ReferenceArea" });
