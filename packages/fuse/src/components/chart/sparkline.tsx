import type { ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import type { SupportedLocale } from "../../intl/locale-context";
import type {
  ChartCurve,
  ChartFallback,
  ChartInstant,
  ChartLayerProps,
  ChartRole,
  Interval,
  ValueFormat,
} from "./chart-types";

/**
 * Props for `Sparkline`, a closed part. `start`, `interval` and `timeZone` come together or not at
 * all.
 *
 * @beta
 */
export type SparklineProps = ChartLayerProps & {
  /** The svg's id. */
  id?: string;
  /** The consumer's name. The accessible name appends the generated range sentence to it. */
  "aria-label": string;
  /** Evenly spaced values. Null leaves a gap. No values, or only nulls, draw nothing and read the dictionary's `noData`. */
  data: readonly (number | null)[];
  /** The locale of the range sentence. A hook-free component cannot read LocaleProvider. */
  locale: SupportedLocale;
  /** How the range sentence prints values. */
  format?: ValueFormat;
  /** The mark. "line" by default. */
  variant?: "line" | "area" | "bar";
  /** The curve through the values. "monotone" by default. */
  curve?: ChartCurve;
  /** The paint. "chart-1" by default. */
  color?: ChartRole;
  /** A dot on one value, by keyword or by index. */
  emphasis?: Exclude<ChartFallback, "now"> | number;
  /** A flat dashed line, such as Norgespris against spot. */
  reference?: number;
  /** Replaces the generated range sentence verbatim. */
  description?: string;
} & (
    | {
        /** Without a start, the range sentence names no slots. */
        start?: never;
        /** Only with `start`. */
        interval?: never;
        /** Only with `start`. */
        timeZone?: never;
      }
    | {
        /** The first value's slot start. With all three, the range sentence names the slots of the lowest and highest values. */
        start: ChartInstant;
        /** Each value's slot length. */
        interval: Interval;
        /** The IANA zone the slot labels read in. */
        timeZone: string;
      }
  );

/**
 * A static chart with `role="img"` and a name that ends in a generated range sentence. It calls no
 * hook, so a server component renders it with no client JavaScript, and it takes no tab stop.
 *
 * @beta
 */
export function Sparkline(props: SparklineProps): ReactElement {
  const { id, className, style } = props;
  return (
    <svg
      data-slot="sparkline"
      role="img"
      aria-label={props["aria-label"]}
      {...definedProps({ id, className, style })}
    />
  );
}

Object.assign(Sparkline, { displayName: "Sparkline" });
