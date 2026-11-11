"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FocusEvent, ReactElement, ReactNode } from "react";

import type { useRender } from "@base-ui/react/use-render";

import { useStableCallback } from "../../hooks/use-stable-callback";
import { isRenderableNode } from "../../internal/is-renderable-node";
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
  useCalendarViewKey,
  usePickerRoot,
  usePickerRootElement,
  usePickerRules,
  usePresetReader,
} from "../date-picker/picker-root";
import type { PickerHeldOrigin } from "../date-picker/picker-session";
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
  DateRangePickerDescription,
  DateRangePickerError,
  DateRangePickerLabel,
} from "./date-range-picker-parts";
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
 * The gestures that change a range picker's value: a range completed in the calendar (a second
 * day pressed or chosen with Enter or Space, a press outside the days, focus leaving the calendar
 * with an open range), an input's typing, clearing and pasting, or a preset with a `dateValue`
 * pressed.
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
 * attributes: `open` (`data-open`), `disabled` (`data-disabled`), `readonly` (`data-readonly`) and
 * `invalid` (`data-invalid="true"`), which holds while either end, or the range, shows as invalid.
 */
// A mapped copy, so the public name is a type of its own, which prints as itself rather than as
// the private `PickerState`, and keeps each field's documentation.
export type DateRangePickerRootState = { readonly [K in keyof PickerState]: PickerState[K] };

/**
 * `DateRangePicker.Root` takes a `div`'s props, Base UI's `render` and the picker's own.
 *
 * @template T - The ends' kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the Root reads it from its `value` or `defaultValue`, and without
 *   either from `granularity` and `timeZone`, as `DateInput.Root` does.
 */
export type DateRangePickerRootProps<T extends DateInputValue = Temporal.PlainDate> = Omit<
  useRender.ComponentProps<"div", DateRangePickerRootState>,
  "defaultValue" | "onChange" | "className"
> & {
  /** Extra classes, or a callback of the Root's state that returns them. */
  className?: DatePickerClassName<DateRangePickerRootState>;
  /**
   * The range, when the parent owns it: each end a Temporal value of `T`'s kind, built in a client
   * component. `null` empties both ends.
   */
  value?: DateRangePickerValue<T> | null;
  /** The first range, when the picker owns its value. */
  defaultValue?: DateRangePickerValue<T> | null;
  /**
   * Called with this runtime's range once both ends hold a value and one of them changes, or `null`
   * when a whole range loses an end, as React Aria reports it; the other end stays in its input. A
   * range filled one end at a time reports nothing until both hold a value. `details.reason` is
   * `"day-press"`, `"keyboard"`, `"outside-press"`, `"focus-out"` (a range completed in the
   * calendar), `"input-change"`, `"input-clear"`, `"input-paste"` or `"preset-press"` (a
   * `PresetItem` with a `dateValue` range). Canceling with `details.cancel()` keeps the range: a
   * canceled day keeps the popup open with the anchor, so another end can be picked, a canceled
   * edit shows the range again in the segments, and a canceled preset stays unchecked.
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
   * range yet, a completed range is held while the popup stays open, as `DatePicker.Root`'s day: it
   * commits once both `StartTimeInput` and `EndTimeInput` hold a time, and otherwise at midnight
   * (an end with a typed time at that time) when the popup closes; that commit runs first, and
   * canceling it keeps the popup open. A half-filled range the inputs hold belongs to the range it
   * was typed over: a new range from the parent drops it for good. A native form reset drops both,
   * the half-typed segments and the shown errors.
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
  /** The hour cycle shown. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides zoned values' zone names. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes. */
  timeZone?: string;
  /** The weekday each calendar row starts on. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows. @default 1 */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view. @default "visible" */
  pageBehavior?: CalendarPageBehavior;
  /** Whether nothing responds and the values are not submitted. */
  disabled?: boolean;
  /** Whether the range cannot change. */
  readOnly?: boolean;
  /** Whether an empty or incomplete end is invalid. */
  required?: boolean;
  /** Whether the picker shows as invalid whatever its value. */
  invalid?: boolean;
  /** The name the start's ISO value submits and `Form` errors arrive under. */
  startName?: string;
  /** The name the end's ISO value submits and `Form` errors arrive under. */
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
  /** The label, group, error, description and popup. */
  children?: ReactNode;
};

/** The Root its prop errors name. */
const OWNER = "DateRangePicker.Root";

/** Which of the Label, Description and Error a Root renders, and whether the Error has its own text. */
type RangePartScan = {
  readonly label: boolean;
  readonly description: boolean;
  readonly error: boolean;
  readonly errorText: boolean;
};

/**
 * Which parts a Root's children render, read during render from the element tree the Root is given,
 * so the server writes the same names and descriptions as the client. The scan looks only through
 * host elements and fragments, which render their children as given: a component decides what it
 * renders (a `Show` with `when={false}` renders nothing), so the scan stops at every component,
 * nested Roots included, and a part inside one registers after mount instead.
 */
function scanRangeParts(children: ReactNode): RangePartScan {
  const found = { label: false, description: false, error: false, errorText: false };
  const visit = (node: ReactNode): void => {
    Children.forEach(node, (child) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) {
        return;
      }
      if (child.type === DateRangePickerLabel) found.label = true;
      if (child.type === DateRangePickerDescription) found.description = true;
      if (child.type === DateRangePickerError) {
        found.error = true;
        found.errorText ||= isRenderableNode(child.props.children);
      }
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- React's element type is a tag name for a host element; that is the contract the scan reads.
      if (typeof child.type === "string" || child.type === Fragment) {
        visit(child.props.children);
      }
    });
  };
  visit(children);
  return found;
}

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
 * Its parts are `Label`, `Group`, `StartInput`, `Separator`, `EndInput`, `Trigger`, `Error`,
 * `Description`, `Popup`, `Calendar`, `StartTimeInput` and `EndTimeInput` (each end's time in the
 * popup) and the preset pane (`Presets`, `PresetItem`).
 *
 * Each input is a Base UI Field of its own, under `startName` and `endName`: a `Form` reads both ISO
 * values, holds errors under either name and focuses the input whose error it returns. The label,
 * the description and the merged error live on the Root, outside those two Fields, and the Root
 * wires them to both inputs and the group. An end before its start is invalid on the end ("Start
 * date must be before end date."), as React Aria reports it.
 *
 * Values are Temporal values, as DatePicker's. Picking a range in the calendar keeps each end's
 * time and zone.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The ends' kind, inferred as `DateInput.Root`'s is.
 * @throws TypeError naming the prop and the fix when a value or bound is a string rather than a
 *   Temporal object, or a time `granularity` meets a PlainDate value: host defects.
 */
export function DateRangePickerRoot<P = object, T extends DateInputValue = PropsMadeValue<P>>(
  props: DateRangePickerRootProps<T> & KindProps<P, DateRangePickerRootProps<DateInputValue>>
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
  } = props;
  const controlled = valueProp !== undefined;
  const parsedValue = useRangeProp(valueProp, OWNER, "value");
  const parsedDefault = useRangeProp(defaultValue, OWNER, "defaultValue");
  const [own, setOwn] = useState<Ends | null>(parsedDefault);
  const committed: Ends = (controlled ? parsedValue : own) ?? EMPTY_ENDS;
  const committedKey = rangeKey(committed);
  // SAFETY: the picker checks values of its resolved kind, which is `T`'s.
  const unavailable = isDateUnavailable as ((value: TemporalValue) => boolean) | undefined;

  // The calendar's view follows a range set from anywhere but the calendar itself.
  const [viewKey, markPicked] = useCalendarViewKey(committedKey);
  // Worked out before the session, so a commit it makes while the popup closes reads this render's.
  const rules = usePickerRules(OWNER, minValue, maxValue, unavailable);

  // What committing a range reads, published before the session's effects run, so a commit the
  // session makes while the popup closes reaches this render's `onValueChange`, not the last one's.
  const publishedDeps = { committed, onValueChange, controlled, parsedDefault };
  const commitDeps = useRef(publishedDeps);
  useLayoutEffect(() => {
    commitDeps.current = publishedDeps;
  });

  // The preset panes, told when the range is committed by anything but a preset press.
  const presetPanes = usePresetRegistry();

  /** Report a whole range, or `null` for one that lost an end, and apply it unless canceled. */
  function commitRange(
    range: { readonly start: TemporalValue; readonly end: TemporalValue } | null,
    reason: DateRangePickerValueChangeReason,
    event: Event,
    trigger: Element | undefined
  ): boolean {
    const deps = commitDeps.current;
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
    deps.onValueChange?.(range as DateRangePickerValue<T> | null, details);
    if (details.isCanceled) {
      return false;
    }
    if (!deps.controlled) {
      setOwn(range);
    }
    commitDeps.current = { ...deps, committed: range ?? EMPTY_ENDS };
    if (reason !== "preset-press") {
      presetPanes.valueCommitted();
    }
    return true;
  }

  const session = usePickerSession<RangeDraft, RangeHeldReason>({
    open: openProp,
    defaultOpen,
    onOpenChange,
    basis: committedKey,
    // A range the close finalizes is always whole; an end picked without a time takes midnight.
    // Called after this render has resolved `kind`.
    finalize(held, origin) {
      const range = wholeRange(held, kind);
      if (range === null) {
        return true;
      }
      if (!commitRange(range, origin.reason, origin.event, origin.trigger)) {
        return false;
      }
      // The calendar made this range: a close the parent cancels keeps it mounted under focus.
      markPicked(rangeKey(range));
      return true;
    },
    onReset() {
      if (!commitDeps.current.controlled) {
        setOwn(commitDeps.current.parsedDefault);
      }
      presetPanes.valueCommitted();
    },
  });
  const { generation, hold, release, held } = session;
  // What the picker holds before it commits (`range-draft.ts`): half a range the inputs hold, a
  // range picked in an empty time picker that stays open, or times typed in the popup waiting for
  // days. Without one, the committed range is the draft.
  const committedDraft = useMemo(() => draftOfRange(committed), [committed]);
  const draft = held?.value ?? committedDraft;

  const [messagesOf, setMessagesOf] = useState<Readonly<Record<Endpoint, EndpointMessages>>>({
    start: NO_MESSAGES,
    end: NO_MESSAGES,
  });
  const [inputInvalid, setInputInvalid] = useState({ start: false, end: false });
  // Which of the Label, Description and Error render: read from the children during render, so the
  // server writes whole names and descriptions; a part out of the scan's sight registers on mount.
  const scanned = scanRangeParts(children);
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
  const hasLabel = scanned.label || registered.has("label");
  const hasDescription = scanned.description || registered.has("description");
  const errorShown =
    (scanned.error && invalid && (scanned.errorText || messages.length > 0)) || registered.has("error");

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const descriptionId = `${baseId}-description`;
  const errorId = `${baseId}-error`;
  const nameId = `${baseId}-name`;
  const describedBy =
    [hasDescription ? descriptionId : undefined, errorShown ? errorId : undefined]
      .filter((id) => id !== undefined)
      .join(" ") || undefined;

  // An end's kind is the picker's: the start's, or the end's while the start is empty. The inputs
  // warn of a kind change, so the picker does not warn again.
  const resolvedKind = useValueKind(
    {
      value: kindWitnessOf(draft),
      defaultValue: parsedDefault?.start ?? parsedDefault?.end ?? null,
      granularity,
      timeZone,
    },
    OWNER
  );
  const { kind } = resolvedKind;
  // A preset's range replaces whatever the inputs or the calendar held.
  const readPreset = usePresetReader(presetRange, kind, (range: DatePickerPresetRange, event, trigger) => {
    if (!commitRange(range, "preset-press", event, trigger)) {
      return false;
    }
    release();
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
    labelledBy: hasLabel ? labelId : undefined,
    describedBy,
    invalid,
    range: true,
    registerPresets,
    readPreset,
  });
  // What a gesture reads: this render's draft and the close origin it was held with, which a
  // gesture earlier in the same event updates through `publish`.
  const published = { draft, origin: held?.finalizeOnClose ?? null, shouldCloseOnSelect };
  const latest = useRef(published);
  useLayoutEffect(() => {
    latest.current = published;
  });

  /** Publish a draft a gesture made to the gestures that follow, before the Root renders it. */
  function publish(next: RangeDraft, origin: PickerHeldOrigin<RangeHeldReason> | null): void {
    latest.current = { ...latest.current, draft: next, origin };
  }

  /** Hold a draft, and publish it. */
  function holdDraft(
    next: RangeDraft,
    origin: PickerHeldOrigin<RangeHeldReason> | null,
    basis?: string
  ): void {
    hold(next, origin, basis);
    publish(next, origin);
  }

  /**
   * Apply a draft a gesture made: a whole range commits, and so does a whole range that just lost
   * an end, as `null`, which React Aria reports too; a range filled one end at a time reports
   * nothing until it is whole, and the draft is held over the empty range meanwhile. The committed
   * range is whole or empty.
   *
   * @returns The whole range it committed, `null` for a draft that is not whole, or `"canceled"`
   *   when the commit was canceled.
   */
  function apply(
    next: RangeDraft,
    reason: DateRangePickerValueChangeReason,
    event: Event,
    trigger: Element | undefined
  ): WholeRange | null | "canceled" {
    const range = wholeRange(next, kind);
    const reports = range !== null || commitDeps.current.committed.start !== null;
    if (reports && !commitRange(range, reason, event, trigger)) {
      return "canceled";
    }
    if (range === null) {
      holdDraft(next, null, rangeKey(EMPTY_ENDS));
    } else {
      release();
      publish(draftOfRange(range), null);
    }
    return range;
  }

  const inputChange = useStableCallback(
    (endpoint: Endpoint, next: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      const edited = editInput(latest.current.draft, endpoint, next);
      if (apply(edited, details.reason, details.event, details.trigger) === "canceled") {
        details.cancel();
      }
    }
  );
  const selectRange = useStableCallback(
    (range: RangeCalendarValue, details: RangeCalendarRootValueChangeEventDetails) => {
      const state = latest.current;
      // Each end keeps its time: its value's, the one typed in the popup, or midnight.
      const next = pickRange(state.draft, range, kind);
      const { committed: current } = commitDeps.current;
      if (
        kind.kind !== "PlainDate" &&
        current.start === null &&
        current.end === null &&
        awaitsTime(next) &&
        !state.shouldCloseOnSelect
      ) {
        // As the single picker's day: an empty time range is held until both ends have a time
        // typed in the popup, or until the popup closes.
        holdDraft(next, { reason: details.reason, event: details.event, trigger: details.trigger });
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
      if (state.shouldCloseOnSelect && (details.reason === "day-press" || details.reason === "keyboard")) {
        root.requestOpen(false, details.reason, details.event, details.trigger);
      }
    }
  );

  const timeChange = useStableCallback(
    (endpoint: Endpoint, time: TemporalValue | null, details: DateInputValueChangeEventDetails) => {
      // A range the calendar holds keeps closing commits it until both ends have their time.
      const { draft: current, origin } = latest.current;
      if (time === null) {
        // A value keeps its own time, which the input shows again; anything else forgets it.
        const cleared = clearTime(current, endpoint);
        if (cleared === undefined) {
          details.cancel();
        } else if (cleared !== current) {
          holdDraft(cleared, origin);
        }
        return;
      }
      const next = editTime(current, endpoint, time, kind);
      if (awaitsTime(next)) {
        holdDraft(next, origin);
        return;
      }
      const applied = apply(next, details.reason, details.event, details.trigger);
      if (applied === "canceled") {
        details.cancel();
        return;
      }
      // The popup made this range: the calendar under it stays mounted on its months.
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
      calendarKey: `${generation}:${viewKey}`,
      generation,
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
      viewKey,
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
