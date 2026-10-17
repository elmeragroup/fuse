// `scripts/cut-music.ts` loads this module under Node's type stripping, which resolves only
// explicit extensions, so its imports name theirs.
import { BEAT_SECONDS, FPS, TRACK_BARS, trackSeconds } from "../music/beat-grid.ts";
import type { MusicEdit } from "../music/music-edit.ts";
import { sceneGrid } from "../music/scene-grid.ts";

/**
 * Every scene in running order with its length in whole bars. The cut plays the track's first 32
 * bars, then crossfades into its outro (`MUSIC_EDIT` below), so cut bars map to the track's sections:
 * the build-up under the hero, the drums entering on bar 8 with the brand morph's first turn, a
 * phrase lift on bar 16 with the density scene, the montage to bar 32, the outro's drums under the
 * install scene and the drums stopping on bar 40, where the lockup holds over the track's ending.
 */
const SCENES = [
  { name: "hero", bars: 6 },
  { name: "brandMorph", bars: 10 },
  { name: "density", bars: 6 },
  { name: "montage", bars: 10 },
  { name: "install", bars: 8 },
  { name: "lockup", bars: 9 },
] as const;

/** The release cut's scenes on the beat grid. */
const GRID = sceneGrid(SCENES);

/** A scene's place on the cut's timeline in frames. */
export const sceneFrames = GRID.frames;

/** The whole cut, in frames. */
export const FUSE_RELEASE_FRAMES = GRID.totalFrames;

/** The cut bar the edit splices the outro on: the install scene's first. */
const SPLICE_BAR = GRID.startBar("install");

// The cut plays the file from its start, so cut bar n is the track's bar n until the splice. The
// splice must fall where the track's drum section ends, or the edit plays into the breakdown.
if (SPLICE_BAR !== TRACK_BARS.breakdown) {
  throw new Error(
    `The install scene starts on cut bar ${String(SPLICE_BAR)}, but the music edit splices on the track's bar ${String(TRACK_BARS.breakdown)}, where its drums end. Re-cut the edit in grid.ts with the scene grid.`
  );
}

/**
 * The music edit. The cut plays the track's file from its start to the splice, the downbeat that
 * ends its drum section, then the outro, whose first downbeat lands on the splice, to the cut's end
 * with a fade over its last beat.
 */
export const MUSIC_EDIT: MusicEdit = {
  file: "music/local/fuse-release-cut.wav",
  runs: [
    { cutSeconds: 0, trackSeconds: 0 },
    { cutSeconds: trackSeconds(SPLICE_BAR), trackSeconds: trackSeconds(TRACK_BARS.outro) },
  ],
  crossfade: 2 / FPS,
  fadeIn: 0,
  fadeOut: BEAT_SECONDS,
  duration: FUSE_RELEASE_FRAMES / FPS,
};
