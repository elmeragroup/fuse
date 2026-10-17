import type { ReactElement } from "react";

import { useCurrentFrame, useVideoConfig } from "remotion";

import { Caret } from "./caret";

// From the remocn registry (`@remocn/typewriter`), restyled for Fuse: it types into the
// surrounding text style instead of a white full-frame card, and it inlines the one timeline
// helper it needs from `@remocn/remocn-ui`.

/**
 * How many characters of a text have been typed a number of frames in.
 *
 * @param frames - Frames since typing started.
 * @param fps - The frame rate.
 * @param length - The text's length in characters.
 * @param charsPerSecond - The typing speed.
 * @returns A count between 0 and `length`.
 */
export function typedCount(frames: number, fps: number, length: number, charsPerSecond: number): number {
  if (frames <= 0) {
    return 0;
  }
  return Math.min(length, Math.floor((frames / fps) * charsPerSecond));
}

/** How fast a {@link Typewriter} types, in characters per second. */
const CHARS_PER_SECOND = 22;

/** Props for {@link Typewriter}. */
export type TypewriterProps = {
  readonly text: string;
  /** The frame typing starts on. */
  readonly startAt?: number;
  readonly className?: string;
};

/**
 * Text typed out character by character, followed by a caret that blinks once typing ends.
 *
 * @returns The typed text and its caret.
 */
export function Typewriter({ text, startAt = 0, className }: TypewriterProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const characters = Array.from(text);
  const count = typedCount(frame - startAt, fps, characters.length, CHARS_PER_SECOND);
  const typing = count > 0 && count < characters.length;
  return (
    <span className={className} style={{ whiteSpace: "pre" }}>
      {characters.slice(0, count).join("")}
      <Caret blink={!typing} />
    </span>
  );
}
