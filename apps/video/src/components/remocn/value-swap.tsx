import type { ReactElement } from "react";

import { interpolate, useCurrentFrame } from "remotion";

import { CLAMP, CUBIC_IN_OUT } from "../../motion/easing";

// From the remocn registry (`@remocn/value-swap`), restyled for Fuse: the values inherit the
// surrounding type and colour, and the sizer holds the widest value in that type, so a role's hex
// or a theme's name changes in place without moving anything beside it.

/** Props for {@link ValueSwap}. */
export type ValueSwapProps = {
  /** The values in order; the first shows until the first swap. */
  readonly values: readonly string[];
  /** The frame of each swap, one fewer than the values. */
  readonly at: readonly number[];
  /** Frames each swap takes. */
  readonly duration?: number;
  /** How far a value travels as it swaps, in stage pixels. */
  readonly distance?: number;
  readonly className?: string;
};

/**
 * A value that swaps in place at the frames it is given: the outgoing value slides up and fades as
 * the next one rides in from below, while a hidden copy of every value holds the widest one's room.
 *
 * @returns The inline value.
 */
export function ValueSwap({
  values,
  at,
  duration = 10,
  distance = 12,
  className,
}: ValueSwapProps): ReactElement {
  const frame = useCurrentFrame();
  const count = Math.min(values.length, at.length + 1);
  const shown = values.slice(0, count);
  const progress = (start: number | undefined) =>
    start === undefined
      ? 0
      : interpolate(frame, [start, start + duration], [0, 1], { ...CLAMP, easing: CUBIC_IN_OUT });
  return (
    <span className={className} style={{ position: "relative", display: "inline-grid" }}>
      {/* Every value laid out in one cell, hidden, so the cell is as wide as the widest. */}
      {shown.map((value, index) => (
        <span
          key={`sizer-${String(index)}`}
          aria-hidden
          style={{ gridArea: "1 / 1", visibility: "hidden", whiteSpace: "nowrap" }}>
          {value}
        </span>
      ))}
      {shown.map((value, index) => {
        const entered = index === 0 ? 1 : progress(at[index - 1]);
        const left = index === count - 1 ? 0 : progress(at[index]);
        const opacity = entered * (1 - left);
        return opacity <= 0 ? null : (
          <span
            key={`${String(index)}-${value}`}
            style={{
              gridArea: "1 / 1",
              whiteSpace: "nowrap",
              opacity,
              translate: `0 ${String((1 - entered) * distance - left * distance)}px`,
            }}>
            {value}
          </span>
        );
      })}
    </span>
  );
}
