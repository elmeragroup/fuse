"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type { FocusEvent, ReactElement, ReactNode } from "react";

import type { useRender } from "@base-ui/react/use-render";

import { useStableCallback } from "../../hooks/use-stable-callback";
import { checkBounds } from "../../temporal/bounds";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import { boundDay } from "../calendar/calendar-dates";
import type { CalendarPageBehavior } from "../calendar/calendar-dates";
import { useRangeProp } from "../calendar/calendar-input";
import type { CalendarFirstDayOfWeek } from "../calendar/calendar-input";
import type { DateInputValue } from "../date-field/date-input";
import type { DateInputValueChangeEventDetails } from "../date-field/date-input-change-details";
import { valueError } from "../date-field/date-input-validation";
import type { KindProps, PropsMadeValue } from "../date-field/date-kind-props";
import { useValueKind } from "../date-field/use-value-kind";
import { datePickerVariants } from "../date-picker/date-picker-variants";
import type {
  DatePickerChangeEventDetails,
  DatePickerOpenChangeEventDetails,
  DatePickerPresetRange,
  DatePickerValidationError,
} from "../date-picker/picker-change-details";
import type { DatePickerClassName } from "../date-picker/picker-class-name";
import {
  useOutsideChanges,
  usePickerRoot,
  usePickerRootElement,
  usePickerRules,
  usePresetReader,
} from "../date-picker/picker-root";
import { usePresetRegistry } from "../date-picker/picker-shell";
import type { PickerState } from "../date-picker/picker-shell";
import { usePickerTimeBinding } from "../date-picker/picker-time-input";
import { presetRange } from "../date-picker/picker-value";
import { usePickerSession } from "../date-picker/use-picker-session";
import type {
  RangeCalendarRootValueChangeEventDetails,
  RangeCalendarValue,
} from "../range-calendar/range-calendar";
import { DateRangePickerRootContext, EMPTY_ENDS, NO_MESSAGES, rangeKey } from "./date-range-picker-context";
import type {
  DateRangePickerRootContextValue,
  Endpoint,
  EndpointMessages,
  Ends,
  RangeHeldReason,
  RangePart,
} from "./date-range-picker-context";
import {
  awaitsTime,
  clearTime,
  draftOfRange,
  editInput,
  editTime,
  kindWitnessOf,
  pickRange,
  shownEnds,
  wholeRange,
} from "./range-draft";
import type { RangeDraft, WholeRange } from "./range-draft";

const styles = datePickerVariants({ range: true });

/**
 * A range of a picker's kind: what the Root takes, each end a Temporal value from any
 * implementation, and what it reports, each end this runtime's.
 *
 * @template T - The ends' kind.
 */
export type DateRangePickerValue<T extends DateInputValue = Temporal.PlainDate> = {
  /** The first value. */
  readonly start: T;
  /** The last value. Typing can put it before `start`; the picker then reports the range invalid. */
  readonly end: T;
};

/**
 * The gestures that change a range picker's value: a range completed in the calendar, an input's
 * typing, clearing and pasting, or a press on a preset with a `dateValue`. The calendar completes a
 * range on a second day pressed or chosen with Enter or Space, a press outside the days, or focus
 * leaving the calendar with an open range.
 */
export type DateRangePickerValueChangeReason =
  | "day-press"
  | "keyboard"
  | "outside-press"
  | "focus-out"
  | "input-change"
  | "input-clear"
  | "input-paste"
  | "preset-press";

/** Why a range fails: an end's own error, or its end before its start. */
export type DateRangePickerValidationError = DatePickerValidationError | "rangeReversed";

/** What `DateRangePicker.Root`'s `onValueChange` receives beside the new range. */
export type DateRangePickerValueChangeEventDetails =
  DatePickerChangeEventDetails<DateRangePickerValueChangeReason> & {
    /**
     * The new range's first validation error, worked out when called, or `null`: the start's own,
     * the end's own, then `"rangeReversed"` when the end comes before the start.
     */
    readonly getValidationError: () => DateRangePickerValidationError | null;
  };

/**
 * The state `DateRangePicker.Root` shares with its `render` callback and writes as data
 * attributes: `open` as `data-open`, `disabled` as `data-disabled`, `readonly` as `data-readonly`
 * and `invalid` as `data-invalid="true"`, which holds while either end, or the range, shows as
 * invalid.
 */
// A mapped copy, so the public name is a type of its own, which prints as itself rather than as
// the private `PickerState`, and keeps each field's documentation.
export type DateRangePickerRootState = { readonly [K in keyof PickerState]: PickerState[K] };

/**
 * Props for `DateRangePicker.Root`: a `div`'s props, Base UI's `render` and the picker's own.
 *
 * @template T - The ends' kind: `Temporal.PlainDate`, which is the default, `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the Root reads it from its `value` or `defaultValue`, and without
 *   either from `granularity` and `timeZone`, as `DateInput.Root` does.
 */
export type DateRangePickerRootProps<T extends DateInputValue = Temporal.PlainDate> = Omit<
  useRender.ComponentProps<"div", DateRangePickerRootState>,
  "defaultValue" | "onChange" | "className" | "aria-label"
> & {
  /**
   * Extra classes, or a callback of the Root's state that returns them. The Root is a grid of one
   * column, so pass `justify-items-center` to center its label, field box, error and description
   * across it. `items-center` aligns each part down its own row and moves nothing.
   */
  className?: DatePickerClassName<DateRangePickerRootState>;
  /**
   * The range, when the parent owns it: each end a Temporal value of `T`'s kind from any
   * implementation. A server component cannot pass one, since it reaches the client as ISO text,
   * which the picker refuses with a `TypeError`: build the value in a client component. `null`
   * empties both ends. Picking a range in the calendar keeps each end's time and zone.
   *
   * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
   * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib; see
   * [Quick start](https://fuse.elmeragroup.no/quick-start#temporal).
   */
  value?: DateRangePickerValue<T> | null;
  /** The first range, when the picker owns its value. Takes what `value` takes. */
  defaultValue?: DateRangePickerValue<T> | null;
  /**
   * Called with this runtime's range once both ends hold a value and one of them changes, or `null`
   * when a whole range loses an end, as React Aria reports it; the other end stays in its input. A
   * range filled one end at a time reports nothing until both hold a value. `details.reason` is
   * `"day-press"`, `"keyboard"`, `"outside-press"` or `"focus-out"` for a range completed in the
   * calendar, `"input-change"`, `"input-clear"` or `"input-paste"` for an input, or
   * `"preset-press"` for a `PresetItem` with a `dateValue` range. The other details are
   * `DatePicker.Root`'s.
   * Canceling with `details.cancel()` keeps the range: a canceled day keeps the popup open with the
   * anchor, so the user can pick another end, a canceled edit shows the range again in the
   * segments, and a canceled preset stays unchecked. An end before its start commits and shows
   * invalid on the end with "Start date must be before end date.", as React Aria reports it.
   */
  onValueChange?: NoInfer<
    (value: DateRangePickerValue<T> | null, details: DateRangePickerValueChangeEventDetails) => void
  >;
  /** Whether the popup is open, when the parent owns it. */
  open?: boolean;
  /** Whether the popup starts open. */
  defaultOpen?: boolean;
  /**
   * Called when the popup opens or closes, as `DatePicker.Root`'s `onOpenChange`. The first Escape
   * in the calendar drops a half-picked range and keeps the popup open; the next closes it.
   */
  onOpenChange?: (open: boolean, details: DatePickerOpenChangeEventDetails) => void;
  /**
   * Whether completing a range in the calendar closes the popup. With a time `granularity` and no
   * range yet, the picker holds a completed range while the popup stays open, as `DatePicker.Root`
   * holds its day. The range commits once both `StartTimeInput` and `EndTimeInput` hold a time, and
   * otherwise when the popup closes, with midnight for an end without a typed time. That commit
   * runs first, and canceling it keeps the popup open. A half-filled range the inputs hold belongs
   * to the range the user typed it over, and a new range from the parent drops it for good. A
   * native form reset drops both, the half-typed segments and the shown errors.
   * @default true
   */
  shouldCloseOnSelect?: boolean;
  /** The earliest valid value for either end, a Temporal value of any kind. */
  minValue?: TemporalValue;
  /** The latest valid value for either end. */
  maxValue?: TemporalValue;
  /** Values the picker refuses for either end. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /** The smallest unit the inputs edit. Without a value it names the kind, as DateInput's does. */
  granularity?: DateGranularity;
  /** The hour cycle the picker shows. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Whether the picker hides zoned values' zone names. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes. */
  timeZone?: string;
  /** The weekday each calendar row starts on. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows. @default 1 */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view. @default "visible" */
  pageBehavior?: CalendarPageBehavior;
  /** Whether the picker is disabled, so nothing responds and the form leaves out its values. */
  disabled?: boolean;
  /** Whether the range cannot change. */
  readOnly?: boolean;
  /** Whether an empty or incomplete end is invalid. */
  required?: boolean;
  /** Whether the picker shows as invalid whatever its value. */
  invalid?: boolean;
  /**
   * The name the start's ISO value submits and `Form` errors arrive under. Each input is a Base UI
   * Field of its own: a `Form` reads both ISO values, holds errors under either name and focuses
   * the input whose error it returns.
   */
  startName?: string;
  /** The name the end's ISO value submits and `Form` errors arrive under, as `startName`'s. */
  endName?: string;
  /** The id of the form the values submit with. */
  form?: string;
  /** The field box's size. @default "default" */
  size?: "default" | "sm";
  /** Names the picker when it renders no `DateRangePicker.Label`. */
  "aria-label"?: string;
  /**
   * Called when focus leaves the picker: its group and its popup together. It receives the `blur`
   * that started the leave, as `DatePicker.Root`'s `onFocusLeave` does.
   */
  onFocusLeave?: (event: FocusEvent<Element>) => void;
  /**
   * The parts: a `DateRangePicker.Label`, a `DateRangePicker.Group` with
   * `DateRangePicker.StartInput`, `DateRangePicker.Separator`, `DateRangePicker.EndInput` and
   * `DateRangePicker.Trigger`, then `DateRangePicker.Error`, `DateRangePicker.Description` and a
   * `DateRangePicker.Popup` with `DateRangePicker.Calendar`. For values with a time, put
   * `DateRangePicker.StartTimeInput` and `DateRangePicker.EndTimeInput` in the popup after the
   * calendar. The label, the description and the error belong to the Root, outside the two ends'
   * Fields, and the Root wires them to both inputs and the group.
   */
  children?: ReactNode;
};

/** The Root its prop errors name. */
const OWNER = "DateRangePicker.Root";

/** Whether the end comes before the start, compared as the bounds compare. */
function isReversed(ends: Ends): boolean {
  return (
    ends.start !== null &&
    ends.end !== null &&
    checkBounds(ends.end, { min: ends.start, max: undefined }) === "underflow"
  );
}

/**
 * A date range picker: a start and an end input and a range calendar in a popup, over one range.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The ends' kind, inferred as `DateInput.Root`'s is.
 * @throws TypeError naming the prop and the fix when a value or bound is a string rather than a
 *   Temporal object, or a time `granularity` meets a PlainDate value: host defects.
 */
export function DateRangePickerRoot<P = object, T extends DateInputValue = PropsMadeValue<P>>({
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
  startName,
  endName,
  form,
  size = "default",
  "aria-label": ariaLabel,
  onFocusLeave,
  className,
  render,
  children,
  ...elementProps
}: DateRangePickerRootProps<T> & KindProps<P, DateRangePickerRootProps<DateInputValue>>): ReactElement {
  const parsedValue = useRangeProp(valueProp, OWNER, "value");
  const parsedDefault = useRangeProp(defaultValue, OWNER, "defaultValue");
  // SAFETY: the picker checks values of its resolved kind, which is `T`'s.
  const unavailable = isDateUnavailable as ((value: TemporalValue) => boolean) | undefined;
  // The rules are worked out before the session, so a commit it makes while the popup closes reads
  // this render's.
  const rules = usePickerRules(OWNER, minValue, maxValue, unavailable);

  // The preset panes, told when the range is committed by anything but a preset press.
  const presetPanes = usePresetRegistry();

  /**
   * Reports a whole range, or `null` for one that lost an end, and returns whether it was accepted.
   * The caller then applies an accepted range to the session.
   */
  function reportRange(
    range: { readonly start: TemporalValue; readonly end: TemporalValue } | null,
    reason: DateRangePickerValueChangeReason,
    event: Event,
    trigger: Element | undefined
  ): boolean {
    const details = createChangeEventDetails(reason, event, trigger, {
      getValidationError: (): DateRangePickerValidationError | null => {
        if (range === null) return null;
        return (
          valueError(range.start, rules) ??
          valueError(range.end, rules) ??
          (isReversed(range) ? "rangeReversed" : null)
        );
      },
    });
    // SAFETY: both ends are of the picker's resolved kind, which is `T`'s.
    onValueChange?.(range as DateRangePickerValue<T> | null, details);
    if (details.isCanceled) {
      return false;
    }
    if (reason !== "preset-press") {
      presetPanes.valueCommitted();
    }
    return true;
  }

  // The edit session stores the committed range and what the picker holds before it commits, and
  // runs the open transitions and the form reset; see `use-picker-session.ts`.
  const session = usePickerSession<RangeDraft, Ends, RangeHeldReason>({
    open: openProp,
    defaultOpen,
    onOpenChange,
    parent: valueProp === undefined ? undefined : { value: parsedValue ?? EMPTY_ENDS },
    defaultValue: parsedDefault ?? EMPTY_ENDS,
    keyOf: rangeKey,
    draftOf: draftOfRange,
    // A range the close finalizes is always whole; an end picked without a time takes midnight.
    // Called after this render has resolved `kind`.
    finalize(held, origin) {
      const range = wholeRange(held, kind);
      if (range === null) {
        return true;
      }
      if (!reportRange(range, origin.reason, origin.event, origin.trigger)) {
        return false;
      }
      session.commit(range);
      // The calendar made this range, so a close that the parent cancels keeps the view where it is.
      markPicked(rangeKey(range));
      return true;
    },
    onReset() {
      presetPanes.valueCommitted();
    },
  });
  // What the picker holds before it commits (`range-draft.ts`): half a range the inputs hold, a
  // range picked in an empty time picker that stays open, or times typed in the popup waiting for
  // days. Without one, the committed range is the draft.
  const { generation, hold, edit, held, draft, value: committed } = session;
  // The calendar's view follows a range set from anywhere but the picker itself.
  const [outsideChanges, markPicked] = useOutsideChanges(session.basis);

  const [messagesOf, setMessagesOf] = useState<Readonly<Record<Endpoint, EndpointMessages>>>({
    start: NO_MESSAGES,
    end: NO_MESSAGES,
  });
  const [inputInvalid, setInputInvalid] = useState({ start: false, end: false });
  // The Root tracks which of the Label, Description and Error render. The Label and Description
  // register on mount, wherever they sit, and the Error registers while it shows, as DatePicker's
  // Field parts do. The server writes no reference to a part, and the first client render matches
  // it, so hydration succeeds. The names and descriptions follow on mount.
  const [registered, setRegistered] = useState<ReadonlySet<RangePart>>(() => new Set());
  const registerPart = useCallback((part: RangePart) => {
    setRegistered((current) => (current.has(part) ? current : new Set(current).add(part)));
    return () =>
      setRegistered((current) => {
        if (!current.has(part)) {
          return current;
        }
        const next = new Set(current);
        next.delete(part);
        return next;
      });
  }, []);
  const { hasPresets, registerPresets } = presetPanes;

  const invalid = invalidProp || inputInvalid.start || inputInvalid.end;
  const messages = useMemo(() => [...new Set([...messagesOf.start, ...messagesOf.end])], [messagesOf]);
  const hasLabel = registered.has("label");

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const descriptionId = `${baseId}-description`;
  const errorId = `${baseId}-error`;
  const nameId = `${baseId}-name`;
  const describedBy =
    [registered.has("description") ? descriptionId : undefined, registered.has("error") ? errorId : undefined]
      .filter((id) => id !== undefined)
      .join(" ") || undefined;

  // The picker's kind is the start's, or the end's while the start is empty. An empty input takes
  // this kind, and an input with a value takes that value's own kind; see `date-input-kind.ts`. The
  // picker therefore warns of a kind change.
  const resolvedKind = useValueKind(
    {
      value: kindWitnessOf(draft),
      defaultValue: parsedDefault?.start ?? parsedDefault?.end ?? null,
      granularity,
      timeZone,
    },
    OWNER,
    { warnOnKindChange: true }
  );
  const { kind } = resolvedKind;
  // A preset's range replaces whatever the inputs or the calendar held.
  const readPreset = usePresetReader(presetRange, kind, (range: DatePickerPresetRange, event, trigger) => {
    if (!reportRange(range, "preset-press", event, trigger)) {
      return false;
    }
    session.commitHolding(range, null);
    return true;
  });
  // Each end as its input shows it, one object while the draft and the kind hold.
  const ends = useMemo(
    () => (held === null ? committed : shownEnds(held.value, kind)),
    [held, committed, kind]
  );
  const reversed = isReversed(ends);
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
    labelledBy: hasLabel ? labelId : undefined,
    describedBy,
    invalid,
    range: true,
    registerPresets,
    readPreset,
  });
  /**
   * Applies a draft a gesture made: a whole range commits, and so does a whole range that just lost
   * an end, as `null`, which React Aria reports too. A range filled one end at a time reports
   * nothing until it is whole, and the Root holds the draft over the empty range meanwhile. The
   * committed range is whole or empty.
   *
   * @returns The whole range it committed, `null` for a draft that is not whole, or `"canceled"`
   *   when `onValueChange` canceled the commit.
   */
  function apply(
    next: RangeDraft,
    reason: DateRangePickerValueChangeReason,
    event: Event,
    trigger: Element | undefined
  ): WholeRange | null | "canceled" {
    const range = wholeRange(next, kind);
    if (range === null && session.now().value.start === null) {
      // The range is already empty, so there is nothing to report.
      hold(next, null);
      return null;
    }
    if (!reportRange(range, reason, event, trigger)) {
      return "canceled";
    }
    // A range that lost an end holds the end it kept over the empty range it commits.
    session.commitHolding(range ?? EMPTY_ENDS, range === null ? next : null);
    return range;
  }

  const inputChange = useStableCallback(
    (endpoint: Endpoint, next: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      const edited = editInput(session.now().draft, endpoint, next);
      if (apply(edited, details.reason, details.event, details.trigger) === "canceled") {
        details.cancel();
      }
    }
  );
  const selectRange = useStableCallback(
    (range: RangeCalendarValue, details: RangeCalendarRootValueChangeEventDetails) => {
      const now = session.now();
      // Each end keeps its time: its value's, the one typed in the popup, or midnight.
      const next = pickRange(now.draft, range, kind);
      if (
        kind.kind !== "PlainDate" &&
        now.value.start === null &&
        now.value.end === null &&
        awaitsTime(next) &&
        !shouldCloseOnSelect
      ) {
        // As the single picker's day: an empty time range is held until both ends have a time
        // typed in the popup, or until the popup closes.
        hold(next, { reason: details.reason, event: details.event, trigger: details.trigger });
        return;
      }
      const applied = apply(next, details.reason, details.event, details.trigger);
      if (applied === "canceled") {
        details.cancel();
        return;
      }
      if (applied !== null) {
        markPicked(rangeKey(applied));
      }
      if (shouldCloseOnSelect && (details.reason === "day-press" || details.reason === "keyboard")) {
        root.requestOpen(false, details.reason, details.event, details.trigger);
      }
    }
  );

  const timeChange = useStableCallback(
    (endpoint: Endpoint, time: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      // A range the calendar holds keeps closing commits it until both ends have their time.
      const current = session.now().draft;
      if (time === null) {
        // A value keeps its own time, which the input shows again; anything else forgets it.
        const cleared = clearTime(current, endpoint);
        if (cleared === undefined) {
          details.cancel();
        } else if (cleared !== current) {
          edit(cleared);
        }
        return;
      }
      const next = editTime(current, endpoint, time, kind);
      if (awaitsTime(next)) {
        edit(next);
        return;
      }
      const applied = apply(next, details.reason, details.event, details.trigger);
      if (applied === "canceled") {
        details.cancel();
        return;
      }
      // The popup made this range, so the calendar under it stays on its months.
      if (applied !== null) {
        markPicked(rangeKey(applied));
      }
    }
  );
  // Each end's popup time input.
  const startBinding = usePickerTimeBinding(draft.start, kind, (time, details) =>
    timeChange("start", time, details)
  );
  const endBinding = usePickerTimeBinding(draft.end, kind, (time, details) =>
    timeChange("end", time, details)
  );
  const timeBindings = useMemo(() => ({ start: startBinding, end: endBinding }), [startBinding, endBinding]);

  const reportMessages = useCallback(
    (endpoint: Endpoint, next: EndpointMessages) => {
      setMessagesOf((current) =>
        current[endpoint].join("\n") === next.join("\n") ? current : { ...current, [endpoint]: next }
      );
    },
    [setMessagesOf]
  );
  const reportInputInvalid = useCallback(
    (endpoint: Endpoint, next: boolean) => {
      setInputInvalid((current) => (current[endpoint] === next ? current : { ...current, [endpoint]: next }));
    },
    [setInputInvalid]
  );

  const calendarRange = useMemo(
    () =>
      ends.start === null || ends.end === null
        ? null
        : { start: boundDay(ends.start), end: boundDay(ends.end) },
    [ends]
  );
  const endpointLabelledBy = hasLabel ? labelId : ariaLabel === undefined ? undefined : nameId;
  const { inputSettings, calendarSettings, timeSettings } = root;
  const context = useMemo(
    (): DateRangePickerRootContextValue => ({
      ends,
      calendarRange,
      generation,
      viewFollow: { resets: generation, changes: outsideChanges },
      endpointLabelledBy,
      inputSettings,
      calendarSettings,
      timeSettings,
      timeBindings,
      invalidProp,
      invalid,
      reversed,
      names: { start: startName, end: endName },
      labelId,
      descriptionId,
      errorId,
      messages,
      describedBy,
      hasPresets,
      registerPart,
      inputChange,
      selectRange,
      reportMessages,
      reportInputInvalid,
    }),
    [
      ends,
      calendarRange,
      generation,
      outsideChanges,
      endpointLabelledBy,
      inputSettings,
      calendarSettings,
      timeSettings,
      timeBindings,
      invalidProp,
      invalid,
      reversed,
      startName,
      endName,
      labelId,
      descriptionId,
      errorId,
      messages,
      describedBy,
      hasPresets,
      registerPart,
      inputChange,
      selectRange,
      reportMessages,
      reportInputInvalid,
    ]
  );

  const element = usePickerRootElement({
    root,
    slot: "date-range-picker",
    className,
    classes: styles.root(),
    render,
    elementProps,
    children,
    extra:
      // Names both inputs' segments when the picker has only an `aria-label`.
      !hasLabel && ariaLabel !== undefined ? (
        <span id={nameId} hidden>
          {ariaLabel}
        </span>
      ) : null,
    resetRef: session.resetRef,
  });
  return <DateRangePickerRootContext value={context}>{element}</DateRangePickerRootContext>;
}
