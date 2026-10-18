"use client";

import type { ReactElement } from "react";

import type { ChartLayerProps, ChartTone, ChartX, ValueFormat, XFormat } from "./chart-types";

/**
 * Props for `Chart.ReferenceLine`, a closed part. It takes either `y` with a `ValueFormat` or `x`
 * with an `XFormat`. Without a format, a `y` line prints through the layout's first series' format
 * and an `x` line through the interval's label preset.
 *
 * @beta
 */
export type ChartReferenceLineProps = ChartLayerProps &
  (
    | {
        /** The value the line marks. */
        y: number;
        /** Not on a value line. */
        x?: never;
        /** How `{value}` in `label` prints, a `ValueFormat` on a `y` line and an `XFormat` on an `x` line. */
        format?: ValueFormat;
      }
    | {
        /** The x the line marks. An x string on a time axis throws `x-type-mismatch`. */
        x: ChartX;
        /** Not on an x line. */
        y?: never;
        /** How `{value}` in `label` prints, a `ValueFormat` on a `y` line and an `XFormat` on an `x` line. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the line's value. */
    label?: string;
    /** The line style. "solid" by default. */
    variant?: "solid" | "dashed";
    /** The line's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * Props for `Chart.ReferenceArea`, a closed part. It takes either `y1` and `y2` or `x1` and `x2`.
 *
 * @beta
 */
export type ChartReferenceAreaProps = ChartLayerProps &
  (
    | {
        /** The band's first value. */
        y1: number;
        /** The band's last value. */
        y2: number;
        /** Not on a value band. */
        x1?: never;
        /** Not on a value band. */
        x2?: never;
        /** How `{value}` in `label` prints the range, a `ValueFormat` for `y1` and `y2` and an `XFormat` for `x1` and `x2`. */
        format?: ValueFormat;
      }
    | {
        /** The band's first x. An x string on a time axis throws `x-type-mismatch`. */
        x1: ChartX;
        /** The band's last x. An x string on a time axis throws `x-type-mismatch`. */
        x2: ChartX;
        /** Not on an x band. */
        y1?: never;
        /** Not on an x band. */
        y2?: never;
        /** How `{value}` in `label` prints the range, a `ValueFormat` for `y1` and `y2` and an `XFormat` for `x1` and `x2`. */
        format?: XFormat;
      }
  ) & {
    /** The visible label. `{value}` prints the range. */
    label?: string;
    /** The band's tone. "default" by default. */
    tone?: ChartTone;
  };

/**
 * A line at one value or one x, such as a price cap. Readers hear it as a visually hidden sentence
 * that always carries the value. Pass the value to Root's `yInclude` when it may sit outside the data.
 *
 * @beta
 */
export function ChartReferenceLine(_props: ChartReferenceLineProps): ReactElement {
  return <></>;
}

/**
 * A band between two values or two x values, such as a tariff step. Readers hear it as a visually
 * hidden sentence with the range.
 *
 * @beta
 */
export function ChartReferenceArea(_props: ChartReferenceAreaProps): ReactElement {
  return <></>;
}

Object.assign(ChartReferenceLine, { displayName: "Chart.ReferenceLine" });
Object.assign(ChartReferenceArea, { displayName: "Chart.ReferenceArea" });
