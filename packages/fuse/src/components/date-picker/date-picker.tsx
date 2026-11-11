"use client";

import { createContext, use, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FocusEvent, ReactElement, ReactNode } from "react";

import { DEFAULT_VALIDITY_STATE } from "@base-ui/react/internals/field-constants";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import type { useRender } from "@base-ui/react/use-render";

import { useStableCallback } from "../../hooks/use-stable-callback";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import { CalendarRoot } from "../calendar/calendar";
import type { CalendarRootProps, CalendarRootValueChangeEventDetails } from "../calendar/calendar";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import type { CalendarPageBehavior } from "../calendar/calendar-dates";
import { useTemporalProp } from "../calendar/calendar-input";
import type { CalendarFirstDayOfWeek } from "../calendar/calendar-input";
import type { DateInputValue } from "../date-field/date-input";
import type { DateInputValueChangeEventDetails } from "../date-field/date-input-change-details";
import { valueError } from "../date-field/date-input-validation";
import type { KindProps, PropsMadeValue } from "../date-field/date-kind-props";
import { useValueKind } from "../date-field/use-value-kind";
import { datePickerVariants } from "./date-picker-variants";
import type {
  DatePickerChangeEventDetails,
  DatePickerOpenChangeEventDetails,
  DatePickerValidationError,
} from "./picker-change-details";
import type { DatePickerClassName } from "./picker-class-name";
import {
  EMPTY_END,
  clearEndTime,
  editEndTime,
  endAwaitsTime,
  endDay,
  endOfValue,
  endValue,
  pickEndDay,
  pickedEndValue,
} from "./picker-draft";
import type { EndpointDraft } from "./picker-draft";
import { PickerDateInput } from "./picker-input";
import {
  useCalendarViewKey,
  usePickerRoot,
  usePickerRootElement,
  usePickerRules,
  usePresetReader,
} from "./picker-root";
import type {
  PickerCalendarSettings,
  PickerInputPartProps,
  PickerInputSettings,
  PickerOwnedCalendarProp,
  PickerTimeSettings,
} from "./picker-root";
import { DefaultCalendarChildren, usePresetRegistry } from "./picker-shell";
import type { PickerState } from "./picker-shell";
import { PickerTimeInput } from "./picker-time-input";
import { usePickerTimeBinding } from "./picker-time-input";
import type { PickerTimeBinding } from "./picker-time-input";
import { presetDate } from "./picker-value";
import { usePickerSession } from "./use-picker-session";

const styles = datePickerVariants();

/**
 * The gestures that change a picker's value: a day pressed or chosen with Enter or Space in the
 * calendar, the input's typing, clearing and pasting, or a preset with a `dateValue` pressed.
 */
export type DatePickerValueChangeReason =
  | "day-press"
  | "keyboard"
  | "input-change"
  | "input-clear"
  | "input-paste"
  | "preset-press";

/** What `DatePicker.Root`'s `onValueChange` receives beside the new value. */
export type DatePickerValueChangeEventDetails = DatePickerChangeEventDetails<DatePickerValueChangeReason> & {
  /**
   * The new value's validation error against the bounds and `isDateUnavailable`, worked out when
   * called, or `null`. A day the calendar lets the user press always passes; a typed value can fail.
   */
  readonly getValidationError: () => DatePickerValidationError | null;
};

/**
 * The state `DatePicker.Root` shares with its `render` callback and writes as data attributes:
 * `open` (`data-open`), `disabled` (`data-disabled`), `readonly` (`data-readonly`) and `invalid`
 * (`data-invalid="true"`).
 */
// A mapped copy, so the public name is a type of its own, which prints as itself rather than as
// the private `PickerState`, and keeps each field's documentation.
export type DatePickerRootState = { readonly [K in keyof PickerState]: PickerState[K] };

/**
 * `DatePicker.Root` takes a `div`'s props, Base UI's `render` and the picker's own.
 *
 * @template T - The value's kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the Root reads it as `DateInput.Root` does.
 */
export type DatePickerRootProps<T extends DateInputValue = Temporal.PlainDate> = Omit<
  useRender.ComponentProps<"div", DatePickerRootState>,
  "defaultValue" | "onChange" | "className"
> & {
  /** Extra classes, or a callback of the Root's state that returns them. */
  className?: DatePickerClassName<DatePickerRootState>;
  /**
   * The value, when the parent owns it: a Temporal value of `T`'s kind, built in a client
   * component. `null` empties it.
   */
  value?: T | null;
  /** The first value, when the picker owns its value. */
  defaultValue?: T | null;
  /**
   * Called with this runtime's value when a day is picked in the calendar or the input forms a new
   * value, `null` when the input is cleared. `details.reason` is `"day-press"`, `"keyboard"`,
   * `"input-change"`, `"input-clear"`, `"input-paste"` or `"preset-press"` (a `PresetItem` with a
   * `dateValue`). Canceling with `details.cancel()` keeps the value: a canceled day keeps the popup
   * open with focus on the day, a canceled edit shows the value again in the segments, and a
   * canceled preset stays unchecked.
   */
  onValueChange?: NoInfer<(value: T | null, details: DatePickerValueChangeEventDetails) => void>;
  /** Whether the popup is open, when the parent owns it. */
  open?: boolean;
  /** Whether the popup starts open. */
  defaultOpen?: boolean;
  /**
   * Called when the popup opens or closes. `details.reason` is Base UI Popover's
   * (`"trigger-press"`, `"outside-press"`, `"escape-key"`, `"focus-out"`, …), `"keyboard"` (Alt+ArrowDown
   * in the group, or Enter on a day that closes it), `"day-press"` or `"preset-press"`. Canceling
   * with `details.cancel()` keeps the popup as it is.
   */
  onOpenChange?: (open: boolean, details: DatePickerOpenChangeEventDetails) => void;
  /**
   * Whether picking a day closes the popup. With a time `granularity` and no value yet, a picked
   * day is held while the popup stays open: a time typed in `DatePicker.TimeInput` commits it at that
   * time, and otherwise it commits at midnight when the popup closes, however it closes (a parent
   * setting `open` to `false` included). A time typed before any day waits for one. That commit runs first and reports the
   * pick's reason; canceling it keeps the popup open with the day still held. A native form reset
   * drops a held day and any half-typed segments, and the shown error, also when the value is
   * unchanged.
   * @default true
   */
  shouldCloseOnSelect?: boolean;
  /** The earliest valid value, a Temporal value of any kind. Earlier days are disabled in the calendar. */
  minValue?: TemporalValue;
  /** The latest valid value, a Temporal value of any kind. */
  maxValue?: TemporalValue;
  /** Values the picker refuses: the calendar's days stay focusable but unselectable, a typed one is invalid. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /**
   * The smallest unit the input edits. A time granularity needs a value with a time. Without a
   * value it names the kind, as DateInput's does.
   */
  granularity?: DateGranularity;
  /** The hour cycle shown. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes, as DateInput's `timeZone`. */
  timeZone?: string;
  /** The weekday each calendar row starts on. Defaults to the locale's. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows. @default 1 */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view. @default "visible" */
  pageBehavior?: CalendarPageBehavior;
  /** Whether nothing responds and the value is not submitted. */
  disabled?: boolean;
  /** Whether the value cannot change. The segments stay focusable; the trigger is disabled. */
  readOnly?: boolean;
  /** Whether an empty or incomplete value is invalid. */
  required?: boolean;
  /** Whether the picker shows as invalid whatever its value. */
  invalid?: boolean;
  /** The name the ISO value submits under. A surrounding Field's `name` wins. */
  name?: string;
  /** The id of the form the value submits with. */
  form?: string;
  /** The field box's size. @default "default" */
  size?: "default" | "sm";
  /**
   * Called when focus leaves the picker: its group and its popup together, so moving into the popup
   * and back is no blur, as React Aria's picker blur. It receives the `blur` that started the
   * leave: its `relatedTarget` is where focus went, or, when focus left the popup through one of
   * Base UI's focus guards, that guard.
   */
  onFocusLeave?: (event: FocusEvent<Element>) => void;
  /** Names the picker when no Field label does: the group, the segments, the trigger and the popup. */
  "aria-label"?: string;
  /** The group, the popup and their parts. */
  children?: ReactNode;
};

/** What the Input and Calendar parts read from their Root. */
type DatePickerRootContextValue = {
  readonly value: TemporalValue | null;
  /** The day the picker holds: a day picked in an empty picker, else the value's (`endDay`). */
  readonly calendarDay: Temporal.PlainDate | null;
  readonly calendarKey: string;
  readonly inputKey: number;
  readonly inputSettings: PickerInputSettings;
  readonly calendarSettings: PickerCalendarSettings;
  readonly timeSettings: PickerTimeSettings | null;
  /** What the popup time input shows, the day it forms a typed time on, and its change. */
  readonly timeBinding: PickerTimeBinding;
  readonly invalid: boolean;
  readonly name: string | undefined;
  readonly ariaLabel: string | undefined;
  readonly inputChange: (value: TemporalValue | null, details: DateInputValueChangeEventDetails) => void;
  readonly selectDay: (day: Temporal.PlainDate, details: CalendarRootValueChangeEventDetails) => void;
  readonly reportInputInvalid: (invalid: boolean) => void;
};

const DatePickerRootContext = createContext<DatePickerRootContextValue | undefined>(undefined);

function useDatePickerRootContext(part: string): DatePickerRootContextValue {
  const value = use(DatePickerRootContext);
  if (value === undefined) {
    throw new Error(`${part} must be rendered inside DatePicker.Root.`);
  }
  return value;
}

/** The Root its prop errors name. */
const OWNER = "DatePicker.Root";

/**
 * A date picker: a segmented input and a calendar in a popup, over one value. It holds the value
 * and the open state; its parts are `Group` (the field box), `Input` (a bound `DateInput.Root`),
 * `Trigger`, `Popup`, `Calendar`, `TimeInput` (the value's time in the popup) and the preset pane
 * (`Presets`, `PresetItem`).
 *
 * Inside a Base UI Field (`Field.Root`, or the `DatePickerField` composite) the input is the
 * Field's control: `Field.Label` names the group, the segments, the trigger ("Calendar Start date")
 * and the popup, a `Form` focuses the first segment for an error, and the ISO value submits under
 * the Field's `name`. Values are Temporal values, as DateInput's: the picker reads
 * `globalThis.Temporal`, so a host without native Temporal imports `@elmeragroup/fuse/temporal-polyfill`.
 *
 * Picking a day keeps the value's time and zone. Typing in the input never opens the popup, and
 * opening it never commits a half-typed value.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The value's kind, inferred as `DateInput.Root`'s is.
 * @throws TypeError naming the prop and the fix when `value`, `defaultValue`, `minValue` or
 *   `maxValue` is a string rather than a Temporal object, or a time `granularity` meets a
 *   PlainDate value: host defects.
 */
export function DatePickerRoot<P = object, T extends DateInputValue = PropsMadeValue<P>>(
  props: DatePickerRootProps<T> & KindProps<P, DatePickerRootProps<DateInputValue>>
): ReactElement {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    shouldCloseOnSelect = true,
    minValue,
    maxValue,
    isDateUnavailable,
    granularity,
    hourCycle,
    hideTimeZone = false,
    timeZone,
    firstDayOfWeek,
    visibleMonths = 1,
    pageBehavior = "visible",
    disabled: disabledProp = false,
    readOnly = false,
    required = false,
    invalid: invalidProp = false,
    name,
    form,
    size = "default",
    "aria-label": ariaLabel,
    onFocusLeave,
    className,
    render,
    children,
    ...elementProps
  } = props;
  const labelable = useLabelableContext();
  const field = useFieldRootContext();
  const controlled = valueProp !== undefined;
  const parsedValue = useTemporalProp(valueProp, OWNER, "value");
  const parsedDefault = useTemporalProp(defaultValue, OWNER, "defaultValue");
  const [own, setOwn] = useState<TemporalValue | null>(parsedDefault);
  const value = controlled ? parsedValue : own;
  const iso = value === null ? "" : value.toString();
  const [inputInvalid, setInputInvalid] = useState(false);
  // SAFETY: the picker checks values of its resolved kind, which is `T`'s.
  const unavailable = isDateUnavailable as ((value: TemporalValue) => boolean) | undefined;

  // The calendar's view follows a value that came from anywhere but the calendar itself.
  const [viewKey, markPicked] = useCalendarViewKey(iso);
  // Worked out before the session, so a commit it makes while the popup closes reads this render's.
  const rules = usePickerRules(OWNER, minValue, maxValue, unavailable);
  // The picker's DateInput warns of a kind change, so the picker does not warn again.
  const resolvedKind = useValueKind({ value, defaultValue: parsedDefault, granularity, timeZone }, OWNER);
  const { kind } = resolvedKind;

  // What a gesture, or the session while the popup closes, reads: this render's, published before
  // the session's effects run, so a commit the session makes while the popup closes reaches this
  // render's `onValueChange`.
  const published = { value, onValueChange, controlled, shouldCloseOnSelect, parsedDefault };
  const latest = useRef(published);
  useLayoutEffect(() => {
    latest.current = published;
  });

  // The preset panes, told when the value is committed by anything but a preset press.
  const presetPanes = usePresetRegistry();

  /** Report a new value and apply it unless canceled; returns whether it applied. */
  function commit(
    next: TemporalValue | null,
    reason: DatePickerValueChangeEventDetails["reason"],
    event: Event,
    trigger: Element | undefined
  ): boolean {
    const state = latest.current;
    const details = createChangeEventDetails(reason, event, trigger, {
      getValidationError: () => (next === null ? null : valueError(next, rules)),
    });
    // SAFETY: `next` is of the picker's resolved kind, which is `T`'s.
    state.onValueChange?.(next as T | null, details);
    if (details.isCanceled) {
      return false;
    }
    if (!state.controlled) {
      setOwn(next);
    }
    latest.current = { ...state, value: next };
    if (reason !== "preset-press") {
      presetPanes.valueCommitted();
    }
    return true;
  }

  // What the picker holds before it commits (`picker-draft.ts`): its value, or, in an empty time
  // picker, a day picked while the popup stays open or a time typed before any day. The edit session
  // owns the held draft, the open transitions and the form reset (`use-picker-session.ts`).
  const valueDraft = useMemo(() => endOfValue(value), [value]);
  const session = usePickerSession<EndpointDraft, "day-press" | "keyboard">({
    open: openProp,
    defaultOpen,
    onOpenChange,
    basis: iso,
    finalize(held, origin) {
      // A held day at the time typed in the popup, in the picker's kind and zone now, or midnight.
      const next = endValue(held, kind);
      if (next === null) {
        return true;
      }
      if (!commit(next, origin.reason, origin.event, origin.trigger)) {
        return false;
      }
      // The calendar made this value: a close the parent cancels keeps it mounted under focus.
      markPicked(next.toString());
      return true;
    },
    onReset() {
      if (!latest.current.controlled) {
        setOwn(latest.current.parsedDefault);
      }
      presetPanes.valueCommitted();
      // A reset to the same value revalidates nothing, so the Field's shown validity starts over
      // here; the input remounts by the session's generation and drops its draft.
      field.setValidityData((data) => ({ ...data, state: DEFAULT_VALIDITY_STATE, error: "", errors: [] }));
      field.setTouched(false);
      field.setDirty(false);
    },
  });
  const { held, generation, hold } = session;
  const draft = held?.value ?? valueDraft;
  const readPreset = usePresetReader(presetDate, kind, (preset: TemporalValue, event, trigger) =>
    commit(preset, "preset-press", event, trigger)
  );

  const root = usePickerRoot({
    props: {
      granularity,
      hourCycle,
      hideTimeZone,
      timeZone,
      firstDayOfWeek,
      visibleMonths,
      pageBehavior,
      disabled: disabledProp,
      readOnly,
      required,
      form,
      size,
      ariaLabel,
      onFocusLeave,
    },
    rules,
    kind: resolvedKind,
    session,
    labelledBy: labelable.labelId,
    describedBy: labelable.getDescriptionProps({})["aria-describedby"],
    invalid: invalidProp || inputInvalid,
    range: false,
    registerPresets: presetPanes.registerPresets,
    readPreset,
  });

  /**
   * What a gesture edits: the value as it is now, or, while the picker is empty, what it holds. A
   * held draft belongs to the empty value, so a value committed earlier in the same gesture wins.
   */
  function currentDraft(): EndpointDraft {
    const { value: now } = latest.current;
    return now === null ? (held?.value ?? EMPTY_END) : endOfValue(now);
  }

  const inputChange = useStableCallback(
    (next: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      if (!commit(next, details.reason, details.event, details.trigger)) {
        details.cancel();
      }
    }
  );
  const selectDay = useStableCallback(
    (day: Temporal.PlainDate, details: CalendarRootValueChangeEventDetails) => {
      const state = latest.current;
      // The value's time, or the time typed in the popup of an empty picker, or midnight.
      const next = pickEndDay(currentDraft(), day, kind);
      if (kind.kind !== "PlainDate" && endAwaitsTime(next) && !state.shouldCloseOnSelect) {
        // React Aria holds the day until a time is chosen: in the popup's time input, or by the
        // popup closing, which commits it at midnight.
        hold(next, { reason: details.reason, event: details.event, trigger: details.trigger });
        return;
      }
      // A picked day always has a value: midnight until a time comes.
      const value = pickedEndValue(next, kind);
      if (!commit(value, details.reason, details.event, details.trigger)) {
        details.cancel();
        return;
      }
      markPicked(value.toString());
      if (state.shouldCloseOnSelect) {
        root.requestOpen(false, details.reason, details.event, details.trigger);
      }
    }
  );

  const timeChange = useStableCallback(
    (time: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      const current = currentDraft();
      if (time === null) {
        // A cleared time leaves a value's own time; an empty picker forgets the time it held.
        const cleared = clearEndTime(current);
        if (cleared === undefined) {
          details.cancel();
        } else if (held !== null) {
          hold(cleared, held.finalizeOnClose);
        }
        return;
      }
      const next = editEndTime(current, time, kind);
      const value = endValue(next, kind);
      if (value === null) {
        // No day yet: the wall time waits for one, as React Aria's held time, and takes the
        // picker's kind and zone as they are when the day comes.
        hold(next, null);
        return;
      }
      if (!commit(value, details.reason, details.event, details.trigger)) {
        details.cancel();
        return;
      }
      // The popup made this value: the calendar under it stays mounted on its month.
      markPicked(value.toString());
    }
  );

  const { inputSettings, calendarSettings, timeSettings } = root;
  const timeBinding = usePickerTimeBinding(draft, kind, timeChange);
  const context = useMemo(
    (): DatePickerRootContextValue => ({
      value,
      // Worked out here, so a time value's day, a new object each time, keeps the context.
      calendarDay: endDay(draft),
      calendarKey: `${generation}:${viewKey}`,
      inputKey: generation,
      inputSettings,
      calendarSettings,
      timeSettings,
      timeBinding,
      invalid: invalidProp,
      name,
      ariaLabel,
      inputChange,
      selectDay,
      reportInputInvalid: setInputInvalid,
    }),
    [
      value,
      draft,
      generation,
      viewKey,
      inputSettings,
      calendarSettings,
      timeSettings,
      timeBinding,
      invalidProp,
      name,
      ariaLabel,
      inputChange,
      selectDay,
    ]
  );

  const element = usePickerRootElement({
    root,
    slot: "date-picker",
    className,
    classes: styles.root(),
    render,
    elementProps,
    children,
    resetRef: session.resetRef,
  });
  return <DatePickerRootContext value={context}>{element}</DatePickerRootContext>;
}

/**
 * `DatePicker.Input` takes `DateInput.Root`'s presentation props; the value, bounds, time options
 * and state come from `DatePicker.Root`.
 */
export type DatePickerInputProps = PickerInputPartProps;

/**
 * The picker's segments: a `DateInput.Root` bound to the picker's value, inside the group. The
 * group is the field box and the named `group`, so the input itself is presentational and paints
 * no box. Typing reports through `onValueChange` with the input's reasons.
 */
export function DatePickerInput(props: DatePickerInputProps): ReactElement {
  const root = useDatePickerRootContext("DatePicker.Input");
  return (
    <PickerDateInput
      // A form reset remounts the input, so its draft and shown error start over.
      key={root.inputKey}
      {...definedProps(props)}
      onInvalidChange={root.reportInputInvalid}
      value={root.value}
      onValueChange={root.inputChange}
      {...root.inputSettings}
      {...definedProps({ name: root.name, "aria-label": props["aria-label"] ?? root.ariaLabel })}
      invalid={root.invalid}
    />
  );
}

/**
 * `DatePicker.Calendar` takes `Calendar.Root`'s presentation props; the value, bounds and calendar
 * options come from `DatePicker.Root`.
 */
export type DatePickerCalendarProps = Omit<CalendarRootProps, PickerOwnedCalendarProp> & {
  /** Extra classes, merged after the picker's own. */
  className?: string;
};

/**
 * The picker's calendar, a `Calendar.Root` on the picker's day: the value's own wall-clock day,
 * which picking a day replaces while keeping the time. A picked day reports `"day-press"` or
 * `"keyboard"` and closes the popup unless `shouldCloseOnSelect` is off. Its view follows a value
 * set from elsewhere, such as a preset. Without children it renders the month buttons, the visible
 * months' heading and the months; with them, compose `Calendar`'s parts.
 */
export function DatePickerCalendar({ className, children, ...props }: DatePickerCalendarProps): ReactElement {
  const root = useDatePickerRootContext("DatePicker.Calendar");
  return (
    <CalendarRoot
      key={root.calendarKey}
      {...definedProps(props)}
      value={root.calendarDay}
      onValueChange={root.selectDay}
      {...root.calendarSettings}
      className={cn(styles.calendar(), className)}>
      {children ?? <DefaultCalendarChildren />}
    </CalendarRoot>
  );
}

/**
 * DatePickerField's popup column: the calendar, and the time input under it while the picker's
 * values have a time. A date-only picker's popup holds the calendar alone, with no column around it.
 * Private to the composite: a composition places `DatePicker.TimeInput` itself.
 */
export function DatePickerFieldCalendar({
  shouldForceLeadingZeros,
}: {
  readonly shouldForceLeadingZeros: boolean;
}): ReactElement {
  const root = useDatePickerRootContext("DatePickerField");
  if (root.timeSettings === null) {
    return <DatePickerCalendar />;
  }
  return (
    <div className={styles.timeColumn()}>
      <DatePickerCalendar />
      <DatePickerTimeInput shouldForceLeadingZeros={shouldForceLeadingZeros} />
    </div>
  );
}

/**
 * `DatePicker.TimeInput` takes `DateInput.Root`'s presentation props; the value, the time options
 * and the state come from `DatePicker.Root`.
 */
export type DatePickerTimeInputProps = PickerInputPartProps;

/**
 * The time of the picker's value, edited in the popup under the calendar, as React Spectrum's
 * picker edits it: a `DateInput.Root` showing only the hour onwards, named "Time". It renders
 * nothing while the picker's values have no time (a PlainDate, or `granularity="day"`). A time
 * typed in a picker with a value changes that value's time; in an empty picker it waits for a day,
 * and a day picked then (with `shouldCloseOnSelect={false}`, or before it) commits at that time
 * rather than at midnight. A time waiting for a day is a wall-clock time: it takes the picker's
 * zone and kind as they are when the day comes, so a `timeZone` changed meanwhile applies. Typing
 * reports through the Root's `onValueChange` with the input's reasons. It is a Field of its own: it
 * submits nothing, and a half-typed time marks only itself.
 */
export function DatePickerTimeInput(props: DatePickerTimeInputProps): ReactElement | null {
  const root = useDatePickerRootContext("DatePicker.TimeInput");
  return (
    <PickerTimeInput
      {...props}
      binding={root.timeBinding}
      settings={root.timeSettings}
      label="time"
      resetKey={root.inputKey}
    />
  );
}
