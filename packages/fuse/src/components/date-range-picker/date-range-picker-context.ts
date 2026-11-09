// The range Root's private contract with its parts: the context the parts read and the types and
// constants they share.

import { createContext, use } from "react";

import type { TemporalValue } from "../../temporal/temporal-value";
import type { DateInputValueChangeEventDetails } from "../date-field/date-input-change-details";
import type { PickerCalendarSettings, PickerInputSettings } from "../date-picker/picker-root";
import type {
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
} from "../range-calendar/range-calendar";

/** The calendar gestures a held range comes from. */
export type RangeHeldReason = "day-press" | "keyboard" | "outside-press" | "focus-out";

/** A range's ends, either of which may be empty while the inputs hold half a range. */
export type Ends = { readonly start: TemporalValue | null; readonly end: TemporalValue | null };
/** One end of the range. */
export type Endpoint = keyof Ends;
/** One end's shown messages: its Field's, or the `Form` errors under its name. */
export type EndpointMessages = readonly string[];

/** An end with no message. */
export const NO_MESSAGES: EndpointMessages = [];

/** A range with both ends empty. */
export const EMPTY_ENDS: Ends = { start: null, end: null };

/**
 * A range's key, which a held selection and the calendar's view belong to.
 *
 * @param ends - The ends.
 * @returns `start..end`, each end's ISO text or empty.
 */
export function rangeKey(ends: Ends): string {
  return `${ends.start?.toString() ?? ""}..${ends.end?.toString() ?? ""}`;
}

/** What the parts read from the Root. */
export type DateRangePickerRootContextValue = {
  readonly ends: Ends;
  readonly calendarRange: { readonly start: Temporal.PlainDate; readonly end: Temporal.PlainDate } | null;
  readonly calendarKey: string;
  /** The form-reset generation, which keys each end's Field and input. */
  readonly generation: number;
  readonly endpointLabelledBy: string | undefined;
  readonly inputSettings: PickerInputSettings;
  readonly calendarSettings: PickerCalendarSettings;
  readonly invalidProp: boolean;
  readonly invalid: boolean;
  readonly reversed: boolean;
  readonly names: { readonly start: string | undefined; readonly end: string | undefined };
  readonly labelId: string;
  readonly descriptionId: string;
  readonly errorId: string;
  readonly messages: readonly string[];
  readonly describedBy: string | undefined;
  readonly hasPresets: boolean;
  /** A part the Root could not see among its children announces itself after mount (fallback). */
  readonly registerPart: (part: RangePart) => () => void;
  readonly inputChange: (
    endpoint: Endpoint,
    value: TemporalValue | null,
    details: DateInputValueChangeEventDetails
  ) => void;
  readonly selectRange: (
    range: RangeCalendarValue,
    details: RangeCalendarRootValueChangeEventDetails
  ) => void;
  readonly reportMessages: (endpoint: Endpoint, messages: EndpointMessages) => void;
  readonly reportInputInvalid: (endpoint: Endpoint, invalid: boolean) => void;
};

export const DateRangePickerRootContext = createContext<DateRangePickerRootContextValue | undefined>(
  undefined
);

/**
 * The enclosing range Root.
 *
 * @param part - The part asking, named in the error.
 * @returns The Root's context.
 * @throws Error naming the part outside `DateRangePicker.Root`, a composition defect.
 */
export function useRangeRootContext(part: string): DateRangePickerRootContextValue {
  const value = use(DateRangePickerRootContext);
  if (value === undefined) {
    throw new Error(`${part} must be rendered inside DateRangePicker.Root.`);
  }
  return value;
}

/** The parts whose presence the Root wires into names and descriptions. */
export type RangePart = "label" | "description" | "error";
