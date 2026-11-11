import { describe, expect, it } from "vitest";

/**
 * Unit under test: the edit session's transitions (`date-input-session.ts`). Oracle: React Aria's
 * `useDateSegment` (`onInput`, `backspace`) and `useDateFieldState` (`setValue`,
 * `confirmPlaceholder`) applied by hand to each gesture, and the session's own rule that a draft
 * belongs to the committed value it was typed over. Expectations are written out.
 */
import "../../temporal-polyfill";
import type { TemporalValue } from "../../temporal/temporal-value";
import type { EditableSegmentType } from "./date-draft";
import {
  basisOf,
  canceled,
  confirm,
  draftOver,
  entryOf,
  erase,
  initialSession,
  paste,
  rebase,
  step,
  typeKey,
} from "./date-input-session";
import type { SessionSettings, SessionState } from "./date-input-session";

function settings(committed: TemporalValue | null, controlled = false): SessionSettings {
  return {
    committed,
    controlled,
    editable: true,
    fields: ["year", "month", "day"],
    units: "date-time",
    readText: () => undefined,
    zoneInstant: () => 0,
    hourCycle: "h12",
    kind: { kind: "PlainDate" },
    dayPeriods: ["AM", "PM"],
    locale: "en-US",
    placeholder: () => Temporal.PlainDate.from("2030-06-15"),
  };
}

function session(own: TemporalValue | null): SessionState {
  return initialSession(own, basisOf(own, "h12", DATE_FIELDS, "date-time"));
}

const OCT_5 = Temporal.PlainDate.from("2026-10-05");
const DATE_FIELDS = ["year", "month", "day"] as const;
const MINUTE_FIELDS = ["year", "month", "day", "hour", "dayPeriod", "minute"] as const;

describe("typeKey", () => {
  it("keeps a month digit that may still grow, and restarts on a digit past the maximum", () => {
    const first = typeKey(session(OCT_5), "month", "1", settings(OCT_5));
    expect(first.focus).toBeUndefined();
    expect(first.state.entered).toBe("1");
    expect(first.commit).toEqual({ value: Temporal.PlainDate.from("2026-01-05"), reason: "input-change" });

    const second = typeKey(first.state, "month", "3", settings(Temporal.PlainDate.from("2026-01-05")));
    expect(second.focus).toBe("next");
    expect(second.state.entered).toBe("");
    expect(second.commit?.value?.toString()).toBe("2026-03-05");
  });

  it("holds a lone zero as a draft without committing", () => {
    const outcome = typeKey(session(OCT_5), "month", "0", settings(OCT_5));
    expect(outcome.commit).toBeUndefined();
    expect(outcome.state.draft?.month).toBe(0);
  });

  it("sets the day period by its first letter and moves on", () => {
    const value = Temporal.PlainDateTime.from("2026-10-05T09:30");
    const zoned = {
      ...settings(value),
      fields: ["year", "month", "day", "hour", "dayPeriod", "minute"] as const,
    };
    const outcome = typeKey(session(value), "dayPeriod", "p", zoned);
    expect(outcome.commit?.value?.toString()).toBe("2026-10-05T21:30:00");
    expect(outcome.focus).toBe("next");
  });
});

describe("erase", () => {
  it("clears a two-digit day in one press and keeps the committed value", () => {
    const outcome = erase(session(OCT_5), { type: "day", text: "05", isPlaceholder: false }, settings(OCT_5));
    expect(outcome.commit).toBeUndefined();
    expect(draftOver(outcome.state, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"))?.day).toBeNull();
    expect(entryOf(outcome.state, OCT_5, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"))).toEqual({
      kind: "partial",
    });
  });

  it("moves back from an empty segment", () => {
    expect(
      erase(session(OCT_5), { type: "day", text: "dd", isPlaceholder: true }, settings(OCT_5)).focus
    ).toBe("previous");
  });

  it("commits a shorter year", () => {
    const outcome = erase(
      session(OCT_5),
      { type: "year", text: "2026", isPlaceholder: false },
      settings(OCT_5)
    );
    expect(outcome.commit?.value?.toString()).toBe("0202-10-05");
  });
});

describe("drafts and committed values", () => {
  it("drops a draft for good when the committed value changes, so a restored value shows itself", () => {
    const cleared = erase(
      session(OCT_5),
      { type: "day", text: "05", isPlaceholder: false },
      settings(OCT_5, true)
    );
    const november = Temporal.PlainDate.from("2026-11-06");
    const replaced = rebase(cleared.state, basisOf(november, "h12", DATE_FIELDS, "date-time"));
    const restored = rebase(replaced, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"));
    expect(draftOver(restored, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"))).toBeNull();
    expect(entryOf(restored, OCT_5, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"))).toEqual({
      kind: "value",
      value: OCT_5,
    });
  });

  it("commits a whole draft on confirm, constrained", () => {
    const january = Temporal.PlainDate.from("2026-01-30");
    const typed = typeKey(session(january), "month", "2", settings(january));
    expect(typed.commit).toBeUndefined();
    const confirmed = confirm(typed.state, settings(january));
    expect(confirmed.commit?.value?.toString()).toBe("2026-02-28");
  });

  it("leaves the input's own value alone when a parent owns it", () => {
    const outcome = step(session(null), "month", 1, settings(OCT_5, true));
    expect(outcome.state.own).toBeNull();
    expect(outcome.commit?.value?.toString()).toBe("2026-11-05");
  });

  it("shows the committed segments again when a commit from a half-typed draft is canceled", () => {
    // The day cleared, then a "1" typed into it: a whole draft that commits October 1. Canceling
    // that commit restores the state before it, whose partial draft must give way to the value.
    const cleared = erase(session(OCT_5), { type: "day", text: "05", isPlaceholder: false }, settings(OCT_5));
    expect(draftOver(cleared.state, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"))?.day).toBeNull();
    const typed = typeKey(cleared.state, "day", "1", settings(OCT_5));
    expect(typed.commit?.value?.toString()).toBe("2026-10-01");

    const restored = canceled(cleared.state);
    expect(draftOver(restored, basisOf(OCT_5, "h12", DATE_FIELDS, "date-time"))).toBeNull();
    expect(restored.entered).toBe("");
    expect(restored.edited).toBe(true);
  });

  it("shows the committed value, not a draft, when typing re-forms that value", () => {
    // October 1 committed; a "1" typed into its day forms October 1 again, so nothing commits and
    // the segments show the value, while the digit stays ready for a second one.
    const october1 = Temporal.PlainDate.from("2026-10-01");
    const typed = typeKey(session(october1), "day", "1", settings(october1));
    expect(typed.commit).toBeUndefined();
    expect(typed.state.draft).toBeNull();
    expect(typed.state.entered).toBe("1");
    expect(entryOf(typed.state, october1, basisOf(october1, "h12", DATE_FIELDS, "date-time"))).toEqual({
      kind: "value",
      value: october1,
    });

    const second = typeKey(typed.state, "day", "5", settings(october1));
    expect(second.commit?.value?.toString()).toBe("2026-10-15");
  });

  it("reads an empty input with no draft as empty", () => {
    expect(entryOf(session(null), null, basisOf(null, "h12", DATE_FIELDS, "date-time"))).toEqual({
      kind: "empty",
    });
  });

  it("drops a draft typed under other fields, so the input reads as what its value is", () => {
    // An empty minute input with its date typed and no time, then shown at day granularity: the
    // draft belonged to the minute segments, so the day input shows its value, which is empty.
    const minuteSettings: SessionSettings = {
      ...settings(null),
      fields: MINUTE_FIELDS,
      kind: { kind: "PlainDateTime" },
      placeholder: () => Temporal.PlainDateTime.from("2030-06-15T00:00"),
    };
    let state = session(null);
    for (const [type, key] of [
      ["month", "1"],
      ["month", "0"],
      ["day", "1"],
      ["day", "2"],
      ["year", "2"],
      ["year", "0"],
      ["year", "2"],
      ["year", "6"],
    ] as const) {
      const typed = typeKey(state, type, key, minuteSettings);
      expect(typed.commit).toBeUndefined();
      state = typed.state;
    }
    expect(entryOf(state, null, basisOf(null, "h12", MINUTE_FIELDS, "date-time"))).toEqual({
      kind: "partial",
    });

    const dayBasis = basisOf(null, "h12", DATE_FIELDS, "date-time");
    expect(draftOver(state, dayBasis)).toBeNull();
    expect(entryOf(state, null, dayBasis)).toEqual({ kind: "empty" });
    const rebased = rebase(state, dayBasis);
    expect(rebased.draft).toBeNull();
    expect(confirm(rebased, settings(null)).commit).toBeUndefined();
  });

  it("keeps a value's hidden time when the draft that emptied its hour is shown at day granularity", () => {
    // 9:30 AM with its hour backspaced empty, then shown at day granularity: the next blur must
    // not read the emptied hour as 12 and commit 00:30.
    const morning = Temporal.PlainDateTime.from("2026-10-05T09:30");
    const minuteSettings: SessionSettings = {
      ...settings(morning),
      fields: MINUTE_FIELDS,
      kind: { kind: "PlainDateTime" },
      placeholder: () => Temporal.PlainDateTime.from("2030-06-15T00:00"),
    };
    const minuteBasis = basisOf(morning, "h12", MINUTE_FIELDS, "date-time");
    const emptied = erase(
      initialSession(morning, minuteBasis),
      { type: "hour", text: "09", isPlaceholder: false },
      minuteSettings
    );
    expect(emptied.commit).toBeUndefined();
    expect(entryOf(emptied.state, morning, minuteBasis)).toEqual({ kind: "partial" });

    const daySettings: SessionSettings = { ...minuteSettings, fields: DATE_FIELDS };
    const rebased = rebase(emptied.state, basisOf(morning, "h12", DATE_FIELDS, "date-time"));
    expect(entryOf(rebased, morning, basisOf(morning, "h12", DATE_FIELDS, "date-time"))).toEqual({
      kind: "value",
      value: morning,
    });
    expect(confirm(rebased, daySettings).commit).toBeUndefined();
  });

  it("commits pasted ISO text converted to the input's kind", () => {
    const outcome = paste(session(OCT_5), " 2027-01-02T10:00 ", settings(OCT_5));
    expect(outcome.commit).toEqual({ value: Temporal.PlainDate.from("2027-01-02"), reason: "input-paste" });
  });

  it("commits text its format reads only when every unit is inside its limits and the value holds it", () => {
    // The format's reading is given, as `readFieldText` would read "02.01.2027" day first, so the
    // session's own rules are under test: limits, completeness and the round trip.
    const reads = (entries: readonly (readonly [EditableSegmentType, number])[]): SessionSettings => ({
      ...settings(OCT_5),
      readText: () => ({
        entries: entries.map(([type, value]) => ({ type, value })),
        namesZoneAt: () => true,
      }),
    });
    expect(
      paste(
        session(OCT_5),
        "text",
        reads([
          ["day", 2],
          ["month", 1],
          ["year", 2027],
        ])
      ).commit
    ).toEqual({
      value: Temporal.PlainDate.from("2027-01-02"),
      reason: "input-paste",
    });
    for (const entries of [
      [
        ["day", 30],
        ["month", 2],
        ["year", 2027],
      ],
      [
        ["day", 2],
        ["month", 13],
        ["year", 2027],
      ],
      [
        ["day", 2],
        ["month", 1],
      ],
    ] as const) {
      expect(paste(session(OCT_5), "text", reads(entries)).commit).toBeUndefined();
    }
  });
});
