// `scripts/cut-music.ts` loads this module under Node's type stripping, which resolves only
// explicit extensions, so its imports name theirs.
import { BEAT_SECONDS, FPS, TRACK_BARS, trackSeconds } from "../music/beat-grid.ts";
import type { MusicEdit } from "../music/music-edit.ts";
import { sceneGrid } from "../music/scene-grid.ts";

/**
 * The film's two scenes in whole bars: one continuous session, the prompt, the build, the theme
 * flips and the punchline, then the lockup. A cut inside the session would break the shot, so its
 * beats are times on its own timeline (`session-script.ts`) instead of scenes.
 */
const SCENES = [
  { name: "session", bars: 43 },
  { name: "lockup", bars: 5 },
] as const;

/** The film's scenes on the beat grid. */
const GRID = sceneGrid(SCENES);

/** A scene's place on the film's timeline in frames. */
export const sceneFrames = GRID.frames;

/** The whole film, in frames. */
export const CLAUDE_BUILDS_FRAMES = GRID.totalFrames;

/** The film bar the track's big drop lands on, where the flips peak and the page takes the frame. */
export const DROP_BAR = 32;

/**
 * Through the drop the track's chords change every two bars (track bars 64, 66, 68 and 70), and
 * the page takes a new look and the camera pans on each change.
 */
export const CHORD_BARS = 2;

/** The bars of the track's second drum section the edit plays before its drop. */
const PICKUP_BARS = 8;

/**
 * The film bar where the edit picks up the track's second drum section, so its drop lands on
 * `DROP_BAR`; the film plays the track's file from its start up to it.
 */
const PICKUP_BAR = DROP_BAR - PICKUP_BARS;

/** The film bar where the drums stop and the session lands its last line. */
export const STOP_BAR = 40;

/** The track's drum sections loop in 16-bar phrases, and the edit jumps between them. */
const PHRASE_BARS = 16;

/** The track bar the edit picks up on. */
const TRACK_PICKUP_BAR = TRACK_BARS.drop - PICKUP_BARS;

// Until the flip the film plays the first drum section. The jump into the second section must keep
// the bar's place in its phrase, or the edit skips mid-phrase.
if (
  PICKUP_BAR < TRACK_BARS.drumsEnter ||
  PICKUP_BAR > TRACK_BARS.breakdown ||
  (TRACK_PICKUP_BAR - PICKUP_BAR) % PHRASE_BARS !== 0
) {
  throw new Error(
    `The pickup on film bar ${String(PICKUP_BAR)} picks up the track on bar ${String(TRACK_PICKUP_BAR)}, which leaves the first drum section or its 16-bar phrase. Re-cut the edit in grid.ts with the session's beats.`
  );
}

/**
 * The music edit: the track's build-up and first drum section under the prompt and the build, the
 * second drum section from the same place in its phrase into the drop under the flips, and the
 * downbeat where the drums stop for good under the punchline and the lockup, to the film's end
 * with a fade over its last beat.
 */
export const MUSIC_EDIT: MusicEdit = {
  file: "music/local/claude-builds-cut.wav",
  runs: [
    { cutSeconds: 0, trackSeconds: 0 },
    { cutSeconds: trackSeconds(PICKUP_BAR), trackSeconds: trackSeconds(TRACK_PICKUP_BAR) },
    { cutSeconds: trackSeconds(STOP_BAR), trackSeconds: trackSeconds(TRACK_BARS.drumsStop) },
  ],
  crossfade: 2 / FPS,
  fadeIn: 0,
  fadeOut: BEAT_SECONDS,
  duration: CLAUDE_BUILDS_FRAMES / FPS,
};

// Studio and the root read these through `sceneFrames`; the session's beats are measured from its
// own first frame, which is the film's.
if (GRID.startBar("session") !== 0 || GRID.startBar("lockup") <= STOP_BAR) {
  throw new Error("The session must open the film and run past the stop; re-time SCENES in grid.ts.");
}
