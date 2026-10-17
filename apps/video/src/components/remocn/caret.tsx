import type { CSSProperties, ReactElement } from "react";

import { useCurrentFrame, useVideoConfig } from "remotion";

// From the remocn registry (`@remocn/caret`), restyled for Fuse: the caret takes the text colour.

/** Props for {@link Caret}. */
export type CaretProps = {
  /** Whether the caret blinks; it holds solid while text is being typed. */
  readonly blink: boolean;
  readonly style?: CSSProperties;
};

/**
 * Whether a blinking caret shows on a frame. It blinks once a second, on for the first half of
 * each blink.
 *
 * @param frame - The frame.
 * @param fps - The frame rate.
 * @returns 1 when the caret shows, 0 when it hides.
 */
function caretBlinkOpacity(frame: number, fps: number): number {
  return Math.floor(frame / (fps / 2)) % 2 === 0 ? 1 : 0;
}

/**
 * A text caret, 0.08em wide and one line tall, in the current text colour.
 *
 * @returns The caret.
 */
export function Caret({ blink, style }: CaretProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        flexShrink: 0,
        width: "0.08em",
        height: "1.1em",
        marginLeft: "0.06em",
        verticalAlign: "text-bottom",
        background: "currentColor",
        opacity: blink ? caretBlinkOpacity(frame, fps) : 1,
        ...style,
      }}
    />
  );
}
