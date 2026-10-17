import type { CSSProperties, ReactElement, ReactNode } from "react";

import { Easing, interpolate, useCurrentFrame } from "remotion";

import { CLAMP } from "../../motion/easing";

// From the remocn registry (`@remocn/selection-snap`), restyled for Fuse and turned on a box: a
// loose viewfinder snaps tight around a part on the stage instead of around a word, its corner arms
// close into a hairline box, the handles pop and a badge names what was selected. It draws in the
// theme's foreground on its background, so it reads in every brand and scheme, and it lifts away
// on a frame the caller names. The word, its weight change and the size readout are left out.

/** Corners first, then edge midpoints, as fractions of the box. */
const HANDLES = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0.5, 0],
  [1, 0.5],
  [0.5, 1],
  [0, 0.5],
] as const;

/** remocn's cubic curves, from a local cubic so they never borrow a bound method. */
const cubic = (t: number): number => t ** 3;
const EASE_OUT = Easing.out(cubic);
const EASE_IN_OUT = Easing.inOut(cubic);
const SNAP_EASE = Easing.bezier(0.34, 1.3, 0.64, 1);
const POP_EASE = Easing.out(Easing.back(1.7));

/** Padding around the box before and after the snap, in stage pixels. */
const PADDING = { loose: 18, tight: 4 } as const;

/** The stroke, the handles and the arms before they close, in stage pixels. */
const STROKE = 1.5;
const HANDLE = 8;
const ARM = 14;

/** Frames the selection takes to lift away. */
const LEAVE_FRAMES = 8;

/** Back-eased 0 → 1 over `duration` frames from `start`, never below 0. */
function pop(t: number, start: number, duration: number): number {
  return Math.max(0, interpolate(t, [start, start + duration], [0, 1], { ...CLAMP, easing: POP_EASE }));
}

/** A box on the stage, in stage pixels. */
export type SelectionBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** Props for {@link SelectionSnap}. */
export type SelectionSnapProps = {
  /** The part to select. */
  readonly box: SelectionBox;
  /** The frame the viewfinder appears on. */
  readonly at: number;
  /** The frame it lifts away on; it stays when it is omitted. */
  readonly leaveAt?: number;
  /** How much faster than remocn's 38-frame timing it runs. */
  readonly speed?: number;
  /** What the badge under the box says. */
  readonly children: ReactNode;
};

/**
 * A design-tool selection that snaps onto a part: the viewfinder settles, snaps tight with a small
 * overshoot, its arms close into a box, the handles pop and the badge names the part. It fills
 * its positioned parent and ignores pointer events.
 *
 * @returns The selection layer, or nothing before `at` and after it has left.
 */
export function SelectionSnap({
  box,
  at,
  leaveAt,
  speed = 1,
  children,
}: SelectionSnapProps): ReactElement | null {
  const frame = useCurrentFrame();
  const t = (frame - at) * speed;
  const left =
    leaveAt === undefined
      ? 0
      : interpolate(frame, [leaveAt, leaveAt + LEAVE_FRAMES], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
  if (t < 0 || left >= 1) {
    return null;
  }
  const intro = interpolate(t, [0, 8], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const settle = interpolate(t, [0, 8], [1.06, 1], { ...CLAMP, easing: EASE_OUT });
  const snap = interpolate(t, [14, 28], [0, 1], { ...CLAMP, easing: SNAP_EASE });
  const edges = interpolate(t, [16, 26], [0, 1], { ...CLAMP, easing: EASE_IN_OUT });
  const badge = pop(t, 24, 8);
  const padding = PADDING.loose + (PADDING.tight - PADDING.loose) * snap;
  // Percentages resolve against the box's width for `width` and its height for `height`, so one
  // expression grows every arm to its edge's midpoint.
  const along = `calc(${String(ARM)}px + (50% - ${String(ARM)}px) * ${String(edges)})`;
  const arms: readonly CSSProperties[] = [
    { top: 0, left: 0, width: along, height: STROKE },
    { top: 0, right: 0, width: along, height: STROKE },
    { bottom: 0, left: 0, width: along, height: STROKE },
    { bottom: 0, right: 0, width: along, height: STROKE },
    { top: 0, left: 0, width: STROKE, height: along },
    { bottom: 0, left: 0, width: STROKE, height: along },
    { top: 0, right: 0, width: STROKE, height: along },
    { bottom: 0, right: 0, width: STROKE, height: along },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: 1 - left }}>
      <div
        className="absolute"
        style={{
          left: box.x - padding,
          top: box.y - padding,
          width: box.width + 2 * padding,
          height: box.height + 2 * padding,
          opacity: intro,
          scale: String(settle),
        }}>
        {arms.map((style, index) => (
          <div key={index} className="absolute bg-foreground" style={style} />
        ))}
        {HANDLES.map(([x, y], index) => (
          <div
            key={`${String(x)}-${String(y)}`}
            className="absolute border-foreground bg-background"
            style={{
              left: `${String(x * 100)}%`,
              top: `${String(y * 100)}%`,
              width: HANDLE,
              height: HANDLE,
              borderWidth: STROKE,
              borderStyle: "solid",
              translate: "-50% -50%",
              scale: String(pop(t, 24 + index, 5)),
            }}
          />
        ))}
        <div
          className="text-xs absolute top-full left-0 mt-3 flex items-center gap-2 rounded-sm bg-foreground px-2 py-1 font-mono whitespace-nowrap text-background"
          style={{
            opacity: Math.min(1, badge),
            translate: `0 ${String((1 - badge) * 8)}px`,
            scale: String(0.6 + 0.4 * badge),
            transformOrigin: "0 0",
          }}>
          {children}
        </div>
      </div>
    </div>
  );
}
