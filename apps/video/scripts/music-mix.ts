// `cut-music.ts` loads this module under Node's type stripping, which resolves only explicit
// extensions, so its imports name theirs. It is pure, so the browser suite tests it too.
import type { MusicEdit } from "../src/music/music-edit.ts";

/** Decoded stereo audio, one array per channel, as floats around [-1, 1]. */
export type Stereo = readonly [Float32Array, Float32Array];

/** Where an edit reads the track, in samples. */
export type EditSpan = {
  /** Each run's start in the track: the track's sample the run plays at the cut's first sample. */
  readonly starts: readonly number[];
  /** The cut's length. */
  readonly length: number;
  /** How many samples of the track the edit reads, from the file's start. */
  readonly needed: number;
};

/** A sample index from seconds. */
function at(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

/**
 * A value the edit's own sizes prove exists; a missing one is a defect in the cut, not bad input.
 *
 * @param items - A list sized to the edit.
 * @param index - The index.
 * @returns The value.
 * @throws When the index lies outside the list.
 */
export function itemAt<Item>(items: ArrayLike<Item>, index: number): Item {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Defect: index ${String(index)} lies outside a list sized to the edit.`);
  }
  return item;
}

/**
 * Where an edit reads the track. A run reads on from before its splice, so its crossfade carries
 * the bars leading into it; each reads exactly as many samples as the cut is long.
 *
 * @param edit - The edit.
 * @param sampleRate - Samples per second.
 * @returns The runs' starts, the cut's length and the samples of track it reads.
 * @throws When the first run does not start the cut, a later run splices in out of order or after
 * the cut ends, or a run would start before the track's file does: each a defect in the edit.
 */
export function editSpan(edit: MusicEdit, sampleRate: number): EditSpan {
  const [first, ...later] = edit.runs;
  if (first.cutSeconds !== 0) {
    throw new Error(
      `Defect: the first run of ${edit.file} starts ${String(first.cutSeconds)} s into the cut.`
    );
  }
  for (const [index, run] of later.entries()) {
    if (run.cutSeconds <= itemAt(edit.runs, index).cutSeconds || run.cutSeconds >= edit.duration) {
      throw new Error(
        `Defect: run ${String(index + 1)} of ${edit.file} splices in out of order or after the cut ends.`
      );
    }
  }
  const length = at(edit.duration, sampleRate);
  const starts = edit.runs.map((run) => at(run.trackSeconds, sampleRate) - at(run.cutSeconds, sampleRate));
  if (Math.min(...starts) < 0) {
    throw new Error(`Defect: a run of ${edit.file} splices in before the track's file starts.`);
  }
  return { starts, length, needed: Math.max(...starts) + length };
}

/** A run's crossfade in samples: it starts at `start` and ends on the run's splice. */
type Crossfade = { readonly start: number; readonly splice: number };

/** An edit's splice and fade bounds in samples, which every sample of the cut shares. */
type FadeBounds = {
  /** The cut's length. */
  readonly end: number;
  /** Where the fade out starts. */
  readonly fadeStart: number;
  /** How long the fade in lasts. */
  readonly fadeInLength: number;
  /** Each run's crossfade. */
  readonly crossfades: readonly Crossfade[];
};

/**
 * An edit's splice and fade bounds, computed once per edit rather than once per sample. `end` is
 * the cut's length, as {@link editSpan} gives it.
 */
function fadeBounds(edit: MusicEdit, end: number, sampleRate: number): FadeBounds {
  return {
    end,
    fadeStart: end - at(edit.fadeOut, sampleRate),
    fadeInLength: at(edit.fadeIn, sampleRate),
    crossfades: edit.runs.map((run) => {
      const splice = at(run.cutSeconds, sampleRate);
      return { start: splice - at(edit.crossfade, sampleRate), splice };
    }),
  };
}

/** How far one sample of the cut is into the crossfade that ends on a run's splice, from 0 to 1. */
function crossfadeProgress(index: number, { start, splice }: Crossfade): number {
  return Math.min(1, Math.max(0, (index - start) / (splice - start)));
}

/**
 * The gain of each run and the cut's fades at one sample of the cut. A run fades in over the
 * crossfade ending on its splice and out over the next run's. The crossfades are equal-power,
 * because the runs are not phase-coherent and a linear one dips in the middle; the first and last
 * fades follow the same quarter sine.
 */
function gains(index: number, bounds: FadeBounds): readonly number[] {
  const { end, fadeStart, fadeInLength, crossfades } = bounds;
  const fade = Math.min(1, Math.max(0, (index - fadeStart) / (end - fadeStart)));
  const tail = Math.cos((fade * Math.PI) / 2);
  const head = fadeInLength === 0 ? 1 : Math.sin((Math.min(1, index / fadeInLength) * Math.PI) / 2);
  const progress = crossfades.map((crossfade) => crossfadeProgress(index, crossfade));
  return crossfades.map((_, run) => {
    const fadeIn = run === 0 ? 1 : Math.sin((itemAt(progress, run) * Math.PI) / 2);
    const fadeOut = run === crossfades.length - 1 ? 1 : Math.cos((itemAt(progress, run + 1) * Math.PI) / 2);
    return fadeIn * fadeOut * tail * head;
  });
}

/**
 * Mixes an edit from the decoded track: the file from the first run's start, then each later run,
 * its downbeat on its splice, faded in over the cut's first `fadeIn` seconds and out over its
 * last `fadeOut` seconds.
 *
 * @param source - The decoded track, at least {@link editSpan}'s `needed` samples long.
 * @param edit - The edit.
 * @param sampleRate - The track's samples per second.
 * @returns The cut, before normalising.
 * @throws When the track is shorter than the edit reads; check `needed` first.
 */
export function mixEdit(source: Stereo, edit: MusicEdit, sampleRate: number): Stereo {
  const { starts, length, needed } = editSpan(edit, sampleRate);
  const [left, right] = source;
  if (left.length < needed) {
    throw new Error(`Defect: ${edit.file} reads ${String(needed)} samples of a shorter track.`);
  }
  const runs = starts.map((start): Stereo => [
    left.subarray(start, start + length),
    right.subarray(start, start + length),
  ]);
  const bounds = fadeBounds(edit, length, sampleRate);
  const mixed: Stereo = [new Float32Array(length), new Float32Array(length)];
  for (let index = 0; index < length; index++) {
    const gain = gains(index, bounds);
    for (const [channel, samples] of mixed.entries()) {
      samples[index] = runs.reduce(
        (sum, run, offset) => sum + itemAt(gain, offset) * itemAt(itemAt(run, channel), index),
        0
      );
    }
  }
  return mixed;
}
