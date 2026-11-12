import type { ReactElement, ReactNode } from "react";

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
import type { SparklineBarReading, SparklinePoint, SparklineReading } from "./layout/sparkline-layout";
import { SPARKLINE_PART, SPARKLINE_SLOT } from "./sparkline-marks";
import type { SparklineMarkPlace } from "./sparkline-marks";

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
  /**
   * "none" leaves hover out: no value shows a crosshair, a dot or a highlight under the pointer.
   * Hover writes a region of about half a kilobyte and five elements per value: a 30-value line is about
   * 18 KB and 150 elements with it and 1.4 KB and 3 elements without, and a 168-value line about
   * 106 KB against 7 KB. Pass "none" where many Sparklines render at once, such as one per row of
   * a long table.
   */
  "data-hover"?: "none";
  /**
   * "none" turns the entrance off. The entrance plays whenever the svg enters the document, so it
   * replays when the element is inserted again: a keyed row that a sort moves, or a panel shown
   * again. Pass "none" where that happens, such as a Sparkline in a sortable table. Reduced motion
   * draws the marks at rest either way.
   */
  "data-intro"?: "none";
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

/** A percentage as an svg length attribute writes it. */
const pct = (value: number) => `${String(value)}%`;

/**
 * A dot: the round cap of a stroke of no length, at its own place, or at the `--_value-…` it
 * inherits from its hover region.
 */
function Dot({
  part,
  at,
}: {
  readonly part?: typeof SPARKLINE_PART.hover;
  readonly at?: SparklinePoint;
}): ReactElement {
  return (
    <path
      {...SPARKLINE_SLOT.dot}
      data-part={part}
      d="M0,0Z"
      style={at === undefined ? undefined : { "--_value-x": at.x, "--_value-y": at.y }}
    />
  );
}

/** A dashed crosshair down the box, which the inherited `--_value-x` places. */
function Crosshair(): ReactElement {
  return <line {...SPARKLINE_SLOT.crosshair} x1="0" x2="0" y1="0" y2="100%" />;
}

/** A flat line across the box at a height in percent: the zero line, or the dashed reference. */
function Rule({
  at,
  part,
}: {
  readonly at: number;
  readonly part?: typeof SPARKLINE_PART.zero;
}): ReactElement {
  return <line {...SPARKLINE_SLOT.reference} data-part={part} x1="0" x2="100%" y1={pct(at)} y2={pct(at)} />;
}

/**
 * One reading's hover region: its cell, which takes the pointer, and the marks its hover shows, a
 * dashed crosshair, a dot and the reading's own segment of the line or its bar at full strength.
 * Hover has no JavaScript, so each region carries its own marks, placed by the `--_value-…` and,
 * for a line's or an area's reading, the `--_band-…` its style writes from the reading, which CSS
 * shows while the region is hovered, and the regions sit side by side, so the markup's depth stays
 * the same at any length.
 */
function HoverRegion({
  reading,
  children,
}: {
  readonly reading: SparklineReading & SparklineMarkPlace;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <g
      {...SPARKLINE_SLOT.value}
      style={
        reading.band === undefined
          ? { "--_value-x": reading.x, "--_value-y": reading.y }
          : {
              "--_value-x": reading.x,
              "--_value-y": reading.y,
              "--_band-start": reading.band[0],
              "--_band-end": reading.band[1],
            }
      }>
      <rect
        data-part={SPARKLINE_PART.hit}
        x={pct(reading.cell[0])}
        y="0"
        width={pct(reading.cell[1] - reading.cell[0])}
        height="100%"
      />
      {children}
      <Crosshair />
      <Dot part={SPARKLINE_PART.hover} />
    </g>
  );
}

/** A bar, its far end rounded, below the baseline for a negative value. */
function Bar({
  reading,
  part,
}: {
  readonly reading: SparklineBarReading;
  readonly part?: typeof SPARKLINE_PART.highlight;
}): ReactElement {
  return (
    <rect
      {...SPARKLINE_SLOT.bar}
      data-part={part}
      data-negative={reading.negative ? "" : undefined}
      x={pct(reading.bar.x)}
      y={pct(reading.bar.y)}
      width={pct(reading.bar.width)}
      height={pct(reading.bar.height)}
    />
  );
}

/**
 * A server-drawn chart with `role="img"` and a name that ends in a generated range sentence. It
 * calls no hook, so a server component renders it with no client JavaScript, and it takes no tab
 * stop. Its box fills its container's width at `2rem` high, and its marks stretch to the box while
 * their strokes keep their width. A line spans the values' own range, and an area or bars reach 0.
 * A zero line draws only where the values cross 0. An area fades from its values toward 0, where
 * the engine masks SVG elements; an engine that masks none, such as WebKit, keeps a flat 0.3 fill.
 * A bar rounds the corners of its far end by `--chart-bar-radius`, below the baseline for a
 * negative value.
 *
 * With motion allowed, a line or an area wipes in from the left as the svg enters the document,
 * and bars grow from the baseline. Re-inserting the element, as a keyed reorder or a re-shown
 * panel does, replays it; `data-intro="none"` turns it off. On a device that hovers, the pointer
 * over a value shows a dashed crosshair and a dot there, fades the rest of the series and
 * re-strokes the line around the value, or lifts its bar, all in CSS. Hover adds nothing to the
 * accessible name and no tab stop, and `data-hover="none"` leaves it out.
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
  const regions =
    props["data-hover"] === "none"
      ? null
      : layout.readings.map((reading) => (
          <HoverRegion key={reading.index} reading={reading}>
            {"bar" in reading ? (
              <Bar reading={reading} part={SPARKLINE_PART.highlight} />
            ) : (
              <path {...SPARKLINE_SLOT.path} data-part={SPARKLINE_PART.highlight} d={reading.segment} />
            )}
          </HoverRegion>
        ));
  return (
    <svg
      {...SPARKLINE_SLOT.root}
      data-variant={variant}
      role="img"
      aria-label={name}
      viewBox={layout.kind === "path" ? layout.viewBox : undefined}
      preserveAspectRatio={layout.kind === "path" ? "none" : undefined}
      {...definedProps({
        id,
        className,
        style,
        "data-intro": props["data-intro"],
        "data-hover": props["data-hover"],
      })}>
      <g style={{ "--chart-series-paint": paint }}>
        {layout.zero === null ? null : <Rule at={layout.zero} part={SPARKLINE_PART.zero} />}
        {layout.reference === null ? null : <Rule at={layout.reference} />}
        {layout.kind === "bars" ? (
          layout.readings.map((reading) => <Bar key={reading.index} reading={reading} />)
        ) : (
          <>
            {layout.fill === "" ? null : (
              <path
                {...SPARKLINE_SLOT.path}
                data-part={SPARKLINE_PART.fill}
                d={layout.fill}
                style={{ "--_fill-zero": pct(layout.fillZero) }}
              />
            )}
            {layout.stroke === "" ? null : <path {...SPARKLINE_SLOT.path} d={layout.stroke} />}
          </>
        )}
        {regions}
        {layout.dot === null ? null : <Dot at={layout.dot} />}
      </g>
    </svg>
  );
}

Object.assign(Sparkline, { displayName: "Sparkline" });
