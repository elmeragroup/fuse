// `scripts/cut-music.ts` loads this module under Node's type stripping, which resolves only
// explicit extensions, so its imports name theirs.
import { BEAT_SECONDS, barSeconds, FPS, TRACK_BARS, trackSeconds } from "../music/beat-grid.ts";
import type { MusicEdit } from "../music/music-edit.ts";
import { sceneGrid } from "../music/scene-grid.ts";

/**
 * The brand book's scenes in running order, in whole bars. The film plays the track from its bar
 * 46, two bars of pad before the drums return, so the identity holds over the pad, the palette's
 * panels land on the drums, the anatomy's quick cuts run up the drop's build and the collage opens
 * on the drop itself, the track's loudest section. The closing then cuts to the track's ending,
 * where the drums stop, and the lockup holds over its decay.
 */
const SCENES = [
  { name: "identity", bars: 2 },
  { name: "palette", bars: 7 },
  { name: "anatomy", bars: 9 },
  { name: "collage", bars: 8 },
  { name: "closing", bars: 7 },
] as const;

/** The brand book's scenes on the beat grid. */
const GRID = sceneGrid(SCENES);

/** A scene's place on the brand book's timeline in frames. */
export const sceneFrames = GRID.frames;

/** The whole film, in frames. */
export const BRAND_BOOK_FRAMES = GRID.totalFrames;

/** The track's bar the film opens on: two bars of pad and hats before its drums return. */
const TRACK_OPENING_BAR = TRACK_BARS.drumsReturn - 2;

// Film bar n is the track's bar 46 + n until the closing, so the collage must start where the
// track's drop does, or the scene the film is built around misses the drop.
if (TRACK_OPENING_BAR + GRID.startBar("collage") !== TRACK_BARS.drop) {
  throw new Error(
    `The collage starts on film bar ${String(GRID.startBar("collage"))}, which is not the track's drop on bar ${String(TRACK_BARS.drop)}. Re-cut the edit in brand-book/grid.ts with the scene grid.`
  );
}

/**
 * The brand book's music: the track from its bar 46 to the collage's last bar, then its ending from
 * bar 152, whose last drum hit lands on the closing's first frame. The film opens inside the pad,
 * so it fades in over half a beat, and it fades out over its last bar as the ending decays.
 */
export const MUSIC_EDIT: MusicEdit = {
  file: "music/local/brand-book-cut.wav",
  runs: [
    { cutSeconds: 0, trackSeconds: trackSeconds(TRACK_OPENING_BAR) },
    { cutSeconds: barSeconds(GRID.startBar("closing")), trackSeconds: trackSeconds(TRACK_BARS.drumsStop) },
  ],
  crossfade: 2 / FPS,
  fadeIn: BEAT_SECONDS / 2,
  fadeOut: barSeconds(1),
  duration: BRAND_BOOK_FRAMES / FPS,
};
