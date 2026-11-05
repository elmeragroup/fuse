import type { CSSProperties, ReactElement, ReactNode } from "react";

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { tv } from "tailwind-variants";

import { Badge } from "@elmeragroup/fuse/badge";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";

import { CLAMP } from "../motion/easing";

/** The spring the version badge pops in on. */
const POP = { damping: 14, stiffness: 180, mass: 0.7 } as const;

/** Frames the badge takes to fade in as it pops. */
const POP_FADE_FRAMES = 4;

/** How far the name lifts as it leaves, in stage pixels. */
const AWAY_LIFT = 12;

/**
 * The site's lockup: the Elmera mark beside the Fuse wordmark, as in the landing nav, and the
 * version. The release film and the brand book's close draw it large; the Claude Code film's close
 * draws it a step smaller, with a bolder version, under its install command.
 */
const fuseLockup = tv({
  slots: {
    row: "flex items-center gap-7",
    mark: "w-auto",
    wordmark: "font-semibold font-heading tracking-[-0.03em]",
    badge: "px-4 py-1.5 font-mono",
  },
  variants: {
    size: {
      // `leading-none` follows the size, which would otherwise reset it in the merge.
      large: { mark: "h-24", wordmark: "text-[120px] leading-none", badge: "text-[28px]" },
      medium: { mark: "h-22", wordmark: "text-[112px] leading-none", badge: "font-bold text-[26px]" },
    },
  },
});

/** Props for {@link FuseLockup}. */
export type FuseLockupProps = {
  readonly version: string;
  readonly size: "large" | "medium";
  /** The frame the version pops in on; it shows from the first frame when omitted. */
  readonly popAt?: number;
  /** How far the name and version have left, from `0` to `1`; they stay when it is omitted. */
  readonly away?: number;
  /** Stands in for the Elmera mark, for a scene that draws the mark itself. */
  readonly mark?: ReactNode;
  /** Places the row. */
  readonly className?: string;
  readonly style?: CSSProperties;
};

/**
 * The Fuse lockup: the Elmera mark, the Fuse wordmark and the version badge in one row. Each scene
 * keeps its own caption or install row underneath.
 *
 * @returns The lockup row.
 */
export function FuseLockup({
  version,
  size,
  popAt,
  away,
  mark,
  className,
  style,
}: FuseLockupProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slots = fuseLockup({ size });
  const left = away ?? 0;
  const popIn = popAt === undefined ? 1 : interpolate(frame, [popAt, popAt + POP_FADE_FRAMES], [0, 1], CLAMP);
  let badgeStyle: CSSProperties | undefined;
  if (popAt !== undefined) {
    const pop = spring({ fps, frame: frame - popAt, config: POP });
    badgeStyle = { opacity: popIn * (1 - left), scale: String(0.6 + 0.4 * pop) };
  } else if (away !== undefined) {
    badgeStyle = { opacity: 1 - left };
  }
  return (
    <div className={slots.row({ className })} style={style}>
      {mark ?? <ElmeraGroupLogo variant="mark" className={slots.mark()} aria-hidden />}
      <span
        className={slots.wordmark()}
        style={
          away === undefined
            ? undefined
            : { opacity: 1 - left, translate: `0 ${String(-AWAY_LIFT * left)}px` }
        }>
        Fuse
      </span>
      <span style={badgeStyle}>
        <Badge variant="secondary" className={slots.badge()}>
          {version}
        </Badge>
      </span>
    </div>
  );
}

/**
 * The scale of a closing scene that holds over the track's ending, so it drifts closer the whole
 * time instead of freezing.
 *
 * @param to - The scale it reaches on the scene's last frame.
 * @returns The CSS `scale` for the current frame.
 */
export function useDriftCloser(to: number): string {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return String(interpolate(frame, [0, durationInFrames], [1, to], CLAMP));
}
