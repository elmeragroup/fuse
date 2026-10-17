import type { ReactElement, ReactNode } from "react";

import { interpolate, useCurrentFrame } from "remotion";

import { CLAMP, ENTER, EXIT } from "../motion/easing";

const ENTER_FRAMES = 18;
const EXIT_FRAMES = 12;

/** Props for {@link Rise}. */
export type RiseProps = {
  /** The frame the block starts rising on. */
  readonly at: number;
  /** The frame the block starts leaving on; it stays when it is omitted. */
  readonly exitAt?: number;
  /** How far it rises, in stage pixels. */
  readonly distance?: number;
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * A block that rises in out of a soft blur and lifts out the same way: the remocn mask-reveal
 * motion applied to any content, so captions and panels move like the headlines.
 *
 * @returns The animated block.
 */
export function Rise({ at, exitAt, distance = 24, className, children }: RiseProps): ReactElement {
  const frame = useCurrentFrame();
  const entered = interpolate(frame - at, [0, ENTER_FRAMES], [0, 1], { ...CLAMP, easing: ENTER });
  const left =
    exitAt === undefined
      ? 0
      : interpolate(frame - exitAt, [0, EXIT_FRAMES], [0, 1], { ...CLAMP, easing: EXIT });
  return (
    <div
      className={className}
      style={{
        opacity: entered * (1 - left),
        translate: `0 ${String((1 - entered) * distance - left * distance)}px`,
        filter: `blur(${String((1 - entered) * 6 + left * 6)}px)`,
      }}>
      {children}
    </div>
  );
}
