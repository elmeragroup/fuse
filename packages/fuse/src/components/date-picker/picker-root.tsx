"use client";

// What both picker Roots build around their own value model: the rules their values follow, the
// disabled state, the focus boundary and open request, the settings their Input and Calendar parts
// forward, the shell context, and the Root element with its providers. Each Root keeps only what
// differs: how it parses, holds and commits its value, and which values its kind resolves from.

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { FocusEvent, ReactElement, ReactNode, RefObject } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useStableCallback } from "../../hooks/use-stable-callback";
import { definedProps } from "../../internal/defined-props";
import { useFieldDisabled } from "../../internal/field-set-disabled";
import type { Bounds } from "../../temporal/bounds";
import type { DateGranularity, ResolvedKind, TemporalValue, ValueKind } from "../../temporal/temporal-value";
import type { CalendarRootProps } from "../calendar/calendar";
import type { CalendarPageBehavior } from "../calendar/calendar-dates";
import { useTemporalProp } from "../calendar/calendar-input";
import type { CalendarFirstDayOfWeek } from "../calendar/calendar-input";
import type { DateInputRootProps, DateInputValue } from "../date-field/date-input";
import type { DateInputRules } from "../date-field/date-input-validation";
import type { DatePickerPresetValue, PickerOpenRequest, PickerPresetReader } from "./picker-change-details";
import { stateClassName } from "./picker-class-name";
import type { DatePickerClassName } from "./picker-class-name";
import { usePickerFocusBoundary, usePickerOpener } from "./picker-focus-boundary";
import { PICKER_STATE_ATTRIBUTES, PickerPopoverRoot, PickerShellContext } from "./picker-shell";
import type { PickerShellContextValue, PickerState, PresetRegistration } from "./picker-shell";
import { kindWitness, useDayUnavailable } from "./picker-value";
import type { PickerOwner } from "./picker-value";
import type { PickerSession } from "./use-picker-session";

/** The DateInput props a picker Root owns, which its Input parts do not take. */
type PickerOwnedInputProp =
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "minValue"
  | "maxValue"
  | "isDateUnavailable"
  | "granularity"
  | "hourCycle"
  | "hideTimeZone"
  | "timeZone"
  | "disabled"
  | "readOnly"
  | "required"
  | "invalid"
  | "name"
  | "form"
  | "size"
  | "render";

/**
 * A picker's Input part takes `DateInput.Root`'s presentation props; the value, bounds, time
 * options and state come from its Root.
 */
export type PickerInputPartProps = Omit<DateInputRootProps, PickerOwnedInputProp>;

/** The Calendar props a picker Root owns, which its Calendar parts do not take. */
export type PickerOwnedCalendarProp =
  | "className"
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "minValue"
  | "maxValue"
  | "isDateUnavailable"
  | "disabled"
  | "readOnly"
  | "firstDayOfWeek"
  | "visibleMonths"
  | "pageBehavior";

/** What every Input part of a picker hands its `DateInput.Root` from the Root. */
export type PickerInputSettings = Pick<
  DateInputRootProps<DateInputValue>,
  | "minValue"
  | "maxValue"
  | "isDateUnavailable"
  | "granularity"
  | "hourCycle"
  | "timeZone"
  | "defaultValue"
  | "form"
  | "hideTimeZone"
  | "disabled"
  | "readOnly"
  | "required"
  | "size"
>;

/**
 * What a picker's time inputs hand their time-only `DateInput.Root` from the Root: the time
 * options and state, never the bounds, the requirement or a name, which belong to the picker's own
 * input, nor a zone or a default value: each time input's kind comes from its binding (`endKind`).
 */
export type PickerTimeSettings = Pick<
  PickerInputSettings,
  "granularity" | "hourCycle" | "hideTimeZone" | "disabled" | "readOnly" | "size"
>;

/** What every Calendar part of a picker hands its calendar Root from the Root. */
export type PickerCalendarSettings = Pick<
  CalendarRootProps,
  | "minValue"
  | "maxValue"
  | "isDateUnavailable"
  | "firstDayOfWeek"
  | "visibleMonths"
  | "pageBehavior"
  | "disabled"
  | "readOnly"
>;

/** The Root props both pickers take with the same meaning, beside the rules. */
export type PickerRootSharedProps = {
  readonly granularity: DateGranularity | undefined;
  readonly hourCycle: 12 | 24 | undefined;
  readonly hideTimeZone: boolean;
  readonly timeZone: string | undefined;
  readonly firstDayOfWeek: CalendarFirstDayOfWeek | undefined;
  readonly visibleMonths: number;
  readonly pageBehavior: CalendarPageBehavior;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly form: string | undefined;
  readonly size: "default" | "sm";
  readonly ariaLabel: string | undefined;
  /** Called with the `blur` that started the leave, as the Roots' `onFocusLeave` documents. */
  readonly onFocusLeave: ((event: FocusEvent<Element>) => void) | undefined;
};

/**
 * The bounds and unavailable check a picker's values are validated against, the bounds parsed once
 * per printed value. A Root works them out before its session, so a commit the session makes while
 * the popup closes checks this render's rules.
 *
 * @param owner - The Root, named in a parse error.
 * @param minValue - The Root's `minValue`.
 * @param maxValue - The Root's `maxValue`.
 * @param isDateUnavailable - The Root's `isDateUnavailable`.
 * @returns The rules, one object while the bounds' printed values and the check hold.
 * @throws TypeError naming the prop and the fix when a bound is a string, a host defect.
 */
export function usePickerRules(
  owner: PickerOwner,
  minValue: TemporalValue | undefined,
  maxValue: TemporalValue | undefined,
  isDateUnavailable: ((value: TemporalValue) => boolean) | undefined
): DateInputRules {
  const min = useTemporalProp(minValue, owner, "minValue") ?? undefined;
  const max = useTemporalProp(maxValue, owner, "maxValue") ?? undefined;
  const bounds = useMemo((): Bounds => ({ min, max }), [min, max]);
  return useMemo((): DateInputRules => ({ bounds, isDateUnavailable }), [bounds, isDateUnavailable]);
}

/**
 * A Root's preset reader, whose identity contract both Roots share: it reads a preset's `dateValue`
 * for the picker's kind while the preset renders, as the Root reads its own value props, and binds
 * the Root's commit with the reason `"preset-press"`. It keeps one identity while the kind does, so
 * a preset rebinds only when the kind changes; the commit it calls is always the Root's latest.
 *
 * @param read - Reads a `dateValue` as the Root's value for a kind; a module function.
 * @param kind - The picker's kind.
 * @param commit - Commits a read value; returns whether it applied.
 * @returns The reader the shell context hands the presets.
 */
export function usePresetReader<V>(
  read: (preset: DatePickerPresetValue, kind: ValueKind) => V,
  kind: ValueKind,
  commit: (value: V, event: Event, trigger: Element) => boolean
): PickerPresetReader {
  const commitPreset = useStableCallback(commit);
  return useCallback(
    (preset: DatePickerPresetValue) => {
      const value = read(preset, kind);
      return (event: Event, trigger: Element) => commitPreset(value, event, trigger);
    },
    [read, kind, commitPreset]
  );
}

/** What `usePickerRoot` takes from a Root. */
export type PickerRootOptions = {
  readonly props: PickerRootSharedProps;
  /** The Root's rules, from `usePickerRules`. */
  readonly rules: DateInputRules;
  /** The kind the picker's values take, from `useValueKind`. */
  readonly kind: ResolvedKind;
  /** The Root's session, whose open request the boundary wraps. */
  readonly session: Pick<PickerSession<unknown, string>, "open" | "requestOpen">;
  /** The ids that label the picker: its visible label, or `undefined`. */
  readonly labelledBy: string | undefined;
  /** The ids that describe the picker. */
  readonly describedBy: string | undefined;
  /** Whether the picker shows as invalid. */
  readonly invalid: boolean;
  /** Whether the picker is a range picker. */
  readonly range: boolean;
  /** The Root's preset registration. */
  readonly registerPresets: PresetRegistration;
  /** Reads a preset's `dateValue` for the Root's kind; new only when that kind changes. */
  readonly readPreset: PickerPresetReader;
};

/** What `usePickerRoot` gives a Root. */
export type PickerRoot = {
  /** Whether the picker is disabled: its prop, an enclosing Field or `Field.Set`. */
  readonly disabled: boolean;
  /** The open request, remembering the segment focus opens the popup from. */
  readonly requestOpen: PickerOpenRequest;
  /** What each Input part forwards to its `DateInput.Root`. */
  readonly inputSettings: PickerInputSettings;
  /** What each time input forwards, or `null` while the picker's values have no time to show. */
  readonly timeSettings: PickerTimeSettings | null;
  /** What each Calendar part forwards to its calendar Root. */
  readonly calendarSettings: PickerCalendarSettings;
  /** The context the shared parts read. */
  readonly shell: PickerShellContextValue;
  /** The state the Root shares with its `render` callback. */
  readonly state: PickerState;
  /** The Root element's focus and blur handlers: the focus boundary. */
  readonly boundary: {
    readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
    readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  };
};

/**
 * The scaffolding both picker Roots share: the disabled state, the focus boundary and open
 * request, the Input and Calendar settings and the shell context, each memoized on what it reads,
 * so a Root render that changes none of them re-renders no part.
 *
 * @param options - The Root's props and what it worked out itself.
 * @returns The shared state.
 */
export function usePickerRoot(options: PickerRootOptions): PickerRoot {
  const { props, rules, kind, session, labelledBy, describedBy, invalid, range, registerPresets } = options;
  const { readPreset } = options;
  const { granularity, hourCycle, hideTimeZone, timeZone, firstDayOfWeek, visibleMonths } = props;
  const { pageBehavior, readOnly, required, form, size, ariaLabel } = props;
  // The parsed bounds, which keep their identity while their printed values hold.
  const { min: minValue, max: maxValue } = rules.bounds;
  const { isDateUnavailable } = rules;
  const dayUnavailable = useDayUnavailable(isDateUnavailable, kind.kind);
  // `useValueKind` keeps the resolved kind's identity while it holds, so the witness keeps its own.
  const witness = useMemo(() => kindWitness(kind), [kind]);
  const disabled = useFieldDisabled(props.disabled);

  const { open } = session;
  const triggerId = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const focus = usePickerFocusBoundary(popupRef, props.onFocusLeave);
  const { registerInputBoundary, containsInput, adjacentInput } = focus;
  const { withOpener, openerRef } = usePickerOpener(containsInput, open);
  const requestOpen = useMemo(() => withOpener(session.requestOpen), [withOpener, session.requestOpen]);

  const inputSettings = useMemo(
    (): PickerInputSettings => ({
      ...definedProps({
        minValue,
        maxValue,
        isDateUnavailable,
        granularity,
        hourCycle,
        timeZone,
        // Keeps a kind a value named in an input a reset remounts while the value is empty.
        defaultValue: witness,
        form,
      }),
      hideTimeZone,
      disabled,
      readOnly,
      required,
      size,
    }),
    [
      minValue,
      maxValue,
      isDateUnavailable,
      granularity,
      hourCycle,
      timeZone,
      witness,
      form,
      hideTimeZone,
      disabled,
      readOnly,
      required,
      size,
    ]
  );
  // A time input shows while the picker's values have a time and its granularity shows one.
  const showsTime = kind.kind.kind !== "PlainDate" && granularity !== "day";
  const timeSettings = useMemo(
    (): PickerTimeSettings | null =>
      showsTime
        ? {
            // No zone or kind witness: each time input's kind is its binding's (`endKind`).
            ...definedProps({ granularity, hourCycle }),
            hideTimeZone,
            disabled,
            readOnly,
            size,
          }
        : null,
    [showsTime, granularity, hourCycle, hideTimeZone, disabled, readOnly, size]
  );
  const calendarSettings = useMemo(
    (): PickerCalendarSettings => ({
      ...definedProps({ minValue, maxValue, isDateUnavailable: dayUnavailable, firstDayOfWeek }),
      visibleMonths,
      pageBehavior,
      disabled,
      readOnly,
    }),
    [minValue, maxValue, dayUnavailable, firstDayOfWeek, visibleMonths, pageBehavior, disabled, readOnly]
  );
  const shell = useMemo(
    (): PickerShellContextValue => ({
      open,
      requestOpen,
      triggerId,
      labelledBy,
      ariaLabel,
      describedBy,
      disabled,
      readOnly,
      invalid,
      size,
      popupRef,
      registerPresets,
      readPreset,
      range,
      registerInputBoundary,
      containsInput,
      adjacentInput,
      openerRef,
    }),
    [
      open,
      requestOpen,
      triggerId,
      labelledBy,
      ariaLabel,
      describedBy,
      disabled,
      readOnly,
      invalid,
      size,
      registerPresets,
      readPreset,
      range,
      registerInputBoundary,
      containsInput,
      adjacentInput,
      openerRef,
    ]
  );
  const state = useMemo(
    (): PickerState => ({ open, disabled, readonly: readOnly, invalid }),
    [open, disabled, readOnly, invalid]
  );
  return {
    disabled,
    requestOpen,
    inputSettings,
    timeSettings,
    calendarSettings,
    shell,
    state,
    boundary: { onFocus: focus.onFocus, onBlur: focus.onBlur },
  };
}

/** The `div` props a picker Root hands its element: all but those the Root reads itself. */
export type PickerRootElementProps = Omit<
  useRender.ComponentProps<"div", PickerState>,
  "render" | "className" | "children" | "defaultValue" | "onChange"
>;

/** What `usePickerRootElement` renders. */
export type PickerRootElementOptions = {
  readonly root: PickerRoot;
  readonly slot: "date-picker" | "date-range-picker";
  readonly className: DatePickerClassName<PickerState> | undefined;
  /** The Root's own classes. */
  readonly classes: string;
  readonly render: useRender.ComponentProps<"div", PickerState>["render"];
  /** The consumer's other element props. */
  readonly elementProps: PickerRootElementProps;
  readonly children: ReactNode;
  /** Children the Root adds after the consumer's. */
  readonly extra?: ReactNode;
  /** The hidden input the session's form reset listens through. */
  readonly resetRef: RefObject<HTMLInputElement | null>;
};

/**
 * A picker Root's element inside the shell's providers: the consumer's children, then the Root's
 * own, then the hidden input that tells the session its form was reset.
 *
 * @param options - The shared state and the Root's element props.
 * @returns The element.
 */
export function usePickerRootElement(options: PickerRootElementOptions): ReactElement {
  const { root, slot, className, classes, render, elementProps, children, extra, resetRef } = options;
  const element = useRender({
    defaultTagName: "div",
    render,
    state: root.state,
    stateAttributesMapping: PICKER_STATE_ATTRIBUTES,
    props: {
      "data-slot": slot,
      ...mergeProps<"div">(
        {
          className: stateClassName(className, root.state, classes),
          onFocus: root.boundary.onFocus,
          onBlur: root.boundary.onBlur,
          children: (
            <>
              {children}
              {extra}
              {/* Tells the picker its form was reset; it submits nothing. */}
              <input ref={resetRef} type="hidden" form={root.inputSettings.form} />
            </>
          ),
        },
        definedProps(elementProps)
      ),
    },
  });
  return (
    <PickerShellContext value={root.shell}>
      <PickerPopoverRoot open={root.shell.open} requestOpen={root.requestOpen}>
        {element}
      </PickerPopoverRoot>
    </PickerShellContext>
  );
}

/**
 * The calendar's view key. Calendar keeps its view when its controlled value changes, so a value
 * that came from anywhere but the calendar itself (typing, a preset the parent maps to a value)
 * changes the key and the calendar remounts on it, so the calendar shows the new value's month. A
 * value the calendar made is marked as picked first and keeps the key, so the calendar under focus
 * stays.
 *
 * @param basis - The committed value's key.
 * @returns `[key, markPicked]`, where `markPicked` takes the key of a value the calendar made.
 */
export function useCalendarViewKey(basis: string): readonly [number, (picked: string) => void] {
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState({ basis, key: 0 });
  if (view.basis !== basis) {
    setView({ basis, key: basis === picked ? view.key : view.key + 1 });
  }
  return [view.key, setPicked] as const;
}
