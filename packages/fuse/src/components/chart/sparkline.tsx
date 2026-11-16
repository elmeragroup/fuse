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
  /**
   * The Sparkline's name. A Sparkline is an image with no keyboard stop, and its accessible name is
   * this text followed by the generated range sentence, which names the lowest and highest values.
   */
  "aria-label": string;
  /** Evenly spaced values. Null leaves a gap. No values, or only nulls, draw nothing and read the dictionary's `noData`. */
  data: readonly (number | null)[];
  /**
   * The locale of the range sentence. Sparkline calls no hook, so a server component renders it
   * with no client JavaScript, and it cannot read LocaleProvider.
   */
  locale: SupportedLocale;
  /** How the range sentence prints values. */
  format?: ValueFormat;
  /**
   * The mark. "line" by default. An area fades from its values toward 0, above and below the zero
   * line, and an engine that masks no SVG element, such as WebKit, keeps a flat 0.3 fill. A bar
   * rounds the corners of its far end by `--chart-bar-radius`.
   */
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
   * "none" leaves hover out. With hover, a pointer over a value shows a dashed crosshair and a dot
   * there, fades the rest of the series and draws the line around the value, or the value's bar, at
   * full strength, and moving to the next value cross-fades the marks. The hover is CSS, shows only
   * on a device that hovers, and adds no tab stop and nothing to the accessible name. It writes a
   * region of about half a kilobyte and five elements per value, so a 30-value line is about 18 KB
   * and 150 elements with it and 1.4 KB and 3 elements without, and a 168-value line about 106 KB
   * against 7 KB. Pass "none" where many Sparklines render at once, such as one per row of a long
   * table.
   */
  "data-hover"?: "none";
  /**
   * "none" turns the entrance off. A line wipes in from the left, an area fills behind it, and bars
   * grow from the baseline. The entrance plays whenever the svg enters the document, so it replays
   * when the element is inserted again, as a keyed row that a sort moves or a panel shown again is.
   * Pass "none" where that happens, such as a Sparkline in a sortable table. Reduced motion draws
   * the marks at rest either way.
   */
  "data-intro"?: "none";
} & (
    | {
        /**
         * The first value's slot start. Pass `start`, `interval` and `timeZone` together, and the
         * range sentence names the slots of the lowest and highest values. Without them it names no
         * slots.
         */
        start?: never;
        /** Each value's slot length. Pass it with `start` and `timeZone`. */
        interval?: never;
        /** The IANA zone the slot labels read in. Pass it with `start` and `interval`. */
        timeZone?: never;
      }
    | {
        /**
         * The first value's slot start. Pass `start`, `interval` and `timeZone` together, and the
         * range sentence names the slots of the lowest and highest values. Without them it names no
         * slots.
         */
        start: ChartInstant;
        /** Each value's slot length. Pass it with `start` and `timeZone`. */
        interval: Interval;
        /** The IANA zone the slot labels read in. Pass it with `start` and `interval`. */
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

/**
 * The one set of hover marks `SparklineHover` moves: a band that re-strokes the line, for a line or
 * an area, a crosshair and a dot, each in a group the glide translates. It stays hidden until a
 * `SparklineHover` around the Sparkline hydrates, places it and marks it `data-glide`, which takes
 * hover over from the regions, and it sits beside them, so the markup's depth stays the same at any
 * length. The band's path is the whole line. One group clips it at the band's start and the group
 * inside clips it at the band's end, so each edge glides on its own, and the path moves against
 * both, so the line holds still while the band slides along it.
 */
function GlideMarks({ band }: { readonly band?: string }): ReactElement {
  return (
    // SparklineHover's controller writes this group's place as inline custom properties and its
    // `data-glide` marker, maybe before a Suspense boundary around the Sparkline hydrates, so
    // hydration leaves them be.
    <g {...SPARKLINE_SLOT.glide} suppressHydrationWarning>
      {band === undefined ? null : (
        <g data-part={SPARKLINE_PART.bandStart}>
          <g data-part={SPARKLINE_PART.bandEnd}>
            <path {...SPARKLINE_SLOT.path} data-part={SPARKLINE_PART.glide} d={band} />
          </g>
        </g>
      )}
      <g data-part={SPARKLINE_PART.crosshair}>
        <line {...SPARKLINE_SLOT.crosshair} data-part={SPARKLINE_PART.glide} x1="0" x2="0" y1="0" y2="100%" />
      </g>
      <g data-part={SPARKLINE_PART.dot}>
        <path {...SPARKLINE_SLOT.dot} data-part={SPARKLINE_PART.glide} d="M0,0Z" />
      </g>
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
 * accessible name and no tab stop, and `data-hover="none"` leaves it out. Inside a
 * `SparklineHover`, once it hydrates, one crosshair, one dot and one band glide from value to value
 * on a spring instead.
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
  const hover =
    props["data-hover"] === "none" || layout.readings.length === 0 ? null : (
      <>
        {layout.readings.map((reading) => (
          <HoverRegion key={reading.index} reading={reading}>
            {"bar" in reading ? (
              <Bar reading={reading} part={SPARKLINE_PART.highlight} />
            ) : (
              <path {...SPARKLINE_SLOT.path} data-part={SPARKLINE_PART.highlight} d={reading.segment} />
            )}
          </HoverRegion>
        ))}
        {layout.kind === "path" ? <GlideMarks band={layout.stroke} /> : <GlideMarks />}
      </>
    );
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
        {hover}
        {layout.dot === null ? null : <Dot at={layout.dot} />}
      </g>
    </svg>
  );
}

Object.assign(Sparkline, { displayName: "Sparkline" });
