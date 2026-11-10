// A date input's edit session: what the user has typed, as one state and one set of transitions.
// The state is the draft the segments show over the committed value, the digits typed into the
// focused segment so far, the input's own value when no parent owns it, and whether anything was
// edited since focus entered. Every gesture is a pure transition from a state and the input's
// settings to the next state, plus the value to commit and where focus moves, so the rules are
// React Aria's `useDateFieldState` `setValue` and `useDateSegment` `onInput`/`backspace` in one
// place. The Root holds the state in Calendar's store (`calendar-store.ts`) and applies a
// transition's commit through `onValueChange`, whose `cancel()` keeps the state the commit would
// have left.
//
// A draft belongs to the committed value it was typed over and the segments it was typed into (its
// basis). A commit moves the basis to the value it committed, so a parent echoing that value back
// acknowledges it and the typed digits carry on. Any other change of the committed value, the hour
// cycle or the segments shown drops the draft and the digits for good, so restoring an earlier value
// never brings an abandoned draft back, and a draft never fills segments that are no longer shown.

import { parseTemporal } from "../../temporal/temporal-value";
import type { TemporalValue, ValueKind } from "../../temporal/temporal-value";
import { boundDay } from "../calendar/calendar-dates";
import {
  clearSegment,
  cycleSegment,
  draftOf,
  draftToValue,
  isCleared,
  isComplete,
  roundTrips,
  segmentLimits,
  setSegment,
} from "./date-draft";
import type { DateDraft, EditableSegmentType, HourCycle } from "./date-draft";
import type { DateInputValueChangeReason } from "./date-input-change-details";
import type { DateInputEntry } from "./date-input-validation";

/** The edit session's state. */
export type SessionState = {
  /** The committed value's key the draft was typed over; see {@link basisOf}. */
  readonly basis: string;
  /** The input's own value, which counts only while no parent owns the value. */
  readonly own: TemporalValue | null;
  /** What the segments show while it differs from the committed value; `null` shows the value. */
  readonly draft: DateDraft | null;
  /** The digits typed into the focused segment so far, which the next digit extends. */
  readonly entered: string;
  /** Whether anything was edited since focus entered, which decides validation on blur. */
  readonly edited: boolean;
};

/** What a transition reads beyond the state: the committed value and the input's settings. */
export type SessionSettings = {
  /** The value the segments edit: the parent's, or the input's own. */
  readonly committed: TemporalValue | null;
  /** Whether a parent owns the value, so a commit leaves `own` alone. */
  readonly controlled: boolean;
  /** Whether the user may edit: neither disabled nor read-only. */
  readonly editable: boolean;
  /** The segments shown. */
  readonly fields: readonly EditableSegmentType[];
  readonly hourCycle: HourCycle;
  /** The value kind, for pasted text. */
  readonly kind: ValueKind;
  /** The locale's words for before and after noon, for a typed day period. */
  readonly dayPeriods: readonly [string, string];
  readonly locale: string;
  /** Today at midnight in the input's kind, read when the user acts. */
  readonly placeholder: () => TemporalValue;
};

/** A value a transition commits, and the gesture that did. */
type SessionCommit = {
  readonly value: TemporalValue | null;
  readonly reason: DateInputValueChangeReason;
};

/** A transition's outcome. */
export type SessionTransition = {
  /** The state once the transition applies; with a commit, once the commit applies. */
  readonly state: SessionState;
  /** The value to report through `onValueChange`, if the transition commits one. */
  readonly commit?: SessionCommit;
  /** Where focus moves among the segments afterwards. */
  readonly focus?: "next" | "previous";
};

/** A segment as an edit reads it. */
export type SessionSegment = {
  readonly type: EditableSegmentType;
  readonly text: string;
  readonly isPlaceholder: boolean;
};

/**
 * The key a draft is typed over: the committed value's ISO text, the hour cycle, since a draft
 * holds its hour in the cycle it was typed in, and the segments shown, since a draft is complete
 * or cleared only over the segments it was typed into.
 *
 * @param committed - The committed value.
 * @param hourCycle - The hour cycle shown.
 * @param fields - The segments shown.
 * @returns The key.
 */
export function basisOf(
  committed: TemporalValue | null,
  hourCycle: HourCycle,
  fields: readonly EditableSegmentType[]
): string {
  return `${committed === null ? "" : committed.toString()}|${hourCycle}|${fields.join(",")}`;
}

/** The key of the committed value and the segments a transition's settings show. */
function settingsBasis(settings: SessionSettings): string {
  return basisOf(settings.committed, settings.hourCycle, settings.fields);
}

/**
 * A session with no edit, over a value. A session holding no draft may start from any basis, such
 * as `""` before the segments are known: the first {@link rebase} sets it.
 *
 * @param own - The input's own first value.
 * @param basis - The key of the committed value and the segments shown; see {@link basisOf}.
 * @returns The state.
 */
export function initialSession(own: TemporalValue | null, basis: string): SessionState {
  return { basis, own, draft: null, entered: "", edited: false };
}

/**
 * The session over a new committed value or new segments: the draft and the typed digits are
 * dropped for good.
 *
 * @param state - The state.
 * @param basis - The new key; see {@link basisOf}.
 * @returns The state, unchanged when the basis is the same.
 */
export function rebase(state: SessionState, basis: string): SessionState {
  return state.basis === basis ? state : { ...state, basis, draft: null, entered: "" };
}

/**
 * The draft typed over this committed value and these segments, or `null` when the segments show
 * the value itself. A draft is never equal to the committed value, and never cleared over the
 * segments it was typed into: `apply` commits both.
 *
 * @param state - The state.
 * @param basis - The key of the committed value and the segments shown; see {@link basisOf}.
 * @returns The draft, or `null`.
 */
export function draftOver(state: SessionState, basis: string): DateDraft | null {
  return state.basis === basis ? state.draft : null;
}

/**
 * What the segments show, as far as validity goes: nothing, the committed value, or a draft that
 * is not (yet) a value.
 *
 * @param state - The state.
 * @param committed - The committed value.
 * @param basis - The key of the committed value and the segments shown; see {@link basisOf}.
 * @returns The entry.
 */
export function entryOf(state: SessionState, committed: TemporalValue | null, basis: string): DateInputEntry {
  if (draftOver(state, basis) !== null) {
    return { kind: "partial" };
  }
  return committed === null ? { kind: "empty" } : { kind: "value", value: committed };
}

/** Focus entered the input: nothing is edited yet. */
export function focusEntered(state: SessionState): SessionState {
  return { ...state, entered: "", edited: false };
}

/** A segment took focus: typing starts a new number. */
export function segmentFocused(state: SessionState): SessionState {
  return state.entered === "" ? state : { ...state, entered: "" };
}

/**
 * The state a canceled commit leaves: the value unchanged and shown again, the edit discarded.
 * The input still counts as edited, so blur validates what it shows.
 *
 * @param state - The state before the transition.
 * @returns The state.
 */
export function canceled(state: SessionState): SessionState {
  return { ...state, draft: null, entered: "", edited: true };
}

/**
 * The segments show the committed value again, nothing committed: the draft is dropped and the
 * input counts as edited, so blur validates what it shows.
 */
function settled(state: SessionState, settings: SessionSettings, entered = ""): SessionState {
  return { ...state, basis: settingsBasis(settings), draft: null, entered, edited: true };
}

/**
 * The state once `value` commits: the input's own value follows when no parent owns it. The basis
 * becomes the committed value's even when a parent owns it, so the parent's echo of that value is
 * an acknowledgement that keeps the typed digits, while any other value replaces the session's.
 */
function committedState(
  state: SessionState,
  value: TemporalValue | null,
  entered: string,
  settings: SessionSettings
): SessionState {
  const own = settings.controlled ? state.own : value;
  const basis = basisOf(value, settings.hourCycle, settings.fields);
  return { ...state, own, basis, draft: null, entered, edited: true };
}

/** What the segments show: the draft typed over the committed value, or the value itself. */
function current(state: SessionState, settings: SessionSettings): DateDraft {
  return draftOver(state, settingsBasis(settings)) ?? draftOf(settings.committed, settings.hourCycle);
}

/**
 * React Aria's `setValue`: a draft whose every segment is filled and whose value holds exactly what
 * was typed commits, or shows the committed value again when it is that value; one cleared of every
 * segment commits `null`; anything else stays a draft. `entered` is the digits the focused segment
 * holds afterwards.
 */
function apply(
  state: SessionState,
  next: DateDraft,
  entered: string,
  settings: SessionSettings
): SessionTransition {
  const { committed, fields, hourCycle } = settings;
  if (isCleared(next, fields)) {
    return committed === null
      ? { state: settled(state, settings, entered) }
      : {
          state: committedState(state, null, entered, settings),
          commit: { value: null, reason: "input-clear" },
        };
  }
  if (isComplete(next, fields)) {
    const value = draftToValue(next, committed ?? settings.placeholder(), hourCycle);
    if (roundTrips(next, value, fields, hourCycle)) {
      return committed?.toString() === value.toString()
        ? { state: settled(state, settings, entered) }
        : {
            state: committedState(state, value, entered, settings),
            commit: { value, reason: "input-change" },
          };
    }
  }
  return { state: { ...state, basis: settingsBasis(settings), draft: next, entered, edited: true } };
}

/** A transition that keeps the state, for a gesture the input ignores. */
function unchanged(state: SessionState): SessionTransition {
  return { state };
}

/** Whether `word` starts with `typed`, ignoring case and accents, as React Aria's `startsWith`. */
function startsWith(word: string, typed: string, locale: string): boolean {
  const normal = (text: string): string =>
    text
      .normalize("NFD")
      .replace(/\p{Mn}/gu, "")
      .toLocaleLowerCase(locale);
  return normal(word).startsWith(normal(typed));
}

/**
 * A key typed into a segment, as React Aria's `onInput`: a day period takes the word its letter
 * starts; a number accumulates digits, restarts at the key when the digits pass the segment's
 * maximum, and moves focus on once no further digit could fit.
 *
 * @param state - The state.
 * @param type - The segment.
 * @param key - The character typed.
 * @param settings - The settings.
 * @returns The transition.
 */
export function typeKey(
  state: SessionState,
  type: EditableSegmentType,
  key: string,
  settings: SessionSettings
): SessionTransition {
  if (!settings.editable) {
    return unchanged(state);
  }
  const draft = current(state, settings);
  if (type === "dayPeriod") {
    const [am, pm] = settings.dayPeriods;
    const period = startsWith(am, key, settings.locale)
      ? 0
      : startsWith(pm, key, settings.locale)
        ? 1
        : undefined;
    if (period === undefined) {
      return unchanged(state);
    }
    const next = setSegment(draft, "dayPeriod", period, settings.placeholder(), settings.hourCycle);
    return { ...apply(state, next, "", settings), focus: "next" };
  }
  const typed = state.entered + key;
  if (!/^\d+$/u.test(typed)) {
    return unchanged(state);
  }
  const { max } = segmentLimits(type, settings.hourCycle);
  const number = Number.parseInt(typed, 10);
  const segmentValue = number > max ? Number.parseInt(key, 10) : number;
  const next = setSegment(draft, type, segmentValue, settings.placeholder(), settings.hourCycle);
  const full = Number(`${String(number)}0`) > max || typed.length >= String(max).length;
  return full ? { ...apply(state, next, "", settings), focus: "next" } : apply(state, next, typed, settings);
}

/**
 * Backspace or Delete in a segment, as React Aria's `backspace`: an empty segment moves focus back;
 * a number loses its last digit and clears at zero or empty; a day period clears.
 *
 * @param state - The state.
 * @param segment - The segment, as shown.
 * @param settings - The settings.
 * @returns The transition.
 */
export function erase(
  state: SessionState,
  segment: SessionSegment,
  settings: SessionSettings
): SessionTransition {
  if (segment.isPlaceholder) {
    return { state, focus: "previous" };
  }
  if (!settings.editable) {
    return unchanged(state);
  }
  const draft = current(state, settings);
  if (segment.type === "dayPeriod") {
    return apply(state, clearSegment(draft, "dayPeriod"), "", settings);
  }
  if (!/^\d+$/u.test(segment.text)) {
    return unchanged(state);
  }
  const shorter = segment.text.slice(0, -1);
  const number = Number.parseInt(shorter, 10);
  if (shorter.length === 0 || number === 0) {
    return apply(state, clearSegment(draft, segment.type), "", settings);
  }
  return apply(
    state,
    setSegment(draft, segment.type, number, settings.placeholder(), settings.hourCycle),
    shorter,
    settings
  );
}

/**
 * An arrow or page key: the segment steps by `amount`, wrapping.
 *
 * @param state - The state.
 * @param type - The segment.
 * @param amount - The step, negative to go down.
 * @param settings - The settings.
 * @returns The transition.
 */
export function step(
  state: SessionState,
  type: EditableSegmentType,
  amount: number,
  settings: SessionSettings
): SessionTransition {
  if (!settings.editable) {
    return unchanged(state);
  }
  const next = cycleSegment(
    current(state, settings),
    type,
    amount,
    settings.placeholder(),
    settings.hourCycle
  );
  return apply(state, next, "", settings);
}

/**
 * Home or End: the segment goes to its first or last value. As React Aria, End takes a 12-hour hour
 * to 11 and Home to 12, the cycle's last and first.
 *
 * @param state - The state.
 * @param type - The segment.
 * @param edge - Which end.
 * @param settings - The settings.
 * @returns The transition.
 */
export function toEdge(
  state: SessionState,
  type: EditableSegmentType,
  edge: "min" | "max",
  settings: SessionSettings
): SessionTransition {
  if (!settings.editable) {
    return unchanged(state);
  }
  const limits = segmentLimits(type, settings.hourCycle);
  const twelveHour = type === "hour" && settings.hourCycle === "h12";
  const number = twelveHour ? (edge === "max" ? 11 : 12) : edge === "max" ? limits.max : limits.min;
  const next = setSegment(current(state, settings), type, number, settings.placeholder(), settings.hourCycle);
  return apply(state, next, "", settings);
}

/**
 * Focus leaving the input, as React Aria's `confirmPlaceholder`: a draft with every segment filled
 * commits, constrained, so February 30 becomes the month's last day.
 *
 * @param state - The state.
 * @param settings - The settings.
 * @returns The transition.
 */
export function confirm(state: SessionState, settings: SessionSettings): SessionTransition {
  const draft = draftOver(state, settingsBasis(settings));
  if (!settings.editable || draft === null || !isComplete(draft, settings.fields)) {
    return unchanged({ ...state, entered: "" });
  }
  const value = draftToValue(draft, settings.committed ?? settings.placeholder(), settings.hourCycle);
  if (settings.committed?.toString() === value.toString()) {
    return { state: settled(state, settings) };
  }
  return { state: committedState(state, value, "", settings), commit: { value, reason: "input-change" } };
}

/** A value in a kind: a date-time's date for a PlainDate input, a zone's wall clock, a wall clock in a zone. */
function convertToKind(value: TemporalValue, kind: ValueKind): TemporalValue | undefined {
  switch (kind.kind) {
    case "PlainDate":
      return boundDay(value);
    case "PlainDateTime":
      if ("timeZoneId" in value) return value.toPlainDateTime();
      return "hour" in value ? value : undefined;
    case "ZonedDateTime":
      if ("timeZoneId" in value) return value.withTimeZone(kind.timeZone);
      return "hour" in value
        ? value.toZonedDateTime(kind.timeZone, { disambiguation: "compatible" })
        : undefined;
  }
}

/**
 * Pasted text: ISO text of a kind the input can hold commits, converted to the input's kind.
 *
 * @param state - The state.
 * @param text - The clipboard's text.
 * @param settings - The settings.
 * @returns The transition.
 */
export function paste(state: SessionState, text: string, settings: SessionSettings): SessionTransition {
  if (!settings.editable) {
    return unchanged(state);
  }
  const parsed = parseTemporal(text.trim());
  if (parsed._tag === "err") {
    return unchanged(state);
  }
  const value = convertToKind(parsed.value, settings.kind);
  if (value === undefined) {
    return unchanged(state);
  }
  // The committed value pasted again: nothing changes, but the segments show it whole again.
  if (value.toString() === settings.committed?.toString()) {
    return { state: settled(state, settings) };
  }
  return { state: committedState(state, value, "", settings), commit: { value, reason: "input-paste" } };
}

/**
 * The session a native form reset leaves: the default value, nothing typed.
 *
 * @param own - The default value.
 * @param hourCycle - The hour cycle shown.
 * @param fields - The segments shown.
 * @returns The state.
 */
export function resetSession(
  own: TemporalValue | null,
  hourCycle: HourCycle,
  fields: readonly EditableSegmentType[]
): SessionState {
  return initialSession(own, basisOf(own, hourCycle, fields));
}
