"use client";

/**
 * The clock's ReferenceLine: a ring at a value, as `y`, or a spoke at an instant's slot start, as
 * `x`, with an optional label. The first paint draws it at rest (D18).
 */
import type { ReactElement } from "react";

import { viewBoxOf } from "./chart-pie-frame";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import { referenceSentence } from "./chart-reference-text";
import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";
import { labelPlace, slotOfX, spokePath } from "./clock-chart-dial";
import type { LabelPlace } from "./clock-chart-dial";
import { PlacedLabel } from "./clock-chart-placed-label";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatSlot } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { slotAngles } from "./layout/clock";
import { ringPath } from "./layout/clock-path";

/**
 * Props for `ClockChart.ReferenceLine`, a closed part. It takes either `y` or `x`.
 *
 * @beta
 */
export type ClockChartReferenceLineProps = ChartLayerProps &
  (
    | {
        /** The value the ring marks. */
        y: number;
        /** Not on a value ring. */
        x?: never;
        /** How `{value}` in `label` prints. */
        format?: ValueFormat;
      }
    | {
        /** The instant the spoke marks. A string throws `x-type-mismatch`. */
        x: ChartX;
        /** Not on a spoke. */
        y?: never;
        /** How `{value}` in `label` prints. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the ring's or the spoke's value. */
    label?: string;
    /** The line style. "solid" by default. */
    variant?: "solid" | "dashed";
    /** The line's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * A ring at a value, as `y`, or a spoke at an instant's slot start, as `x`, with an optional label.
 * A `y` at a series' threshold draws the ring the threshold paints at. A `y` outside the radius
 * domain, inside the hole or past the rim, and an `x` outside the cycle draw nothing, the label
 * included; `yInclude` widens the domain to hold one. Readers hear it as a visually hidden sentence
 * that always carries the value, as the cartesian ReferenceLine's.
 *
 * @beta
 */
export function ClockChartReferenceLine({ style, ...props }: ClockChartReferenceLineProps): ReactElement {
  const { label, variant = "solid", tone = "default", className } = props;
  const { model, box, kernel } = usePolarContext("ClockChart.ReferenceLine", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.ReferenceLine");
  const timeZone = clock.text.model.domain.kind === "time" ? clock.text.model.domain.timeZone : "UTC";
  let d: string;
  let value: FormattedText;
  // Whether the line draws, its label included. Readers hear its sentence either way.
  let drawn: boolean;
  let place: LabelPlace;
  if (props.y !== undefined) {
    const radius = clock.radius(props.y);
    // A value outside the radius domain draws nothing (B5). It reads the value domain, since the
    // area-true scale clamps a value below it to a dial with no hole's centre.
    const [min, max] = clock.domain;
    drawn = props.y >= min && props.y <= max;
    d = drawn ? ringPath(radius) : "";
    value = formatValue(kernel.locale, props.y, props.format ?? clock.format, "full");
    place = labelPlace(box, 0, radius);
  } else {
    const slot = slotOfX(clock, "ClockChart.ReferenceLine", props.x);
    const angle = slot === -1 ? 0 : slotAngles(slot, clock.count).start;
    d = slot === -1 ? "" : spokePath(angle, clock.inner, 1);
    const start = clock.starts[slot];
    // An instant outside the cycle draws nothing, its label included, and has no slot to print, as
    // a cartesian x outside the axis has none.
    drawn = start !== undefined;
    value =
      start === undefined
        ? { text: "", spoken: "" }
        : formatSlot(
            kernel.locale,
            timeZone,
            start,
            clock.text.model.domain.kind === "time" ? clock.text.model.domain.interval : "hour",
            props.format ?? "time",
            "full"
          );
    place = labelPlace(box, angle, 1.02);
  }
  const text = referenceSentence(label, value, CHART_STRINGS[kernel.locale].referenceLine);
  return (
    <div
      data-slot="clock-chart-reference-line"
      data-variant={variant}
      data-tone={tone}
      data-polar-layer=""
      className={className}
      style={style}>
      <svg viewBox={viewBoxOf(box)} aria-hidden="true" focusable="false">
        <path data-slot="clock-chart-reference-path" data-part="line" d={d} />
      </svg>
      {label === undefined || !drawn ? null : <PlacedLabel place={place}>{text.text}</PlacedLabel>}
      <span data-slot="chart-reference-text">{text.spoken}</span>
    </div>
  );
}

Object.assign(ClockChartReferenceLine, { displayName: "ClockChart.ReferenceLine" });
