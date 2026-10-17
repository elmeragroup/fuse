import { BEAT_SECONDS, beats, FPS } from "../../../music/beat-grid";
import { STAGE } from "../../../primitives/stage";

/**
 * The collage's world: a wider sheet than the stage, drawn at 80%, so the plates keep Fuse's own
 * sizes while more of them share the frame with paper between them, as the template's do.
 */
export const WORLD = {
  scale: 0.8,
  width: STAGE.width / 0.8,
  height: STAGE.height / 0.8,
} as const;

/** One lane: where it stands, how fast it drifts and how deep it sits, in world pixels. */
export type Lane = {
  /** Its left edge in the world. */
  readonly x: number;
  readonly width: number;
  /** Its drift in world pixels per frame once in place; negative runs up. */
  readonly velocity: number;
  readonly depth: "front" | "back";
  /** Frames after the drop before its stack starts pushing in. */
  readonly delay: number;
};

/**
 * The collage's lanes, the template's travelling columns: each holds a stack of plates that drifts
 * at its own speed once the stacks have pushed in. Three front lanes run up and hold most of the
 * component plates; four back lanes run down behind and beside them, smaller and softened, so the
 * layers part in depth as the template's do. The outer back lanes stand half off the sheet.
 */
export const LANES = {
  left: { x: -150, width: 300, velocity: 1.2, depth: "back", delay: 5 },
  a: { x: 60, width: 360, velocity: -2.3, depth: "front", delay: 0 },
  b: { x: 380, width: 320, velocity: 1.8, depth: "back", delay: 3 },
  c: { x: 620, width: 380, velocity: -2.9, depth: "front", delay: 1 },
  d: { x: 940, width: 320, velocity: 1.7, depth: "back", delay: 4 },
  e: { x: 1180, width: 360, velocity: -2.2, depth: "front", delay: 2 },
  right: { x: 1450, width: 300, velocity: 1.3, depth: "back", delay: 6 },
} as const satisfies Record<string, Lane>;

/** A lane of the collage. */
export type LaneName = keyof typeof LANES;

/** The lanes back to front, the order they paint in. */
export const PAINT_ORDER: readonly LaneName[] = ["left", "b", "d", "right", "a", "c", "e"];

/** The gap between two plates in a lane, in world pixels. */
const PLATE_GAP = 22;

/** How far a stack travels as it pushes in, in world pixels, from below or above the sheet. */
export const ENTRY_TRAVEL = WORLD.height * 0.75;

/** Frames a stack takes to push in. */
export const ENTRY_FRAMES = 18;

/** The scale a back lane's plates draw at, and how soft they are, so the layers part in depth. */
export const BACK_DEPTH = { scale: 0.9, blur: 1 } as const;

/** One plate's slot: its lane, its top on the frame its stack lands, and its height. */
export type PlateSlot = {
  readonly lane: LaneName;
  readonly top: number;
  readonly height: number;
};

/**
 * How far inside the sheet a plate stays while its overlay is open, in world pixels: clear of the
 * camera's push-in, so a popup never meets the frame's edge, where Base UI would flip or shrink it.
 */
const OVERLAY_MARGIN = 60;

/** One beat in frames, unrounded, so a frame converts to the beat it falls in. */
const FRAMES_PER_BEAT = BEAT_SECONDS * FPS;

/** The frames a plate's overlay is open on, each on a beat of the collage. */
export type OverlayWindow = {
  readonly openAt: number;
  /** The frame it closes on, or infinity when it stays open to the collage's end. */
  readonly closeAt: number;
};

/**
 * When a plate's overlay is open: from the first beat after the plate has landed wholly inside the
 * sheet to the last beat before it leaves, a beat early, so the popup is placed against the plate
 * and never against the frame's edge. Base UI places a popup from where its trigger is on screen,
 * so a popup opened only on these frames lands in the same place whichever frame mounted it.
 *
 * @param slot - The plate's slot.
 * @param durationInFrames - The collage's length.
 * @returns The window, or `null` when the plate is never inside long enough to open.
 */
export function overlayWindow(slot: PlateSlot, durationInFrames: number): OverlayWindow | null {
  const lane = LANES[slot.lane];
  const highest = OVERLAY_MARGIN;
  const lowest = WORLD.height - OVERLAY_MARGIN - slot.height;
  if (lowest < highest) {
    return null;
  }
  // The plate's top is `slot.top + velocity * frame` once its stack has landed.
  const crossing = (top: number) => (top - slot.top) / lane.velocity;
  const [enters, leaves] =
    lane.velocity < 0 ? [crossing(lowest), crossing(highest)] : [crossing(highest), crossing(lowest)];
  const from = Math.max(enters, lane.delay + ENTRY_FRAMES);
  const openAt = beats(Math.ceil(from / FRAMES_PER_BEAT) + 1);
  const closeAt =
    leaves >= durationInFrames ? Number.POSITIVE_INFINITY : beats(Math.floor(leaves / FRAMES_PER_BEAT) - 1);
  return closeAt - openAt < beats(2) || openAt >= durationInFrames ? null : { openAt, closeAt };
}

/**
 * Stacks a lane's plates top to bottom from `top`, each `PLATE_GAP` below the last.
 *
 * @param lane - The lane.
 * @param top - The first plate's top on the frame the stack lands, in world pixels.
 * @param heights - Each plate's height, top to bottom.
 * @returns Each plate's slot, in the same order.
 */
export function stack(lane: LaneName, top: number, heights: readonly number[]): readonly PlateSlot[] {
  let cursor = top;
  return heights.map((height) => {
    const slot = { lane, top: cursor, height };
    cursor += height + PLATE_GAP;
    return slot;
  });
}
