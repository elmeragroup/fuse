import { describe, expect, it } from "vitest";

import { editSpan, mixEdit } from "../scripts/music-mix";
import type { Stereo } from "../scripts/music-mix";
import type { MusicEdit } from "../src/music/music-edit";

// Unit under test: `mixEdit`, which renders a film's music edit. Oracles, each defined apart from
// the mixer: a splice plays the track's sample `(trackSeconds - cutSeconds) × rate` further on;
// an equal-power crossfade keeps the squares of the two gains summing to one; a fade-out ends
// in silence. A low sample rate keeps the synthetic tracks small; the maths is the same at 48 kHz.
const RATE = 100;

/** A stereo track of `length` samples whose left channel holds `value(i)` and right its negative. */
function track(length: number, value: (index: number) => number): Stereo {
  const left = Float32Array.from({ length }, (_, index) => value(index));
  return [left, left.map((sample) => -sample)];
}

/** A sample the mixed cut must hold. */
function sample(cut: Stereo, channel: 0 | 1, index: number): number {
  const value = cut[channel][index];
  if (value === undefined) {
    throw new Error(`The cut has no sample ${String(index)}`);
  }
  return value;
}

describe("mixEdit", () => {
  it("plays each run from its own place in the track", () => {
    const edit: MusicEdit = {
      file: "three-runs.wav",
      runs: [
        { cutSeconds: 0, trackSeconds: 0 },
        { cutSeconds: 1, trackSeconds: 5 },
        { cutSeconds: 2, trackSeconds: 8 },
      ],
      crossfade: 0.1,
      fadeIn: 0,
      fadeOut: 0.5,
      duration: 3,
    };
    // A ramp, so every sample of the track is told apart by its value.
    const cut = mixEdit(
      track(1100, (index) => index / 1000),
      edit,
      RATE
    );
    // Run 1 plays the track 4 s further on, run 2 6 s further on, each away from its crossfades.
    expect(sample(cut, 0, 50)).toBeCloseTo(0.05, 5);
    expect(sample(cut, 0, 150)).toBeCloseTo(0.55, 5);
    expect(sample(cut, 0, 220)).toBeCloseTo(0.82, 5);
    expect(sample(cut, 1, 220)).toBeCloseTo(-0.82, 5);
  });

  describe("across a splice", () => {
    const edit: MusicEdit = {
      file: "two-runs.wav",
      runs: [
        { cutSeconds: 0, trackSeconds: 0 },
        { cutSeconds: 1, trackSeconds: 3 },
      ],
      crossfade: 0.2,
      fadeIn: 0,
      fadeOut: 0.5,
      duration: 2,
    };
    // The first run reads the track's samples 0–199 and the second its samples 200–399, so a
    // track that is 1 under one run and 0 under the other plays back that run's gain alone.
    const firstGain = mixEdit(
      track(400, (index) => (index < 200 ? 1 : 0)),
      edit,
      RATE
    );
    const secondGain = mixEdit(
      track(400, (index) => (index < 200 ? 0 : 1)),
      edit,
      RATE
    );

    it("plays the first run alone before the crossfade and the second alone after the splice", () => {
      expect(sample(firstGain, 0, 70)).toBe(1);
      expect(sample(secondGain, 0, 70)).toBe(0);
      expect(sample(firstGain, 0, 120)).toBeCloseTo(0, 6);
      expect(sample(secondGain, 0, 120)).toBeCloseTo(1, 6);
    });

    it("keeps the power constant through the crossfade", () => {
      for (let index = 80; index <= 100; index++) {
        const power = sample(firstGain, 0, index) ** 2 + sample(secondGain, 0, index) ** 2;
        expect(power).toBeCloseTo(1, 5);
      }
      // Halfway through, both runs play at √½, where a linear fade would dip to ½ each.
      expect(sample(firstGain, 0, 90)).toBeCloseTo(Math.SQRT1_2, 5);
      expect(sample(secondGain, 0, 90)).toBeCloseTo(Math.SQRT1_2, 5);
    });

    it("fades the last half second down to silence", () => {
      expect(sample(secondGain, 0, 150)).toBeCloseTo(1, 6);
      const fade = Array.from({ length: 50 }, (_, offset) => sample(secondGain, 0, 150 + offset));
      expect(fade.every((value, index) => index === 0 || value <= (fade[index - 1] ?? value))).toBe(true);
      expect(sample(secondGain, 0, 199)).toBeLessThan(0.05);
    });
  });

  it("plays a cut without a fade-in at full gain from its first sample", () => {
    const edit: MusicEdit = {
      file: "no-fade-in.wav",
      runs: [{ cutSeconds: 0, trackSeconds: 0 }],
      crossfade: 0.1,
      fadeIn: 0,
      fadeOut: 0.5,
      duration: 2,
    };
    const cut = mixEdit(
      track(200, () => 1),
      edit,
      RATE
    );
    expect(sample(cut, 0, 0)).toBe(1);
    expect(sample(cut, 1, 0)).toBe(-1);
  });

  it("fades a cut that opens inside the track in from silence", () => {
    const edit: MusicEdit = {
      file: "fade-in.wav",
      runs: [{ cutSeconds: 0, trackSeconds: 4 }],
      crossfade: 0.1,
      fadeIn: 0.5,
      fadeOut: 0.5,
      duration: 2,
    };
    const cut = mixEdit(
      track(600, () => 1),
      edit,
      RATE
    );
    // Equal-power, as the crossfades are: silent on the first sample, √½ halfway, whole after.
    expect(sample(cut, 0, 0)).toBe(0);
    expect(sample(cut, 0, 25)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(sample(cut, 0, 50)).toBe(1);
    expect(sample(cut, 0, 100)).toBe(1);
  });

  it("refuses a track shorter than the edit reads", () => {
    const edit: MusicEdit = {
      file: "too-long.wav",
      runs: [
        { cutSeconds: 0, trackSeconds: 0 },
        { cutSeconds: 1, trackSeconds: 9 },
      ],
      crossfade: 0.1,
      fadeIn: 0,
      fadeOut: 0.5,
      duration: 2,
    };
    expect(() =>
      mixEdit(
        track(500, () => 1),
        edit,
        RATE
      )
    ).toThrow(/reads 1000 samples/);
  });
});

// Unit under test: `editSpan`, which every cut reads before it mixes. Oracle: `MusicEdit`'s
// contract, that the first run starts the cut and each later run splices in after the one before
// it and before the cut ends.
describe("editSpan", () => {
  /** An edit that keeps the contract, for each case to break one way. */
  const valid: MusicEdit = {
    file: "valid.wav",
    runs: [
      { cutSeconds: 0, trackSeconds: 0 },
      { cutSeconds: 1, trackSeconds: 5 },
    ],
    crossfade: 0.1,
    fadeIn: 0,
    fadeOut: 0.5,
    duration: 2,
  };

  it("reads an edit that keeps the contract", () => {
    expect(editSpan(valid, RATE)).toEqual({ starts: [0, 400], length: 200, needed: 600 });
  });

  it("refuses a first run that starts after the cut does", () => {
    const late: MusicEdit = { ...valid, runs: [{ cutSeconds: 0.5, trackSeconds: 3 }] };
    expect(() => editSpan(late, RATE)).toThrow(/first run of valid\.wav/);
  });

  it("refuses a run that splices in before the one ahead of it", () => {
    const swapped: MusicEdit = {
      ...valid,
      runs: [
        { cutSeconds: 0, trackSeconds: 0 },
        { cutSeconds: 1.5, trackSeconds: 5 },
        { cutSeconds: 1, trackSeconds: 8 },
      ],
    };
    expect(() => editSpan(swapped, RATE)).toThrow(/run 2 of valid\.wav/);
  });

  it("refuses a run that splices in after the cut ends", () => {
    const overrun: MusicEdit = {
      ...valid,
      runs: [
        { cutSeconds: 0, trackSeconds: 0 },
        { cutSeconds: 2, trackSeconds: 5 },
      ],
    };
    expect(() => editSpan(overrun, RATE)).toThrow(/run 1 of valid\.wav/);
  });
});
