/**
 * One stretch of the track in a cut: from `cutSeconds` into the cut, the cut plays the track's file
 * from `trackSeconds` on, until the next run's splice. Both times are bar lines of the beat grid.
 */
export type MusicRun = {
  readonly cutSeconds: number;
  readonly trackSeconds: number;
};

/**
 * A film's music edit, in seconds, which `scripts/cut-music.ts` renders into one file the film
 * plays from its first frame at constant gain. The first run starts the cut. Every later run
 * splices in on its own downbeat through an equal-power crossfade that ends on that downbeat. The
 * cut fades in over its first `fadeIn` seconds and out over its last `fadeOut` seconds, so it
 * never starts or ends on a click.
 */
export type MusicEdit = {
  /** The cut file, under `public/`. Git ignores its folder, as it does the track's. */
  readonly file: string;
  readonly runs: readonly [MusicRun, ...MusicRun[]];
  /** How long each crossfade into a run lasts, ending on its splice. */
  readonly crossfade: number;
  /** How long the first fade lasts, from silence, or `0` when the first run opens on silence. */
  readonly fadeIn: number;
  /** How long the last fade lasts, ending on the cut's last frame. */
  readonly fadeOut: number;
  /** The cut's length. */
  readonly duration: number;
};
