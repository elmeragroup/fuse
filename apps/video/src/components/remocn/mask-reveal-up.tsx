import type { ReactElement } from "react";

import { interpolate, useCurrentFrame } from "remotion";

import { CLAMP, ENTER, EXIT } from "../../motion/easing";

// From the remocn registry (`@remocn/mask-reveal-up`), restyled for Fuse: the lines inherit the
// surrounding type and colour, each line takes its own class and its own start, and the
// exit starts on a frame the caller names instead of the composition's last frames. Every line is
// laid out from the first frame, so a line arriving never moves one already on screen.

const ENTER_FRAMES = 23;
const ENTER_TRAVEL_FRAMES = 11;
const EXIT_FRAMES = 16;
const EXIT_TRAVEL_FROM = 8;
const EXIT_STAGGER = 2;
/** How far each line rises, in stage pixels. */
const RISE_DISTANCE = 30;

/** One revealed line: its text, the class that styles it and the frame it rises on. */
export type RevealLine = {
  readonly text: string;
  readonly className?: string;
  /** The frame the line starts rising on; the first frame by default. */
  readonly at?: number;
};

/** Props for {@link MaskRevealUp}. */
export type MaskRevealUpProps = {
  /** The lines, top to bottom. */
  readonly lines: readonly RevealLine[];
  /** The frame the lines start leaving on; they stay when it is omitted. */
  readonly exitAt?: number;
};

/**
 * Lines that rise in out of a blur, each on its own frame, and leave the same way, one after another.
 *
 * @returns The block of lines.
 */
export function MaskRevealUp({ lines, exitAt }: MaskRevealUpProps): ReactElement {
  const frame = useCurrentFrame();
  return (
    <span>
      {lines.map((line, index) => {
        const enter = frame - (line.at ?? 0);
        const exit = exitAt === undefined ? -1 : frame - exitAt - index * EXIT_STAGGER;
        const entered = interpolate(enter, [0, ENTER_FRAMES], [0, 1], { ...CLAMP, easing: ENTER });
        const left = interpolate(exit, [0, EXIT_FRAMES], [0, 1], { ...CLAMP, easing: EXIT });
        const rise = interpolate(enter, [0, ENTER_TRAVEL_FRAMES], [RISE_DISTANCE, 0], {
          ...CLAMP,
          easing: ENTER,
        });
        const lift = interpolate(exit, [EXIT_TRAVEL_FROM, EXIT_FRAMES], [0, -22], {
          ...CLAMP,
          easing: EXIT,
        });
        const blur = interpolate(enter, [0, ENTER_FRAMES], [6, 0], { ...CLAMP, easing: ENTER }) + left * 6;
        return (
          <span
            key={line.text}
            className={line.className}
            style={{
              display: "block",
              opacity: entered * (1 - left),
              translate: `0 ${String(rise + lift)}px`,
              filter: `blur(${String(blur)}px)`,
            }}>
            {line.text}
          </span>
        );
      })}
    </span>
  );
}
