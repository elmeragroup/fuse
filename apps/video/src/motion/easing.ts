import { Easing } from "remotion";

/** Holds an `interpolate()` output at its ends instead of extrapolating past them. */
export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The curve everything that arrives settles on: a fast start that eases into place. */
export const ENTER = Easing.bezier(0.22, 1, 0.36, 1);

/** The curve everything that leaves accelerates on. */
export const EXIT = Easing.bezier(0.64, 0, 0.78, 0);

/** The Claude Code film's camera pans through the drop, and its slider's glide: slow out, slow in. */
export const PAN = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * The brand book's push, from the remocn registry (`@remocn/brand-guidelines`, `motion.ts`): the
 * template's one long ease-in-out that every slide, wipe and flip in the brand book shares, so the
 * film moves with the template's even, editorial weight rather than the release cut's snappier
 * settle.
 */
export const PUSH = Easing.bezier(0.65, 0, 0.25, 1);
