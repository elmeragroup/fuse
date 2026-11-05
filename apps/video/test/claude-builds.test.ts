import { describe, expect, it } from "vitest";

import { DROP_BAR, MUSIC_EDIT, STOP_BAR } from "../src/claude-builds/grid";
import { FLIPS, HOME_LOOK } from "../src/claude-builds/session-script";
import { wrapRows } from "../src/components/remocn/claude-code-grid";
import { bars, FPS } from "../src/music/beat-grid";

// Unit under test: `wrapRows`, the terminal's line wrapping. Oracle: rows wrapped by hand at the
// given widths, as a terminal wraps a line at word boundaries and breaks a word longer than a row.
describe("wrapRows", () => {
  it("wraps at the last space that fits", () => {
    expect(wrapRows("hey claude, make me a component", 12)).toEqual([
      "hey claude,",
      "make me a",
      "component",
    ]);
  });

  it("breaks a word longer than a row inside it", () => {
    expect(wrapRows("ok abcdefghijkl", 5)).toEqual(["ok", "abcde", "fghij", "kl"]);
  });

  it("keeps an empty line as one empty row", () => {
    expect(wrapRows("", 10)).toEqual([""]);
  });
});

/**
 * Where the film's cut plays a moment of the track: in the last run that has spliced in by then.
 * A measured moment may fall a hair before the bar line its run starts on, so a run takes it from
 * a frame before its splice.
 */
function cutSecondsOf(trackMoment: number): number | undefined {
  return MUSIC_EDIT.runs
    .map((run, index) => {
      const at = run.cutSeconds + (trackMoment - run.trackSeconds);
      const next = MUSIC_EDIT.runs[index + 1]?.cutSeconds ?? MUSIC_EDIT.duration;
      return at >= run.cutSeconds - 1 / FPS && at < next ? at : undefined;
    })
    .findLast((at) => at !== undefined);
}

/** How far a film moment may sit from the track's: a frame, and the grid's 20 ms of drift. */
const WITHIN = 1 / FPS + 0.02;

// Unit under test: the session's flips. Oracle: WCAG 2.3.1, no more than three flashes in any
// one-second period, where a flash is a pair of opposing changes in luminance. The page turns
// between light and dark at most three times a second, which stays under it with room to spare.
describe("the page's flips", () => {
  it("turns between light and dark at most three times in any second", () => {
    const turns = FLIPS.filter(
      (flip, index) => flip.look.scheme !== (FLIPS[index - 1]?.look.scheme ?? HOME_LOOK.scheme)
    ).map((flip) => flip.at);
    const busiest = Math.max(
      ...turns.map((at) => turns.filter((other) => other >= at && other < at + FPS).length)
    );
    expect(busiest).toBeLessThanOrEqual(3);
  });

  // Oracle: the track's chord changes through its drop, measured from the file by comparing each
  // bar's pitch classes with the bar before's: 89.32 s, 92.11 s, 94.90 s and 97.69 s.
  it("turns through the drop only on the track's chord changes", () => {
    const turns = FLIPS.filter((flip) => flip.at >= bars(DROP_BAR) && flip.at < bars(STOP_BAR)).map(
      (flip) => flip.at / FPS
    );
    const changes = [89.32, 92.11, 94.9, 97.69].map((moment) => cutSecondsOf(moment) ?? Number.NaN);
    expect(turns).toHaveLength(changes.length);
    for (const [index, at] of turns.entries()) {
      expect(Math.abs(at - (changes[index] ?? Number.NaN))).toBeLessThan(WITHIN);
    }
  });
});

// Unit under test: the film's music edit. Oracle: the track's sections, measured from the file
// (`apps/video/AGENTS.md`): its big drop at 89.32 s and the downbeat its drums stop on at 212.11 s.
// The edit must play each on the film's own downbeat for it, within a frame.
describe("the music edit", () => {
  it("plays the drop on the film's drop bar", () => {
    expect(Math.abs((cutSecondsOf(89.32) ?? Number.NaN) - bars(DROP_BAR) / FPS)).toBeLessThan(WITHIN);
  });

  it("stops the drums on the film's stop bar", () => {
    expect(Math.abs((cutSecondsOf(212.11) ?? Number.NaN) - bars(STOP_BAR) / FPS)).toBeLessThan(WITHIN);
  });
});
