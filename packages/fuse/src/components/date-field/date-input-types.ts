import type { ReactNode } from "react";

import type { useRender } from "@base-ui/react/use-render";

import type { DateGranularity, TemporalInput, TemporalValue } from "../../temporal/temporal-value";
import type { EditableSegmentType } from "./date-draft";
import type { DateInputValueChangeEventDetails } from "./date-input-change-details";

/** A value a date input holds: a date, a date and time, or a date and time in a zone. */
export type DateInputValue = TemporalValue;

/** A segment's kind: an editable unit, the zone's name, or the text between them. */
export type DateInputSegmentType = EditableSegmentType | "timeZoneName" | "literal";

/**
 * One segment as `DateInput.Root` lists it for its children: the text between units, the zone's
 * name, or a unit the user edits. `isEditable` tells a unit from the other two, and `type` tells
 * those apart; neither a literal nor the zone's name ever shows a placeholder.
 */
export type DateInputSegmentData =
  | {
      /** The text between units. */
      readonly type: "literal";
      /** Its place among the Root's segments, literals included; a stable React key. */
      readonly index: number;
      /** The literal's text. */
      readonly text: string;
      /** A literal never shows a placeholder. */
      readonly isPlaceholder: false;
      /** A literal is never edited. */
      readonly isEditable: false;
    }
  | {
      /** The zone's name, a read-only textbox. */
      readonly type: "timeZoneName";
      /** Its place among the Root's segments, literals included; a stable React key. */
      readonly index: number;
      /** The zone's name. */
      readonly text: string;
      /** The zone's name never shows a placeholder. */
      readonly isPlaceholder: false;
      /** The zone's name is never edited. */
      readonly isEditable: false;
    }
  | {
      /** The segment's unit. */
      readonly type: EditableSegmentType;
      /** Its place among the Root's segments, literals included; a stable React key. */
      readonly index: number;
      /** The text it shows: the number, the day period's word, or the placeholder. */
      readonly text: string;
      /** Whether it shows its placeholder. */
      readonly isPlaceholder: boolean;
      /** Every unit is edited. */
      readonly isEditable: true;
    };

/** A segment the user edits, as `DateInput.Root` lists it. */
export type DateInputEditableSegmentData = Extract<DateInputSegmentData, { readonly isEditable: true }>;

/** A segment that takes focus: a unit, or the zone's name. */
export type DateInputFocusableSegmentData = Exclude<DateInputSegmentData, { readonly type: "literal" }>;

/** The state `DateInput.Root` shares with its `render` callback and writes as data attributes. */
export type DateInputRootState = {
  /** Whether nothing responds. Written as `data-disabled`. */
  readonly disabled: boolean;
  /** Whether the value cannot change. Written as `data-readonly`. */
  readonly readonly: boolean;
  /** Whether a value is required. Written as `data-required`. */
  readonly required: boolean;
  /**
   * Whether the input shows as invalid: `invalid` is passed, its Field is invalid, or its own
   * validation failed when it last committed (on blur). Written as `data-invalid="true"`.
   */
  readonly invalid: boolean;
  /** Whether every segment is empty. Written as `data-empty`. */
  readonly empty: boolean;
};

/** The state `DateInput.Segment` shares with its `render` callback and writes as data attributes. */
export type DateInputSegmentState = {
  /** The segment's kind. Written as `data-type`. */
  readonly type: DateInputSegmentType;
  /** Whether it shows its placeholder. Written as `data-placeholder`. */
  readonly placeholder: boolean;
  /** Whether the Root is disabled. Written as `data-disabled`. */
  readonly disabled: boolean;
  /** Whether it cannot be edited: the Root is read-only, or it is the zone's name. Written as `data-readonly`. */
  readonly readonly: boolean;
  /** Whether the Root shows as invalid. Written as `data-invalid="true"`. */
  readonly invalid: boolean;
};

/**
 * `DateInput.Root` takes a `div`'s props, Base UI's `render` and the input's own.
 *
 * @template T - The value's kind: `Temporal.PlainDate` (the default), `PlainDateTime` or `ZonedDateTime`.
 */
export type DateInputRootProps<T extends DateInputValue = Temporal.PlainDate> = Omit<
  useRender.ComponentProps<"div", DateInputRootState>,
  "defaultValue" | "onChange" | "children"
> & {
  /**
   * The value, when the parent owns it: a Temporal value of `T`'s kind from any implementation,
   * or its ISO text, the form a server component passes. `null` empties the input.
   */
  value?: T | string | null;
  /** The first value, when the input owns its value. Takes what `value` takes. */
  defaultValue?: T | string | null;
  /**
   * Called when the segments form a new value, with this runtime's Temporal value, or `null` when
   * every segment was cleared. A value forms when every segment is filled and it holds exactly what
   * was typed; a value that does not, such as February 30, waits for blur and then commits
   * constrained. `details.reason` is `"input-change"` (typing, keys, blur), `"input-clear"` or
   * `"input-paste"`. Canceling with `details.cancel()` keeps the value and shows it again in the
   * segments, discarding the edit.
   */
  onValueChange?: (value: T | null, details: DateInputValueChangeEventDetails) => void;
  /**
   * The earliest valid value: a PlainDate, PlainDateTime or ZonedDateTime from any implementation,
   * or its ISO text, of any kind, compared as React Aria compares it. A value before it still
   * commits; the input reports it invalid with "Value must be … or later."
   */
  minValue?: TemporalInput;
  /** The latest valid value, taking what `minValue` takes. "Value must be … or earlier." */
  maxValue?: TemporalInput;
  /** Values the input reports invalid ("Selected date unavailable."), such as fully booked days. */
  isDateUnavailable?: (value: T) => boolean;
  /**
   * The smallest unit edited. A time granularity needs a value with a time. Defaults to `"day"`
   * for a PlainDate and `"minute"` for a value with a time.
   */
  granularity?: DateGranularity;
  /** The hour cycle shown: `12` with a day period, `24` without. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name. */
  hideTimeZone?: boolean;
  /**
   * The zone an empty input's ZonedDateTime takes. With a time `granularity` and no value or
   * default value to read a kind from, it makes the input zoned; a value's own zone wins over it.
   * Pass it whenever `T` is `ZonedDateTime` and the input can start empty.
   */
  timeZone?: string;
  /** Pads days, months and hours to two digits whatever the locale writes. */
  shouldForceLeadingZeros?: boolean;
  /** Whether nothing responds and the value is not submitted. */
  disabled?: boolean;
  /** Whether the value cannot change. The segments stay focusable. */
  readOnly?: boolean;
  /** Whether an empty or incomplete input is invalid ("Please fill out this field."). */
  required?: boolean;
  /** Whether the input shows as invalid whatever its value. */
  invalid?: boolean;
  /** The name the ISO value submits under. A surrounding Field's `name` wins. */
  name?: string;
  /** The id of the form the ISO value submits with, when it is not the enclosing one. */
  form?: string;
  /** The field box's size: `"default"` the md control size, `"sm"` the sm one. Written as `data-size`. */
  size?: "default" | "sm";
  /**
   * Renders each segment. Without it each renders as a `DateInput.Segment`, which a server
   * component can rely on, since a function cannot cross to the client.
   */
  children?: (segment: DateInputSegmentData) => ReactNode;
};

/** `DateInput.Segment` takes a `span`'s props, Base UI's `render` and the segment it shows. */
export type DateInputSegmentProps = Omit<
  useRender.ComponentProps<"span", DateInputSegmentState>,
  "children"
> & {
  /** The segment, as `DateInput.Root` passes it to its children. */
  segment: DateInputSegmentData;
};
