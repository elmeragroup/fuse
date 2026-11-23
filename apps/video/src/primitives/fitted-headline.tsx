import type { ReactElement, ReactNode } from "react";

import { fitText } from "@remotion/layout-utils";

import { VIDEO_FONT } from "./font-gate";

/** The headline type every scene shares. Measuring and drawing read the same values. */
const WEIGHT = 600;
const TRACKING = "-0.03em";
const LINE_HEIGHT = 1.05;

/** Props for {@link FittedHeadline}. */
export type FittedHeadlineProps = {
  /** Every line the block shows, in every state; the longest sets the size. */
  readonly lines: readonly string[];
  /** The width every line must fit, in stage pixels. */
  readonly width: number;
  /** The size the block uses when every line already fits. */
  readonly maxSize: number;
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * A headline block sized so every line fits its slot at one size, up to `maxSize`. Locales
 * differ in length, so the slot keeps its layout and the longest line sets the size. It measures
 * while it renders, so it must render inside `FontGate`, which guarantees the face has loaded;
 * Remotion caches each measurement, so one taken with a fallback face would stick.
 *
 * @returns The block, with the fitted type on it.
 */
export function FittedHeadline({
  lines,
  width,
  maxSize,
  className,
  children,
}: FittedHeadlineProps): ReactElement {
  const sizes = lines.map(
    (text) =>
      fitText({
        text,
        withinWidth: width,
        fontFamily: VIDEO_FONT,
        fontWeight: WEIGHT,
        letterSpacing: TRACKING,
        // FontGate has loaded the face. Remotion's check compares against the body's inherited
        // font, which is Roboto too once a Fuse theme sets --font-sans, so it reports a false miss.
        validateFontIsLoaded: false,
      }).fontSize
  );
  return (
    <div
      className={className}
      style={{
        width,
        fontSize: Math.floor(Math.min(maxSize, ...sizes)),
        fontWeight: WEIGHT,
        lineHeight: LINE_HEIGHT,
        letterSpacing: TRACKING,
      }}>
      {children}
    </div>
  );
}
