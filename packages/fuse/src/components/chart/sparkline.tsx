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
import { sparklineLayout, sparklineSentence } from "./layout/sparkline-layout";

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
 * hook, so a server component renders it with no client JavaScript, and it takes no tab stop. Its
 * box fills its container's width at `2rem` high, and its marks stretch to the box while their
 * strokes keep their width. A line spans the values' own range, and an area or bars reach 0. A zero
 * line draws only where the values cross 0.
 *
 * @beta
 */
export function Sparkline(props: SparklineProps): ReactElement {
  const {
    id,
    className,
    style,
    data,
    locale,
    format,
    variant = "line",
    curve = "monotone",
    color = "chart-1",
  } = props;
  const layout = sparklineLayout({
    data,
    variant,
    curve,
    emphasis: props.emphasis,
    reference: props.reference,
  });
  const slots =
    props.start === undefined
      ? undefined
      : {
          start: props.start instanceof Date ? props.start.getTime() : props.start,
          interval: props.interval,
          timeZone: props.timeZone,
        };
  const paint = `var(--${color})`;
  const sentence = props.description ?? sparklineSentence(locale, data, format, slots);
  // The name reads as two sentences, so a label without its own stop takes one.
  const label = props["aria-label"];
  const name = /[.!?:]$/u.test(label) ? `${label} ${sentence}` : `${label}. ${sentence}`;
  return (
    <svg
      data-slot="sparkline"
      data-variant={variant}
      role="img"
      aria-label={name}
      viewBox={layout.viewBox}
      preserveAspectRatio="none"
      {...definedProps({ id, className, style })}>
      <g style={{ "--chart-series-paint": paint }}>
        {layout.zero === null ? null : (
          <path data-slot="sparkline-reference" data-part="zero" d={layout.zero} />
        )}
        {layout.reference === null ? null : <path data-slot="sparkline-reference" d={layout.reference} />}
        {layout.mark === "" ? null : <path data-slot="sparkline-path" d={layout.mark} />}
        {layout.lone === "" ? null : <path data-slot="sparkline-path" data-part="lone" d={layout.lone} />}
        {layout.dot === null ? null : <path data-slot="sparkline-dot" d={layout.dot} />}
      </g>
    </svg>
  );
}

Object.assign(Sparkline, { displayName: "Sparkline" });
