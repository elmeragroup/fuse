/**
 * A gauge's geometry: where a reading sits on the dial, how many notches it lights, where the
 * notches and the ruler's ticks fall, and the radii every layer draws at. Every angle here is an
 * offset in degrees from the sweep's start, along the sweep's direction, so a clockwise and a
 * counter-clockwise sweep need no special case. Every radius is a share of the radius the layer
 * draws at: the stylesheet scales the track's layers in by the room a Zone band or an outside Ruler
 * takes at the rim, so the radii here never depend on which parts a chart renders.
 */
import { tickIncrement } from "d3-array";

import { toDegrees } from "./polar-angle";
import type { Sweep } from "./polar-angle";

/** How many notches a notched track holds over its sweep, whatever the sweep's width. */
export const GAUGE_NOTCHES = 40;

/**
 * The radii a gauge's layers draw at, as shares of their layer's radius. The track's layers, the
 * inside ruler, the needle, the sector and the dots scale together by `--_gauge-track`, the Zone
 * band by `--_gauge-zone`, the ProgressRing by `--_gauge-ring`, and the outside ruler draws at the
 * rim.
 */
export const GAUGE_RADII = {
  /** A notch runs from this radius to the rim. */
  notchInner: 0.84,
  /** A solid track's band runs from this radius to the rim. */
  solidInner: 0.9,
  /** The inside ruler's ticks hang in from this radius. */
  rulerInside: 0.8,
  /** A major tick's length, and a minor tick's. */
  majorTick: 0.07,
  minorTick: 0.035,
  /** Where the needle's tip and its base sit. */
  needleTip: 0.8,
  needleBase: 0.58,
  /** The half width of a triangle needle's base. */
  needleHalfWidth: 0.035,
  /** A Zone band runs from this radius to its layer's rim. */
  zoneInner: 0.955,
  /** A ProgressRing's band runs from this radius to its layer's rim. */
  ringInner: 0.975,
  /** A Sector reaches this radius, inside the notches and a gap. */
  sector: 0.8,
  /** A Sector starts at this radius, outside the centre's text, which it never runs under. */
  sectorInner: 0.6,
  /** The outermost ring of Dots, the step between rings and between dots, and a dot's radius. */
  dotsOuter: 0.76,
  dotStep: 0.07,
  dotRadius: 0.018,
} as const;

/**
 * The room the rim layers take, as shares of the outer radius, from the rim inward: an outside
 * ruler's ticks and their gap, a Zone band and its gap, and a ProgressRing and its gap. `chart.css`
 * reads the same numbers into `--_gauge-zone`, `--_gauge-ring` and `--_gauge-track`.
 */
export const GAUGE_RIM = { ruler: 0.11, zone: 0.08, ring: 0.06 } as const;

/** The gap between two notches in CSS pixels, before it rounds to whole device pixels. */
export const NOTCH_GAP_PX = 2;

/** A notch's corner radius in CSS pixels, which d3 clamps on a notch too small for it. */
export const NOTCH_CORNER_PX = 1.5;

/**
 * The CSS pixels per unit of the outer radius the server assumes, so its notches are the ones a
 * 15rem dial draws at one device pixel per CSS pixel. The browser measures and paints them again.
 */
export const NOMINAL_SCALE = 120;

/** The dial the server lays out, and the browser before it measures, at one device pixel per CSS pixel. */
export const NOMINAL_PIXELS: DialPixels = { scale: NOMINAL_SCALE, dpr: 1 };

/** A gauge's domain: the value at the sweep's start and the value at its end. */
export type GaugeDomain = { readonly min: number; readonly max: number };

/** Where a reading lies against the domain: below `min`, inside it, or above `max`. */
export type GaugePlace = "under" | "within" | "over";

/**
 * Where a value lies against the domain.
 *
 * @param domain - The domain.
 * @param value - The reading.
 * @returns Its place.
 */
export function gaugePlace(domain: GaugeDomain, value: number): GaugePlace {
  if (value < domain.min) return "under";
  if (value > domain.max) return "over";
  return "within";
}

/**
 * How far along the sweep a value sits, clamped to the sweep: `min` at 0 and `max` at the sweep's
 * width.
 *
 * @param domain - The domain, `max` above `min`.
 * @param sweep - The sweep.
 * @param value - The reading.
 * @returns The offset in degrees, 0 to the sweep's width.
 */
export function gaugeOffset(domain: GaugeDomain, sweep: Sweep, value: number): number {
  return gaugeShare(domain, value) * sweep.width;
}

/**
 * A value's share of the domain, clamped: 0 at `min` and below, 1 at `max` and above. A gauge's loop
 * moves the share, which every mark turns into an angle on the sweep it draws now.
 *
 * @param domain - The domain, `max` above `min`.
 * @param value - The reading.
 * @returns The share, 0 to 1.
 */
export function gaugeShare(domain: GaugeDomain, value: number): number {
  return Math.min(1, Math.max(0, (value - domain.min) / (domain.max - domain.min)));
}

/**
 * The angle of an offset, in the polar convention's degrees from 12 o'clock, clockwise.
 *
 * @param sweep - The sweep.
 * @param offset - Degrees from the sweep's start, along its direction.
 * @returns The angle.
 */
export function gaugeAngle(sweep: Sweep, offset: number): number {
  return sweep.start + offset * sweep.direction;
}

/**
 * How many notches an offset lights: its share of the sweep in whole notches, rounded to the
 * nearest, and at least one for any offset above 0, so a value just above `min` still reads.
 *
 * @param offset - The offset in degrees, as the sweep shows it this frame.
 * @param width - The sweep's width in degrees.
 * @param count - The notches on the sweep.
 * @returns The lit count, 0 to `count`.
 */
export function litNotches(offset: number, width: number, count: number): number {
  if (!(offset > 0) || !(width > 0)) return 0;
  return Math.min(count, Math.max(1, Math.round((count * offset) / width)));
}

/** How a gauge's notches lie along the sweep, every notch alike. */
export type NotchLayout = {
  /** One notch's angular width in degrees. */
  readonly width: number;
  /** The angle from one notch's centre to the next one's, a notch and a gap. */
  readonly step: number;
  /** One notch's corner radius, in units of the layer's radius. */
  readonly corner: number;
};

/** What the browser measured a dial at: CSS pixels per unit of its radius and the device pixel ratio. */
export type DialPixels = {
  /** CSS pixels per unit of the layer's radius, the track's scale included. */
  readonly scale: number;
  /** Device pixels per CSS pixel. */
  readonly dpr: number;
};

/**
 * The notches' layout. Every gap is the same whole number of device pixels, 2 CSS pixels rounded and
 * at least one device pixel, measured at the notches' inner edge, where a gap is narrowest, and the
 * notches share what the gaps leave of the sweep, so every notch is as wide as every other: the
 * bars rule. A full turn holds a gap after its last notch too, so the gap where the turn closes is
 * as wide as every other.
 *
 * @param sweep - The sweep.
 * @param count - The notch count, 1 or more.
 * @param pixels - The measured dial.
 * @returns The layout.
 */
export function notchLayout(sweep: Sweep, count: number, pixels: DialPixels): NotchLayout {
  const inner = GAUGE_RADII.notchInner * pixels.scale;
  const dpr = pixels.dpr > 0 ? pixels.dpr : 1;
  const gapPixels = Math.max(1, Math.round(NOTCH_GAP_PX * dpr)) / dpr;
  const gap = inner > 0 && count > 1 ? toDegrees(gapPixels / inner) : 0;
  // A full turn closes on itself, so its last notch has a gap before the first one too: it holds as
  // many gaps as notches, where an open sweep holds one gap fewer.
  const gaps = isFullTurn(sweep) ? count : count - 1;
  // A dial too small for its gaps keeps a sliver of each notch rather than none.
  const room = Math.max(sweep.width - gap * gaps, sweep.width * 0.25);
  const width = room / count;
  const step = gaps > 0 ? (sweep.width - (isFullTurn(sweep) ? 0 : width)) / gaps : 0;
  return { width, step, corner: pixels.scale > 0 ? NOTCH_CORNER_PX / pixels.scale : 0 };
}

/**
 * Whether a sweep closes on itself, so marks evenly spaced along it repeat its start at its end.
 *
 * @param sweep - The sweep.
 * @returns Whether it runs a whole turn.
 */
export function isFullTurn(sweep: Sweep): boolean {
  return sweep.width >= 360;
}

/**
 * The offset of notch `index`'s centre from the sweep's start.
 *
 * @param layout - The notches' layout.
 * @param index - The notch, 0 at the start.
 * @returns Degrees from the sweep's start.
 */
export function notchCentre(layout: NotchLayout, index: number): number {
  return layout.width / 2 + index * layout.step;
}

/** One tick of a ruler. */
export type RulerTick = {
  /** The value the tick marks. */
  readonly value: number;
  /** Its offset from the sweep's start in degrees. */
  readonly offset: number;
  /** Whether it is a major tick, which a label marks. */
  readonly major: boolean;
};

/** A ruler's spacing: its intervals over the domain, and how many intervals one major spans. */
export type RulerSpacing = { readonly ticks: number; readonly majorEvery: number };

/** The minor intervals each major holds, by the major step's leading digit: 1, 2 or 5. */
const MINORS = { 1: 5, 2: 4, 5: 5 } as const;

/** The fallback when the domain has no round major step that divides it. */
const FALLBACK: RulerSpacing = { ticks: 20, majorEvery: 5 };

/** The interval counts a ruler tries for its majors, most preferred first. */
const MAJOR_COUNTS = [5, 4, 6, 3, 8, 10, 2] as const;

/**
 * A ruler's spacing for a domain: majors on d3's round step for about five intervals, or the first
 * of four, six, three, eight, ten or two whose round step divides the domain into at most 12
 * majors, each split into minors by the step's leading digit, so 0 to 5 kWh reads 0, 1, 2 … 5 with
 * a tick each 0.2, and 0 to 11 kW reads each kilowatt. A domain no round step divides takes 20
 * intervals and a major each 5.
 *
 * @param domain - The domain.
 * @returns The spacing.
 */
export function rulerSpacing(domain: GaugeDomain): RulerSpacing {
  for (const count of MAJOR_COUNTS) {
    const increment = tickIncrement(domain.min, domain.max, count);
    // d3 writes a step below 1 as its inverse, negated: -5 is 0.2.
    const step = increment < 0 ? -1 / increment : increment;
    const majors = (domain.max - domain.min) / step;
    const whole = Math.round(majors);
    if (!(step > 0) || Math.abs(majors - whole) > 1e-9 || whole < 1 || whole > 12) continue;
    const digit = Number(step.toExponential().charAt(0));
    const minors = digit === 1 || digit === 2 || digit === 5 ? MINORS[digit] : 5;
    return { ticks: whole * minors, majorEvery: minors };
  }
  return FALLBACK;
}

/**
 * A ruler's ticks, from `min` to `max`, evenly spaced, every `majorEvery`th one major. The last
 * tick is major only where the intervals divide into whole majors. A full turn leaves out `max`,
 * which lies on `min`.
 *
 * @param domain - The domain.
 * @param sweep - The sweep.
 * @param spacing - The intervals and the major interval, each a whole number of 1 or more.
 * @returns The ticks, from `min` on.
 */
export function rulerTicks(domain: GaugeDomain, sweep: Sweep, spacing: RulerSpacing): readonly RulerTick[] {
  const ticks = Math.max(1, Math.round(spacing.ticks));
  const every = Math.max(1, Math.round(spacing.majorEvery));
  // A full turn's `max` lies on its `min`, so it draws one tick and one label there, `min`'s.
  return Array.from({ length: isFullTurn(sweep) ? ticks : ticks + 1 }, (_, index): RulerTick => {
    const share = index / ticks;
    return {
      // The value from the share, so the last tick is `max` itself, with no float drift.
      value: index === ticks ? domain.max : domain.min + share * (domain.max - domain.min),
      offset: share * sweep.width,
      major: index % every === 0,
    };
  });
}

/**
 * The offsets a value range covers on the sweep, clamped to the domain.
 *
 * @param domain - The domain.
 * @param sweep - The sweep.
 * @param from - One end of the range.
 * @param to - The other end.
 * @returns The start and end offsets, the start first, or null where the range covers no arc.
 */
export function rangeOffsets(
  domain: GaugeDomain,
  sweep: Sweep,
  from: number,
  to: number
): { readonly start: number; readonly end: number } | null {
  const start = gaugeOffset(domain, sweep, Math.min(from, to));
  const end = gaugeOffset(domain, sweep, Math.max(from, to));
  return end > start ? { start, end } : null;
}

/** One ring of Dots: its radius and each dot's offset along the sweep. */
export type DotRing = { readonly radius: number; readonly offsets: readonly number[] };

/** The most rings Dots draws, which keeps the innermost clear of the centre's text. */
export const MAX_DOT_RINGS = 6;

/**
 * The rings of Dots, outermost first, each `dotStep` inside the last. Each ring's dots run from the
 * sweep's start to its end, a full turn's stopping a gap short of its start, as many as keep the
 * arc between two dots near `dotStep`, so the dots of every ring sit as far apart as the rings do.
 *
 * @param sweep - The sweep.
 * @param rings - The ring count, 1 to `MAX_DOT_RINGS`.
 * @returns The rings.
 */
export function dotRings(sweep: Sweep, rings: number): readonly DotRing[] {
  const count = Math.min(MAX_DOT_RINGS, Math.max(1, Math.round(rings)));
  const arc = (sweep.width * Math.PI) / 180;
  return Array.from({ length: count }, (_, ring): DotRing => {
    const radius = GAUGE_RADII.dotsOuter - ring * GAUGE_RADII.dotStep;
    const gaps = Math.max(1, Math.round((radius * arc) / GAUGE_RADII.dotStep));
    // A full turn's last dot would sit on its first, so it draws one dot per gap.
    const dots = isFullTurn(sweep) ? gaps : gaps + 1;
    return {
      radius,
      offsets: Array.from({ length: dots }, (_, dot) => (dot / gaps) * sweep.width),
    };
  });
}

/**
 * Whether the reading has reached a mark at an offset, as a ruler's tick and a dot light: a reading
 * above `min` reaches every mark at or behind it, and one at `min` reaches none.
 *
 * @param mark - The mark's offset in degrees.
 * @param offset - The offset the dial shows.
 * @returns Whether the mark is reached.
 */
export function reached(mark: number, offset: number): boolean {
  return offset > 0 && mark <= offset + 1e-9;
}
