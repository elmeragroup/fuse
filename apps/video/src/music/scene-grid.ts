// `scripts/cut-music.ts` loads this module, through the films' grids, under Node's type
// stripping, which resolves only explicit extensions, so its imports name theirs.
import { bars } from "./beat-grid.ts";

/** A scene in a film's running order and its length in whole bars. */
export type GridScene<Name extends string> = {
  readonly name: Name;
  readonly bars: number;
};

/** Where a scene sits on its film's timeline, in frames. */
export type SceneSpan = {
  readonly from: number;
  readonly durationInFrames: number;
};

/** A film's scenes laid end to end on the beat grid. */
export type SceneGrid<Name extends string> = {
  /** The film bar a scene starts on: the bars of every scene before it. */
  readonly startBar: (scene: Name) => number;
  /**
   * A scene's place on the film's timeline in frames. Both ends round from absolute bars, so
   * every cut lands within half a frame of its downbeat and rounding never accumulates.
   */
  readonly frames: (scene: Name) => SceneSpan;
  /** The whole film, in frames. */
  readonly totalFrames: number;
};

/**
 * Lays a film's scenes end to end on the beat grid, in running order.
 *
 * @param scenes - The scenes, each lasting whole bars.
 * @returns The scenes' places and the film's length.
 */
export function sceneGrid<Name extends string>(scenes: readonly GridScene<Name>[]): SceneGrid<Name> {
  const startBar = (scene: Name): number => {
    const index = scenes.findIndex((entry) => entry.name === scene);
    return scenes.slice(0, index).reduce((total, entry) => total + entry.bars, 0);
  };
  const totalBars = scenes.reduce((total, entry) => total + entry.bars, 0);
  return {
    startBar,
    frames: (scene) => {
      const start = startBar(scene);
      const length = scenes.find((entry) => entry.name === scene)?.bars ?? 0;
      return { from: bars(start), durationInFrames: bars(start + length) - bars(start) };
    },
    totalFrames: bars(totalBars),
  };
}
