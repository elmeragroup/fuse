// What a range picker holds before it commits: two ends, each the one-end draft DatePicker holds
// (`date-picker/picker-draft.ts`), and the transitions its gestures make over both. A range
// commits once `wholeRange` has both ends (and, for a picked range, once `awaitsTime` no longer
// holds or the popup closes).

import type { TemporalValue, ValueKind } from "../../temporal/temporal-value";
import {
  clearEndTime,
  editEndTime,
  endAwaitsTime,
  endOfValue,
  endValue,
  pickEndDay,
} from "../date-picker/picker-draft";
import type { EndpointDraft } from "../date-picker/picker-draft";
import type { Endpoint, Ends } from "./date-range-picker-context";

/** Both ends' drafts. */
export type RangeDraft = { readonly start: EndpointDraft; readonly end: EndpointDraft };

/** A range with both ends. */
export type WholeRange = { readonly start: TemporalValue; readonly end: TemporalValue };

/**
 * The draft of a range the picker holds as values: committed, or set by a preset.
 *
 * @param ends - The ends.
 * @returns The draft, each end a value or empty.
 */
export function draftOfRange(ends: Ends): RangeDraft {
  return { start: endOfValue(ends.start), end: endOfValue(ends.end) };
}

/**
 * Both ends as their inputs show them; see `endValue`.
 *
 * @param draft - The draft.
 * @param kind - The picker's kind now.
 * @returns The ends.
 */
export function shownEnds(draft: RangeDraft, kind: ValueKind): Ends {
  return { start: endValue(draft.start, kind), end: endValue(draft.end, kind) };
}

/**
 * The range the draft makes once both ends have a value.
 *
 * @param draft - The draft.
 * @param kind - The picker's kind now.
 * @returns The range, or `null` while an end has none.
 */
export function wholeRange(draft: RangeDraft, kind: ValueKind): WholeRange | null {
  const { start, end } = shownEnds(draft, kind);
  return start === null || end === null ? null : { start, end };
}

/**
 * Whether a picked end still waits for its time, so a range picked in an empty time picker that
 * stays open is held rather than committed.
 *
 * @param draft - The draft.
 * @returns Whether either end is a picked day without a time.
 */
export function awaitsTime(draft: RangeDraft): boolean {
  return endAwaitsTime(draft.start) || endAwaitsTime(draft.end);
}

/**
 * A value of the kind the draft holds, which the picker resolves its kind from: the start's value,
 * else the end's. A picked day or a held wall time names no kind of its own: the picker's props
 * and the kind it held before decide it.
 *
 * @param draft - The draft.
 * @returns A value of the draft's kind, or `null`.
 */
export function kindWitnessOf(draft: RangeDraft): TemporalValue | null {
  const valueOf = (end: EndpointDraft): TemporalValue | null => (end._tag === "value" ? end.value : null);
  return valueOf(draft.start) ?? valueOf(draft.end);
}

/** The draft with one end replaced; the same draft when the end is unchanged. */
function withEnd(draft: RangeDraft, endpoint: Endpoint, next: EndpointDraft): RangeDraft {
  if (draft[endpoint] === next) {
    return draft;
  }
  return endpoint === "start" ? { ...draft, start: next } : { ...draft, end: next };
}

/**
 * An end's input formed a value, or was cleared: the end becomes that value, whatever it held,
 * a time typed in the popup included, so the end keeps one time.
 *
 * @param draft - The draft.
 * @param endpoint - The end.
 * @param value - The input's value, or `null` when cleared.
 * @returns The draft.
 */
export function editInput(draft: RangeDraft, endpoint: Endpoint, value: TemporalValue | null): RangeDraft {
  return withEnd(draft, endpoint, endOfValue(value));
}

/**
 * A range picked in the calendar: each end becomes its picked day, keeping the time it had; see
 * `pickEndDay`.
 *
 * @param draft - The draft.
 * @param range - The picked days.
 * @param kind - The picker's kind now.
 * @returns The draft.
 */
export function pickRange(
  draft: RangeDraft,
  range: { readonly start: Temporal.PlainDate; readonly end: Temporal.PlainDate },
  kind: ValueKind
): RangeDraft {
  return { start: pickEndDay(draft.start, range.start, kind), end: pickEndDay(draft.end, range.end, kind) };
}

/**
 * A time typed in an end's popup time input; see `editEndTime`.
 *
 * @param draft - The draft.
 * @param endpoint - The end.
 * @param time - A value holding the typed time.
 * @param kind - The picker's kind.
 * @returns The draft.
 */
export function editTime(
  draft: RangeDraft,
  endpoint: Endpoint,
  time: TemporalValue,
  kind: ValueKind
): RangeDraft {
  return withEnd(draft, endpoint, editEndTime(draft[endpoint], time, kind));
}

/**
 * Every segment of an end's popup time input was cleared; see `clearEndTime`.
 *
 * @param draft - The draft.
 * @param endpoint - The end.
 * @returns The draft, or `undefined` when the end is a value, whose time cannot be cleared.
 */
export function clearTime(draft: RangeDraft, endpoint: Endpoint): RangeDraft | undefined {
  const cleared = clearEndTime(draft[endpoint]);
  return cleared === undefined ? undefined : withEnd(draft, endpoint, cleared);
}
