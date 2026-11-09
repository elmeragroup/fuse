/**
 * The reveal planner: how content replaces its skeleton, decided from how the skeleton loaded and
 * what the content holds. Pure, so every decision is a table entry the unit tests write out.
 * The timings are the reveal's own: Fuse has no shared motion duration tokens to read them from.
 */

/** How content replaces its skeleton. */
export type SkeletonRevealMode = "smart" | "together" | "sequence";

/** A skeleton up for less than this is a flash, so `smart` holds a client skeleton back this long. */
const SKELETON_HOLD_MS = 150;
/** The crossfade of a `together` reveal, and of each piece in a sequence. */
export const REVEAL_FADE_MS = 200;
/** A refetch's crossfade: its skeleton was drawn from the content on screen, so it is familiar. */
const REFETCH_FADE_MS = 120;
/** From the first piece of a sequenced reveal to the last. */
const CASCADE_MS = 320;
/** How much later smaller text arrives than the main text of its row. */
const SECONDARY_DELAY_MS = 60;
/** Wheel, touch or key input this recent means someone is mid-gesture, so content lands at once. */
export const INPUT_WINDOW_MS = 400;
/** The ease from the skeleton's height to the content's. */
export const RESIZE_MS = 280;
/** The resize's easing: a fast start that settles, so the new height is near at once. */
export const RESIZE_EASING = "cubic-bezier(0.2, 0, 0, 1)";
/** Content shorter than this reveals together under `smart`. */
const SMALL_HEIGHT_PX = 72;
/** Content in this many pieces or fewer reveals together under `smart`. */
const SMALL_PIECES = 3;

/** What a reveal knows as its content lands. */
export type RevealContext = {
  /** Milliseconds the skeleton was up; `Infinity` when it was server-rendered. */
  readonly shownMs: number;
  /** Whether someone scrolled, touched or typed within the last `INPUT_WINDOW_MS`. */
  readonly recentInput: boolean;
  /** Whether the skeleton was drawn over the data on screen, as a forced `loading` does. */
  readonly refetch: boolean;
  /** The content's height in pixels. */
  readonly height: number;
  /** How many pieces the content arrives in: leaves holding text or media of their own. */
  readonly pieces: number;
};

/** How each piece of a sequenced reveal is timed. */
export type SequenceOrder =
  /** By its place in the reveal: down, then a little across. */
  | "position"
  /** Rows and cards as units, top to bottom on screen, smaller text a moment later. */
  | "row";

/** The plan for one reveal. */
export type RevealPlan =
  | { readonly kind: "instant" }
  | { readonly kind: "together"; readonly durationMs: number }
  | { readonly kind: "sequence"; readonly order: SequenceOrder; readonly durationMs: number };

/**
 * How long a mode holds a client-rendered skeleton back before showing it. Only `smart` holds:
 * a load faster than the hold never shows its skeleton, while the space stays reserved.
 *
 * @param mode - The reveal mode.
 * @returns The hold in milliseconds.
 */
export function skeletonHoldMs(mode: SkeletonRevealMode): number {
  return mode === "smart" ? SKELETON_HOLD_MS : 0;
}

/**
 * Plans how content replaces its skeleton.
 *
 * @param mode - The reveal mode the caller chose.
 * @param context - How the skeleton loaded and what the content holds.
 * @returns The plan: at once, one crossfade, or a sequence of pieces.
 */
export function planReveal(mode: SkeletonRevealMode, context: RevealContext): RevealPlan {
  switch (mode) {
    case "together":
      return { kind: "together", durationMs: REVEAL_FADE_MS };
    case "sequence":
      return { kind: "sequence", order: "position", durationMs: REVEAL_FADE_MS };
    case "smart":
      return planSmart(context);
  }
}

/** `smart`: at once when the skeleton was a flash or someone is busy, else by size and source. */
function planSmart(context: RevealContext): RevealPlan {
  if (context.recentInput || context.shownMs < SKELETON_HOLD_MS) return { kind: "instant" };
  if (context.refetch) return { kind: "together", durationMs: REFETCH_FADE_MS };
  if (context.height < SMALL_HEIGHT_PX || context.pieces <= SMALL_PIECES) {
    return { kind: "together", durationMs: REVEAL_FADE_MS };
  }
  return { kind: "sequence", order: "row", durationMs: REVEAL_FADE_MS };
}

/** A box in viewport pixels. */
export type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Clamps a value to `[0, max]`. */
function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

/**
 * A `sequence` piece's delay: its place down the reveal weighs 0.8 and its place across 0.2,
 * spread over `CASCADE_MS`.
 *
 * @param piece - The piece's box.
 * @param reveal - The whole reveal's box.
 * @returns The delay in milliseconds, from 0 to `CASCADE_MS`.
 */
export function positionDelayMs(piece: Box, reveal: Box): number {
  const down = (piece.top - reveal.top) / Math.max(reveal.height, 1);
  const across = (piece.left - reveal.left) / Math.max(reveal.width, 1);
  return clamp(down * 0.8 + across * 0.2, 1) * CASCADE_MS;
}

/** Where a `smart` sequence piece sits: its row or card, and whether its text is the smaller. */
export type RowPiece = {
  /** The piece's own box. */
  readonly box: Box;
  /** The row or card it belongs to, or null for a piece outside any. */
  readonly unit: Box | null;
  /** Whether its text is smaller than the largest in its unit. */
  readonly secondary: boolean;
};

/**
 * A `smart` sequence piece's delay: its row's place down the screen spread over `CASCADE_MS`,
 * with smaller text `SECONDARY_DELAY_MS` later. A piece off screen arrives at once, as `null`.
 *
 * @param piece - The piece, its unit and whether its text is secondary.
 * @param viewportHeight - The viewport's height in pixels.
 * @returns The delay in milliseconds, or null to arrive at once.
 */
export function rowDelayMs(piece: RowPiece, viewportHeight: number): number | null {
  const onScreen = (box: Box): boolean => box.top + box.height > 0 && box.top < viewportHeight;
  if (piece.unit === null) return onScreen(piece.box) ? 0 : null;
  if (!onScreen(piece.unit)) return null;
  // Timed against the screen, not the reveal, so two reveals landing together read as one page.
  const at = clamp(piece.unit.top / Math.max(viewportHeight, 1), 1) * CASCADE_MS;
  return at + (piece.secondary ? SECONDARY_DELAY_MS : 0);
}
