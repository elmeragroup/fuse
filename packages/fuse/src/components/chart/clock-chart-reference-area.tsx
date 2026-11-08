"use client";

/**
 * The clock's ReferenceArea: an annulus between two values, as `y1` and `y2`, or a sector from one
 * instant's slot to another's, as `x1` and `x2`, with an optional label. The first paint draws it
 * at rest (D18).
 */
import type { ReactElement } from "react";

import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import { referenceSentence } from "./chart-reference-text";
import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";
import { labelPlace, slotOfX } from "./clock-chart-dial";
import type { LabelPlace } from "./clock-chart-dial";
import { PlacedLabel } from "./clock-chart-placed-label";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
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
 * as `x1` and `x2`, with an optional label. The annulus clips to the radius domain, from the hole
 * to the rim, and one outside it draws nothing, as a sector outside the cycle draws nothing, the
 * label included. Readers hear it as a visually hidden sentence with the range, as the cartesian
 * ReferenceArea's.
 *
 * @beta
 */
export function ClockChartReferenceArea({ style, ...props }: ClockChartReferenceAreaProps): ReactElement {
  const { label, tone = "default", className } = props;
  const { model, box, kernel } = usePolarContext("ClockChart.ReferenceArea", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.ReferenceArea");
  const strings = CHART_STRINGS[kernel.locale];
  let d: string;
  let value: FormattedText;
  // Whether the band draws, its label included. Readers hear its sentence either way.
  let drawn: boolean;
  let place: LabelPlace;
  if (props.y1 !== undefined) {
    // The band clips to the radius domain, from the hole to the rim, and a band outside it draws
    // nothing (B5). It clips the values, since the area-true scale clamps a value below the domain
    // to a dial with no hole's centre.
    const [min, max] = clock.domain;
    const from = Math.max(min, Math.min(props.y1, props.y2));
    const to = Math.min(max, Math.max(props.y1, props.y2));
    drawn = to > from;
    const low = clock.radius(from);
    const high = clock.radius(to);
    d = drawn ? sectorPath(0, 360, low, high) : "";
    const valueFormat = props.format ?? clock.format;
    const first = formatValue(kernel.locale, props.y1, valueFormat, "full");
    const second = formatValue(kernel.locale, props.y2, valueFormat, "full");
    // Readers hear the range low to high, as the cartesian ReferenceArea says it.
    const [lowEnd, highEnd] = props.y1 <= props.y2 ? [first, second] : [second, first];
    value = {
      text: `${first.text}\u2013${second.text}`,
      spoken: strings.valueRange(lowEnd.spoken, highEnd.spoken),
    };
    place = labelPlace(box, 0, high);
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
    const at = (instant: number): FormattedText =>
      formatSlot(kernel.locale, timeZone, instant, interval, format, "full");
    // A sector outside the cycle draws nothing, its label included, and has no range to print, as a
    // cartesian x range outside the axis has none.
    drawn = ok && from !== undefined && until !== undefined;
    if (!ok || from === undefined || until === undefined) value = { text: "", spoken: "" };
    else {
      const head = at(from);
      const tail = at(nextSlotStart(until, interval, timeZone));
      value = {
        text: `${head.text}\u2013${tail.text}`,
        spoken: strings.valueRange(head.spoken, tail.spoken),
      };
    }
    place = labelPlace(box, (start + end) / 2, 1.02);
  }
  const text = referenceSentence(label, value, strings.referenceArea);
  return (
    <div
      data-slot="clock-chart-reference-area"
      data-tone={tone}
      data-polar-layer=""
      className={className}
      style={style}>
      <svg viewBox={viewBoxOf(box)} aria-hidden="true" focusable="false">
        <path data-slot="clock-chart-reference-path" data-part="area" d={d} />
      </svg>
      {label === undefined || !drawn ? null : <PlacedLabel place={place}>{text.text}</PlacedLabel>}
      <span data-slot="chart-reference-text">{text.spoken}</span>
    </div>
  );
}

Object.assign(ClockChartReferenceArea, { displayName: "ClockChart.ReferenceArea" });
