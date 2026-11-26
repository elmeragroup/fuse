"use client";

import { createContext, use, useMemo, useState } from "react";
import type { FocusEvent, ReactElement, ReactNode } from "react";

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
import { CalendarViewFollowContext } from "../calendar/use-view-follows-value";
import type { CalendarViewFollow } from "../calendar/use-view-follows-value";
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
  useOutsideChanges,
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
 * Props for `DatePicker.Root`: a `div`'s props, Base UI's `render` and the picker's own.
 *
 * @template T - The value's kind: `Temporal.PlainDate`, `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the Root reads it as `DateInput.Root` does.
 */
export type DatePickerRootProps<T extends DateInputValue = Temporal.PlainDate> = Omit<
  useRender.ComponentProps<"div", DatePickerRootState>,
  "defaultValue" | "onChange" | "className" | "aria-label"
> & {
  /**
   * Extra classes, or a callback of the Root's state that returns them. The Root is a grid of one
   * column, so pass `justify-items-center` to center its parts across it. `items-center` aligns
   * each part down its own row and moves nothing.
   */
  className?: DatePickerClassName<DatePickerRootState>;
  /**
   * The value, when the parent owns it: a Temporal value of `T`'s kind from any implementation. A
   * server component cannot pass one, since it reaches the client as ISO text, which the picker
   * refuses with a `TypeError`: build the value in a client component. `null` empties it. Picking a
   * day keeps the value's time and zone.
   *
   * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
   * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib; see
   * [Quick start](https://fuse.elmeragroup.no/quick-start#temporal).
   */
  value?: T | null;
  /** The first value, when the picker owns its value. Takes what `value` takes. */
  defaultValue?: T | null;
  /**
   * Called when the user picks a day in the calendar or the input forms a new value, with this
   * runtime's value, or with `null` when the user clears the input. `details.reason` is
   * `"day-press"`, `"keyboard"`, `"input-change"`, `"input-clear"`, `"input-paste"` or
   * `"preset-press"`, for a `PresetItem` with a `dateValue`. `details.event`, `details.trigger` and
   * `details.getValidationError()` are the input's. Canceling with `details.cancel()` keeps the
   * value: a canceled day keeps the popup open with focus on the day, a canceled edit shows the
   * value again in the segments, and a canceled preset stays unchecked.
   */
  onValueChange?: NoInfer<(value: T | null, details: DatePickerValueChangeEventDetails) => void>;
  /** Whether the popup is open, when the parent owns it. */
  open?: boolean;
  /** Whether the popup starts open. */
  defaultOpen?: boolean;
  /**
   * Called when the popup opens or closes. `details.reason` is Base UI Popover's, such as
   * `"trigger-press"`, `"outside-press"`, `"escape-key"` or `"focus-out"`, or the picker's own:
   * `"keyboard"` for Alt+ArrowDown in the group or Enter on a day that closes it, `"day-press"` or
   * `"preset-press"`. Canceling with `details.cancel()` keeps the popup as it is. Opening moves
   * focus to the calendar's focused day, the selected one or today. Closing, by Escape among
   * others, returns focus to the segment it opened from, or to the trigger. Typing in the input
   * never opens the popup, and opening it never commits a half-typed value.
   */
  onOpenChange?: (open: boolean, details: DatePickerOpenChangeEventDetails) => void;
  /**
   * Whether picking a day closes the popup. With a time `granularity` and no value yet, a picked
   * day is held while the popup stays open: a time typed in `DatePicker.TimeInput` commits it at that
   * time, and otherwise it commits at midnight when the popup closes, however it closes, including
   * a parent setting `open` to `false`. A time typed before any day waits for one. That commit
   * runs first and reports the pick's reason; canceling it keeps the popup open with the day still
   * held. A native form reset drops a held day and any half-typed segments, and the shown error,
   * also when the value is unchanged.
   * @default true
   */
  shouldCloseOnSelect?: boolean;
  /** The earliest valid value, a Temporal value of any kind. The calendar disables earlier days. */
  minValue?: TemporalValue;
  /** The latest valid value, a Temporal value of any kind. */
  maxValue?: TemporalValue;
  /**
   * Values the picker refuses: the calendar's days stay focusable but unselectable, and a typed one
   * is invalid.
   */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /**
   * The smallest unit the input edits. A time granularity needs a value with a time. Without a
   * value it names the kind, as DateInput's does, and until a value names its kind an empty picker
   * follows changes to `granularity` and `timeZone`, in what the input types and in what the
   * calendar picks.
   */
  granularity?: DateGranularity;
  /** The hour cycle the input and `DatePicker.TimeInput` show. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name in the input and in `DatePicker.TimeInput`. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes, as DateInput's `timeZone`. */
  timeZone?: string;
  /** The weekday each calendar row starts on. Defaults to the locale's. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows. @default 1 */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view. @default "visible" */
  pageBehavior?: CalendarPageBehavior;
  /**
   * Whether nothing responds and the value is not submitted. A disabled `Field.Root` or
   * `Field.Set` around the picker disables it whole, the trigger, calendar and presets included,
   * from the server's first render on.
   */
  disabled?: boolean;
  /** Whether the value cannot change. The segments stay focusable; the trigger is disabled. */
  readOnly?: boolean;
  /** Whether an empty or incomplete value is invalid. */
  required?: boolean;
  /** Whether the picker shows as invalid whatever its value. */
  invalid?: boolean;
  /**
   * The name the ISO value submits under. A surrounding Field's `name` wins. Inside a Base UI
   * Field, such as `Field.Root` or `DatePickerField`, the input is the Field's control.
   * `Field.Label` then names the group, the segments, the trigger and the popup, so the trigger
   * reads "Calendar Start date", and a `Form` focuses the first segment for an error.
   */
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
  /**
   * The picker's accessible name when no Field label names it. It names the group, the segments, the
   * trigger and the popup.
   */
  "aria-label"?: string;
  /**
   * The parts: a `DatePicker.Group` with `DatePicker.Input` and `DatePicker.Trigger`, and a
   * `DatePicker.Popup` with `DatePicker.Calendar`. For a value with a time, put
   * `DatePicker.TimeInput` in the popup after the calendar. It renders only while the picker's
   * values have a time, that is a `PlainDateTime` or `ZonedDateTime` and a `granularity` finer
   * than `"day"`. It is named "Time" and reports through `onValueChange` with the input's reasons. It is
   * a Field of its own: it submits nothing, and a half-typed time marks only itself. A preset pane,
   * `DatePicker.Presets`, goes in the popup beside the calendar.
   */
  children?: ReactNode;
};

/** What the Input and Calendar parts read from their Root. */
type DatePickerRootContextValue = {
  readonly value: TemporalValue | null;
  /** The day the picker holds: a day picked in an empty picker, else the value's, from `endDay`. */
  readonly calendarDay: Temporal.PlainDate | null;
  /** What the calendar's view follows; see `use-view-follows-value.ts`. */
  readonly viewFollow: CalendarViewFollow;
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

/** A committed value's key, which a held day belongs to and the calendar's view follows. */
function isoOf(value: TemporalValue | null): string {
  return value === null ? "" : value.toString();
}

/**
 * A date picker: a segmented input and a calendar in a popup, over one value. It holds the value
 * and the open state. It reads `globalThis.Temporal`, so a host without native Temporal imports
 * `@elmeragroup/fuse/temporal-polyfill`.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The value's kind, inferred as `DateInput.Root`'s is.
 * @throws TypeError naming the prop and the fix when `value`, `defaultValue`, `minValue` or
 *   `maxValue` is a string rather than a Temporal object, or a time `granularity` meets a
 *   PlainDate value: host defects.
 */
export function DatePickerRoot<P = object, T extends DateInputValue = PropsMadeValue<P>>({
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
}: DatePickerRootProps<T> & KindProps<P, DatePickerRootProps<DateInputValue>>): ReactElement {
  const labelable = useLabelableContext();
  const parsedValue = useTemporalProp(valueProp, OWNER, "value");
  const parsedDefault = useTemporalProp(defaultValue, OWNER, "defaultValue");
  const [inputInvalid, setInputInvalid] = useState(false);
  // SAFETY: the picker checks values of its resolved kind, which is `T`'s.
  const unavailable = isDateUnavailable as ((value: TemporalValue) => boolean) | undefined;
  // Worked out before the session, so a commit it makes while the popup closes reads this render's.
  const rules = usePickerRules(OWNER, minValue, maxValue, unavailable);

  // The preset panes, told when the value is committed by anything but a preset press.
  const presetPanes = usePresetRegistry();

  /** Reports a new value and applies it unless canceled; returns whether it applied. */
  function commit(
    next: TemporalValue | null,
    reason: DatePickerValueChangeEventDetails["reason"],
    event: Event,
    trigger: Element | undefined
  ): boolean {
    const details = createChangeEventDetails(reason, event, trigger, {
      getValidationError: () => (next === null ? null : valueError(next, rules)),
    });
    // SAFETY: `next` is of the picker's resolved kind, which is `T`'s.
    onValueChange?.(next as T | null, details);
    if (details.isCanceled) {
      return false;
    }
    session.commit(next);
    if (reason !== "preset-press") {
      presetPanes.valueCommitted();
    }
    return true;
  }

  // The edit session stores the committed value and runs the open transitions and the form reset;
  // see `use-picker-session.ts`. It also stores what the picker holds before it commits, which in
  // an empty time picker is a day picked while the popup stays open or a time typed before any day;
  // see `picker-draft.ts`.
  const session = usePickerSession<EndpointDraft, TemporalValue | null, "day-press" | "keyboard">({
    open: openProp,
    defaultOpen,
    onOpenChange,
    parent: valueProp === undefined ? undefined : { value: parsedValue },
    defaultValue: parsedDefault,
    keyOf: isoOf,
    draftOf: endOfValue,
    finalize(held, origin) {
      // A held day at the time typed in the popup, in the picker's kind and zone now, or midnight.
      const next = endValue(held, kind);
      if (next === null) {
        return true;
      }
      if (!commit(next, origin.reason, origin.event, origin.trigger)) {
        return false;
      }
      // The calendar made this value, so a close that the parent cancels keeps the view where it is.
      markPicked(isoOf(next));
      return true;
    },
    onReset() {
      presetPanes.valueCommitted();
    },
  });
  const { value, draft, generation, hold, edit } = session;
  // The calendar's view follows a value that came from anywhere but the picker itself.
  const [outsideChanges, markPicked] = useOutsideChanges(session.basis);
  // The picker's empty input takes this kind, as `date-input-kind.ts` describes, so the picker
  // warns of a kind change.
  const resolvedKind = useValueKind({ value, defaultValue: parsedDefault, granularity, timeZone }, OWNER, {
    warnOnKindChange: true,
  });
  const { kind } = resolvedKind;
  const readPreset = usePresetReader(presetDate, kind, (preset: TemporalValue, event, trigger) =>
    commit(preset, "preset-press", event, trigger)
  );

  const root = usePickerRoot({
    props: {
      granularity,
      hourCycle,
      hideTimeZone,
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

  const inputChange = useStableCallback(
    (next: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      if (!commit(next, details.reason, details.event, details.trigger)) {
        details.cancel();
      }
    }
  );
  const selectDay = useStableCallback(
    (day: Temporal.PlainDate, details: CalendarRootValueChangeEventDetails) => {
      // The value's time, or the time typed in the popup of an empty picker, or midnight.
      const next = pickEndDay(session.now().draft, day, kind);
      if (kind.kind !== "PlainDate" && endAwaitsTime(next) && !shouldCloseOnSelect) {
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
      markPicked(isoOf(value));
      if (shouldCloseOnSelect) {
        root.requestOpen(false, details.reason, details.event, details.trigger);
      }
    }
  );

  const timeChange = useStableCallback(
    (time: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      const current = session.now().draft;
      if (time === null) {
        // A cleared time leaves a value's own time; an empty picker forgets the time it held.
        const cleared = clearEndTime(current);
        if (cleared === undefined) {
          details.cancel();
        } else if (cleared !== current) {
          edit(cleared);
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
      // The popup made this value, so the calendar under it stays on its month.
      markPicked(isoOf(value));
    }
  );

  const { inputSettings, calendarSettings, timeSettings } = root;
  const timeBinding = usePickerTimeBinding(draft, kind, timeChange);
  const context = useMemo(
    (): DatePickerRootContextValue => ({
      value,
      // Worked out here, so a time value's day, a new object each time, keeps the context.
      calendarDay: endDay(draft),
      viewFollow: { resets: generation, changes: outsideChanges },
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
      outsideChanges,
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
 * Props for `DatePicker.Input`: `DateInput.Root`'s presentation props. The value, bounds, time
 * options and state come from `DatePicker.Root`.
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
 * Props for `DatePicker.Calendar`: `Calendar.Root`'s presentation props. The value, bounds and
 * calendar options come from `DatePicker.Root`.
 */
export type DatePickerCalendarProps = Omit<CalendarRootProps, PickerOwnedCalendarProp | "children"> & {
  /** Extra classes, merged after the picker's own. */
  className?: string;
  /**
   * `Calendar`'s parts, composed as in `Calendar.Root`. Defaults to the month buttons, the visible
   * months' heading and the months.
   */
  children?: CalendarRootProps["children"];
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
    <CalendarViewFollowContext value={root.viewFollow}>
      <CalendarRoot
        {...definedProps(props)}
        value={root.calendarDay}
        onValueChange={root.selectDay}
        {...root.calendarSettings}
        className={cn(styles.calendar(), className)}>
        {children ?? <DefaultCalendarChildren />}
      </CalendarRoot>
    </CalendarViewFollowContext>
  );
}

/**
 * DatePickerField's popup column: the calendar, and the time input under it while the picker's
 * values have a time. A date-only picker's popup holds the calendar alone, with no column around it.
 * It is private to the composite. A composition places `DatePicker.TimeInput` itself.
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
 * Props for `DatePicker.TimeInput`: `DateInput.Root`'s presentation props. The value, the time
 * options and the state come from `DatePicker.Root`.
 */
export type DatePickerTimeInputProps = PickerInputPartProps;

/**
 * The time of the picker's value, edited in the popup under the calendar, as React Spectrum's
 * picker edits it: a `DateInput.Root` showing only the hour onwards, named "Time". It renders
 * nothing while the picker's values have no time, that is a PlainDate or `granularity="day"`. A time
 * typed in a picker with a value changes that value's time. In an empty picker it waits for a day,
 * and the day picked next commits at that time rather than at midnight. With
 * `shouldCloseOnSelect={false}`, a day picked before the time waits for the time, then commits at
 * it. A time waiting for a day is a wall-clock time: it takes the picker's zone and kind as they
 * are when the day comes, so a `timeZone` changed meanwhile applies. Typing reports through the
 * Root's `onValueChange` with the input's reasons. It is a Field of its own: it submits nothing,
 * and a half-typed time marks only itself.
 */
export function DatePickerTimeInput(props: DatePickerTimeInputProps): ReactElement | null {
  const root = useDatePickerRootContext("DatePicker.TimeInput");
  return <PickerTimeInput {...props} binding={root.timeBinding} settings={root.timeSettings} label="time" />;
}
