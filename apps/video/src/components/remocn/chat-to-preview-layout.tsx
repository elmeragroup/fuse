import type { ReactElement, ReactNode } from "react";

import { Easing, interpolate, useCurrentFrame } from "remotion";

import { CLAMP } from "../../motion/easing";
import { STAGE } from "../../primitives/stage";

// From the remocn registry (`@remocn/chat-to-preview-layout`), adapted for Fuse: the split
// animates through any number of morphs the caller times, instead of one squeeze over a share of
// the sequence, and each column hands its content its size on the frame, so content can scale
// with its column instead of reflowing. The columns keep the stock rounded clip but draw no
// border or surface: a column's content wears its own theme and draws its own frame, because
// Fuse's light themes cannot nest inside a dark scope, and a page in the preview may be light.

/** The stock layout's ease: a fast start that settles slowly, so the squeeze reads as deliberate. */
const MORPH_EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** The layout's padding around both columns and the gap between them, in stage pixels. */
const PADDING = 24;
const GAP = 16;

/** A column's size on the stage this frame, in stage pixels. */
export type ColumnSize = {
  readonly width: number;
  readonly height: number;
};

/** One change of the split: from frame `at`, over `durationInFrames`, to the chat share `to`. */
export type ChatMorph = {
  readonly at: number;
  readonly durationInFrames: number;
  readonly to: number;
};

/** Props for {@link ChatToPreviewLayout}. */
export type ChatToPreviewLayoutProps = {
  /** The chat column's content, given the column's size this frame. */
  readonly chat: (column: ColumnSize) => ReactNode;
  /** The preview column's content, given the column's size this frame. */
  readonly preview: (column: ColumnSize) => ReactNode;
  /** The changes of the split, in time order. The first one reveals the preview. */
  readonly morphs: readonly ChatMorph[];
};

/**
 * The chat column's share of the width on a frame. The chat fills the width before the first
 * morph, and each morph eases from the share before it.
 *
 * @param frame - The layout's frame.
 * @param morphs - The morphs, in time order.
 * @returns The chat column's share, from 0 to 1.
 */
function chatRatioAt(frame: number, morphs: readonly ChatMorph[]): number {
  return morphs.reduce(
    (ratio, morph) =>
      interpolate(frame, [morph.at, morph.at + morph.durationInFrames], [ratio, morph.to], {
        ...CLAMP,
        easing: MORPH_EASE,
      }),
    1
  );
}

/** Both columns' widths for a chat share, and the gap between them, in stage pixels. */
export type SplitWidths = {
  readonly chat: number;
  readonly gap: number;
  readonly preview: number;
};

/**
 * The columns' widths for a chat share. The gap closes as either column reaches zero, so the
 * other one fills the frame.
 *
 * @param ratio - The chat column's share of the width, from 0 to 1.
 * @returns The widths.
 */
export function splitWidths(ratio: number): SplitWidths {
  const inner = STAGE.width - 2 * PADDING;
  const gap = GAP * Math.min(1, ratio * 20, (1 - ratio) * 20);
  const chat = ratio * (inner - gap);
  return { chat, gap, preview: inner - gap - chat };
}

/** The columns' height, the stage's less the padding above and below. */
const COLUMN_HEIGHT = STAGE.height - 2 * PADDING;

/** A column of the split, clipped to its rounded box, which hides while it has no width. */
function Column({
  left,
  width,
  height,
  opacity = 1,
  translate = 0,
  children,
}: {
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly opacity?: number;
  readonly translate?: number;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div
      className="rounded-2xl absolute overflow-hidden"
      style={{
        left,
        top: PADDING,
        width,
        height,
        opacity: width < 1 ? 0 : opacity,
        translate: `${String(translate)}px 0`,
      }}>
      {children}
    </div>
  );
}

/**
 * A two-column split whose chat column gives up width as the preview grows, for showing an agent
 * building something. The preview fades and slides in over the first morph; later morphs move the
 * split again. The gap closes as either column reaches zero, so the other one fills the frame.
 *
 * @returns The split, filling the stage.
 */
export function ChatToPreviewLayout({ chat, preview, morphs }: ChatToPreviewLayoutProps): ReactElement {
  const frame = useCurrentFrame();
  const ratio = chatRatioAt(frame, morphs);
  const first = morphs[0];
  const revealed =
    first === undefined
      ? 1
      : interpolate(frame, [first.at, first.at + first.durationInFrames], [0, 1], {
          ...CLAMP,
          easing: MORPH_EASE,
        });

  const widths = splitWidths(ratio);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Column left={PADDING} width={widths.chat} height={COLUMN_HEIGHT}>
        {chat({ width: widths.chat, height: COLUMN_HEIGHT })}
      </Column>
      <Column
        left={PADDING + widths.chat + widths.gap}
        width={widths.preview}
        height={COLUMN_HEIGHT}
        opacity={revealed}
        translate={(1 - revealed) * 40}>
        {preview({ width: widths.preview, height: COLUMN_HEIGHT })}
      </Column>
    </div>
  );
}
