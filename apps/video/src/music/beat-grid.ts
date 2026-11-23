/** Every composition's frame rate. */
export const FPS = 30;

/**
 * The soundtrack's beat grid: "Edge of the World" by OceanKing (see `apps/video/AGENTS.md`), a
 * drum-and-bass track at 172 BPM in 4/4, so a bar lasts 60 × 4 / 172 = 1.3953 s, just under 42
 * frames. A comb filter over its onsets peaks at 171.998 BPM with the first downbeat at 0.017 s,
 * and the kicks that open its sections land within 20 ms of that grid 3.5 minutes in. Every film
 * cut from the track times its scenes on this grid.
 */
const BPM = 172;
const BEATS_PER_BAR = 4;

/** One beat of the track, in seconds. */
export const BEAT_SECONDS = 60 / BPM;

/**
 * The frame `n` beats into the timeline that calls it. Fractions are allowed; the result rounds to
 * the nearest frame. Measure every boundary from the same origin so rounding never accumulates.
 *
 * @param n - Beats from the origin.
 * @returns The frame the beat falls on.
 */
export function beats(n: number): number {
  return Math.round(((n * 60) / BPM) * FPS);
}

/**
 * The frame `n` bars into the timeline that calls it.
 *
 * @param n - Bars from the origin, fractions allowed.
 * @returns The frame of that bar's downbeat.
 */
export function bars(n: number): number {
  return beats(n * BEATS_PER_BAR);
}

/**
 * How long `n` bars last, in seconds, unrounded, so a splice lands on the sample of its downbeat
 * rather than on the nearest frame.
 *
 * @param n - Bars, fractions allowed.
 * @returns The seconds.
 */
export function barSeconds(n: number): number {
  return (n * BEATS_PER_BAR * 60) / BPM;
}

/**
 * The track's sections, as the bars where they change, measured from the track. Every film's edit
 * cuts on these bars, so a new track needs them measured again.
 */
export const TRACK_BARS = {
  /** The first drum section enters after the build-up. */
  drumsEnter: 8,
  /** The first drum section ends and the breakdown begins. */
  breakdown: 32,
  /** The drums return for the second drum section, which builds to the drop. */
  drumsReturn: 48,
  /** The big drop, the track's loudest section, whose chords change every two bars. */
  drop: 64,
  /** The outro begins. */
  outro: 144,
  /** The drums stop for good and the ending begins; its last notes decay by bar 161. */
  drumsStop: 152,
} as const;

/** The track's first downbeat, in seconds into the file. */
const FIRST_DOWNBEAT = 0.017;

/**
 * Where the track's bar `n` starts, in seconds into its file. A cut that plays the file from its
 * start keeps the file's clock, so its own bar `n` falls at `trackSeconds(n)` in the cut too.
 *
 * @param n - Bars from the track's first downbeat.
 * @returns The bar's downbeat in the file.
 */
export function trackSeconds(n: number): number {
  return FIRST_DOWNBEAT + barSeconds(n);
}
