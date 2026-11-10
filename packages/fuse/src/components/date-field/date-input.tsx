"use client";

import {
  Fragment,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useFormReset } from "../../hooks/use-form-reset";
import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { isElement, isNode } from "../../internal/dom-node";
import { displayNames } from "../../internal/intl-cache";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import type { Bounds } from "../../temporal/bounds";
import { temporal } from "../../temporal/temporal";
import type {
  DateGranularity,
  KindProps,
  PropsMadeValue,
  TemporalValue,
} from "../../temporal/temporal-value";
import { today } from "../../temporal/today";
import { createChangeEventDetails } from "../calendar/calendar-change-details";
import { useTemporalProp } from "../calendar/calendar-input";
import { createCalendarStore } from "../calendar/calendar-store";
import { draftOf, editableSegments, placeholderValue } from "./date-draft";
import {
  EMPTY_ZONE_INSTANT,
  dayPeriodNames,
  describeValue,
  fieldSegments,
  formatInstant,
  resolveHourCycle,
} from "./date-field-format";
import type { FieldFormat } from "./date-field-format";
import { DateInputRootContext, SEGMENT_SELECTOR } from "./date-input-context";
import type { DateInputActions, DateInputRootContextValue } from "./date-input-context";
import { useDateInputField } from "./date-input-field";
import { DateInputSegment } from "./date-input-segment";
import {
  basisOf,
  canceled,
  confirm,
  draftOver,
  entryOf,
  erase,
  focusEntered,
  initialSession,
  paste,
  rebase,
  resetSession,
  segmentFocused,
  step,
  toEdge,
  typeKey,
} from "./date-input-session";
import type { SessionSettings, SessionState, SessionTransition } from "./date-input-session";
import type { DateInputRootProps, DateInputRootState, DateInputValue } from "./date-input-types";
import { entryError, errorMessage, valueError } from "./date-input-validation";
import type { DateInputRules } from "./date-input-validation";
import { dateInputVariants } from "./date-input-variants";
import { dateFieldStrings } from "./intl";
import { useValueKind } from "./use-value-kind";

export { DateInputSegment } from "./date-input-segment";
export type {
  DateInputRootProps,
  DateInputRootState,
  DateInputSegmentData,
  DateInputSegmentProps,
  DateInputSegmentState,
  DateInputSegmentType,
  DateInputValue,
} from "./date-input-types";

/** The part diagnostics name. */
const OWNER = "DateInput.Root";

/** React Aria's page steps: Page Up and Page Down move a segment this far. */
const PAGE_STEP = {
  year: 5,
  month: 2,
  day: 7,
  hour: 2,
  minute: 15,
  second: 15,
  dayPeriod: 1,
} as const;

// iOS VoiceOver cannot focus a spinbutton, so the segments are textboxes there, as React Aria's
// are, detected as React Aria's `isIOS` does: an iPhone, iPad or iPod platform, or a Mac platform
// with touch, which is how iPadOS reports itself. The platform is read after hydration: the server
// and the hydrating render write spinbuttons.
function isIOS(): boolean {
  const { platform, maxTouchPoints } = navigator;
  return /^iP(?:hone|ad|od)/u.test(platform) || (platform.startsWith("Mac") && maxTouchPoints > 1);
}
const noSubscription = (): (() => void) => () => undefined;
function useIsIOS(): boolean {
  return useSyncExternalStore(noSubscription, isIOS, () => false);
}

/** Focus the last segment before `target`, then back over empty ones, as React Aria's field press. */
function focusBefore(root: Element, target: EventTarget): void {
  const list = [...root.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR)];
  const before =
    isNode(target) && target !== root
      ? list.filter(
          (element) => (element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        )
      : list;
  let index = (before.length > 0 ? before : list).length - 1;
  while (
    index > 0 &&
    list[index]?.hasAttribute("data-placeholder") === true &&
    list[index - 1]?.hasAttribute("data-placeholder") === true
  ) {
    index -= 1;
  }
  list[index]?.focus();
}

/** Focus the segment `step` places from `from` among the Root's focusable segments. */
function focusSibling(root: Element | null, from: Element, direction: "next" | "previous"): void {
  const list = [...(root?.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR) ?? [])];
  const index = list.findIndex((element) => element === from);
  if (index >= 0) {
    list[index + (direction === "next" ? 1 : -1)]?.focus();
  }
}

/** The transition a key makes on a segment, or `undefined` for a key the segment leaves alone. */
function keyTransition(
  key: string,
  type: keyof typeof PAGE_STEP,
  page: number,
  settings: SessionSettings,
  state: SessionState
): SessionTransition | undefined {
  switch (key) {
    case "ArrowUp":
      return step(state, type, 1, settings);
    case "ArrowDown":
      return step(state, type, -1, settings);
    case "PageUp":
      return step(state, type, page, settings);
    case "PageDown":
      return step(state, type, -page, settings);
    case "Home":
      return toEdge(state, type, "min", settings);
    case "End":
      return toEdge(state, type, "max", settings);
    default:
      return undefined;
  }
}

const ROOT_STATE_ATTRIBUTES = {
  invalid: (value: boolean) => (value ? { "data-invalid": "true" } : null),
};

/**
 * A date, date-time or zoned date-time edited in segments: one per unit, in the locale's order,
 * with the locale's literals between them. Typing fills a segment and moves on, arrow keys step
 * it, Backspace clears it; the value commits once every segment is filled. It is a `group` named
 * by its Field's label, `aria-label` or `aria-labelledby`, and each segment's name starts with its
 * unit: "month, Start date".
 *
 * Inside a Base UI Field (`Field.Root`, Fuse's `Field` or a labeled composite) the first editable
 * segment is the Field's control: a `Form` focuses it for an error, its value reaches
 * `onFormSubmit` as ISO text, and its validity (missing, incomplete, out of bounds, unavailable)
 * is the Field's, committed on blur and on submit. A visually hidden text input submits the ISO
 * value under `name` in a native form.
 *
 * Values are Temporal values; it reads `globalThis.Temporal`, so a host without native Temporal
 * imports `@elmeragroup/fuse/temporal-polyfill` once. It never reads the clock while rendering:
 * today fills an empty segment only when the user steps it.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The value's kind, inferred: the kind `value` or `defaultValue` names, and without
 *   either the kind `granularity` and `timeZone` make, as the runtime resolves it.
 * @throws TypeError naming the prop and the fix when `value`, `defaultValue`, `minValue` or
 *   `maxValue` is a string rather than a Temporal object, or when a time `granularity` meets a
 *   PlainDate value: host defects.
 */
export function DateInputRoot<P = object, T extends DateInputValue = PropsMadeValue<P>>(
  props: DateInputRootProps<T> & KindProps<P, DateInputRootProps<DateInputValue>>
): ReactElement {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    minValue,
    maxValue,
    isDateUnavailable,
    granularity: granularityProp,
    hourCycle: hourCycleProp,
    hideTimeZone = false,
    timeZone: timeZoneProp,
    shouldForceLeadingZeros = false,
    disabled: disabledProp = false,
    readOnly = false,
    required = false,
    invalid: invalidProp = false,
    name: nameProp,
    form,
    size = "default",
    children,
    className,
    render,
    ref,
    // The group's name and description name each segment too, and its description joins the
    // Field's; see `labelledBy` and `describedBy`.
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    ...elementProps
  } = props;
  const { locale, timeZone: localeTimeZone } = useLocale();
  const strings = useLocalizedStrings(dateFieldStrings);
  const ios = useIsIOS();
  const controlled = valueProp !== undefined;

  const parsedValue = useTemporalProp(valueProp, OWNER, "value");
  const parsedDefault = useTemporalProp(defaultValue, OWNER, "defaultValue");
  const minBound = useTemporalProp(minValue, OWNER, "minValue") ?? undefined;
  const maxBound = useTemporalProp(maxValue, OWNER, "maxValue") ?? undefined;

  const hourCycle = resolveHourCycle(locale, hourCycleProp);
  // The edit session's one store: every gesture is a transition of it (`date-input-session.ts`).
  // The segments are not known yet, so the first session holds no draft and no basis: the rebase
  // below sets it before any gesture reads it.
  const [store] = useState(() => createCalendarStore(initialSession(parsedDefault, "")));
  const session = useSyncExternalStore(store.subscribe, store.get, () => store.initial);
  const committed = controlled ? parsedValue : session.own;

  // A kind a value or default value named sticks, so emptying a zoned input and typing again emits
  // a zoned value; one the granularity and zone made follows them (`useValueKind`).
  const { kind } = useValueKind(
    { value: committed, defaultValue: parsedDefault, granularity: granularityProp, timeZone: timeZoneProp },
    OWNER,
    { warnOnKindChange: true }
  );

  const granularity: DateGranularity = granularityProp ?? (kind.kind === "PlainDate" ? "day" : "minute");
  const zone = kind.kind === "ZonedDateTime" ? kind.timeZone : undefined;
  const format = useMemo(
    (): FieldFormat => ({
      locale,
      granularity,
      hourCycle,
      forceLeadingZeros: shouldForceLeadingZeros,
      timeZone: zone,
      hideTimeZone,
    }),
    [locale, granularity, hourCycle, shouldForceLeadingZeros, zone, hideTimeZone]
  );
  const fields = useMemo(() => editableSegments(granularity, hourCycle), [granularity, hourCycle]);

  // The key of the committed value and the segments shown, which a draft belongs to.
  const basis = basisOf(committed, hourCycle, fields);
  const valueDraft = useMemo(() => draftOf(committed, hourCycle), [committed, hourCycle]);
  const draft = draftOver(session, basis) ?? valueDraft;

  const bounds = useMemo((): Bounds => ({ min: minBound, max: maxBound }), [minBound, maxBound]);
  const rules = useMemo(
    (): DateInputRules => ({
      bounds,
      // SAFETY: the input emits and checks values of its resolved kind, which is `T`'s; a host
      // passing another kind gets `useValueKind`'s development warning.
      isDateUnavailable: isDateUnavailable as ((value: TemporalValue) => boolean) | undefined,
    }),
    [bounds, isDateUnavailable]
  );
  const entry = entryOf(session, committed, basis);
  const currentError = entryError(entry, required, rules);
  const message = currentError === null ? "" : errorMessage(currentError, strings, format, bounds);
  const iso = committed === null ? "" : committed.toString();

  const rootRef = useRef<HTMLDivElement>(null);
  // The first editable segment, read when a Form or the hidden input focuses it.
  const firstSegment = useMemo(
    () => ({
      get current(): HTMLElement | null {
        return rootRef.current?.querySelector<HTMLElement>(SEGMENT_SELECTOR) ?? null;
      },
    }),
    []
  );
  const fallbackId = useId();
  const field = useDateInputField(
    {
      name: nameProp,
      disabled: disabledProp,
      invalid: invalidProp,
      iso,
      error: currentError,
      message,
      firstSegment,
    },
    fallbackId
  );
  // Read apart: the hidden input's ref is a ref, the rest are render values.
  const { disabled, invalid, hiddenInput, hiddenInputId, labelId, setFocused, blurred, revalidate } = field;

  // A new committed value, hour cycle or set of segments drops any draft typed over the old ones,
  // for good. A dropped draft no longer counts as incomplete, so an error it showed is checked again;
  // a change of value does that by itself, but a granularity change alone does not.
  useLayoutEffect(() => {
    const before = store.get();
    const after = rebase(before, basis);
    store.set(after);
    if (before.draft !== null && after.draft === null) {
      revalidate();
    }
  }, [store, basis, revalidate]);

  const segments = useMemo(
    () => fieldSegments(format, draft, committed === null ? EMPTY_ZONE_INSTANT : formatInstant(committed)),
    [format, draft, committed]
  );
  const firstEditableIndex = segments.find((segment) => segment.type !== "literal")?.index ?? -1;
  const placeholderZone = zone ?? localeTimeZone;

  // The settings a transition reads. The edit state itself is the store's, read synchronously.
  const settings = useMemo(
    (): SessionSettings => ({
      committed,
      controlled,
      editable: !disabled && !readOnly,
      fields,
      hourCycle,
      kind,
      dayPeriods: dayPeriodNames(locale),
      locale,
      placeholder: () => placeholderValue(today(placeholderZone ?? temporal().Now.timeZoneId()), kind),
    }),
    [committed, controlled, disabled, readOnly, fields, hourCycle, kind, locale, placeholderZone]
  );
  // What gestures read at event time: this render's settings and callback.
  const eventProps = useRef({ settings, rules, onValueChange });
  useLayoutEffect(() => {
    eventProps.current = { settings, rules, onValueChange };
  });

  /** Applies a transition: reports its commit, keeps the edit unless the commit is canceled. */
  const run = useCallback(
    (transition: SessionTransition, event: Event, trigger: Element | undefined): void => {
      const before = store.get();
      const { commit } = transition;
      if (commit !== undefined) {
        const details = createChangeEventDetails(commit.reason, event, trigger, {
          getValidationError: () =>
            commit.value === null ? null : valueError(commit.value, eventProps.current.rules),
        });
        // SAFETY: the committed value is of the input's resolved kind, which is `T`'s.
        eventProps.current.onValueChange?.(commit.value as T | null, details);
        if (details.isCanceled) {
          store.set(canceled(before));
          return;
        }
      }
      store.set(transition.state);
      if (transition.focus !== undefined && trigger !== undefined) {
        focusSibling(rootRef.current, trigger, transition.focus);
      }
    },
    [store]
  );

  const actions = useMemo(
    (): DateInputActions => ({
      keyDown(segment, event: KeyboardEvent<HTMLElement>) {
        const { settings: current } = eventProps.current;
        const { currentTarget, nativeEvent } = event;
        // A chord such as Cmd+ArrowUp, Alt+ArrowLeft or Ctrl+Backspace is the browser's or the
        // host's, as React Aria's segments leave it.
        if (event.ctrlKey || event.metaKey || event.altKey) {
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          focusSibling(rootRef.current, currentTarget, event.key === "ArrowRight" ? "next" : "previous");
          return;
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          if (segment.isEditable) {
            run(erase(store.get(), segment, current), nativeEvent, currentTarget);
          }
          return;
        }
        if (!segment.isEditable || !current.editable) {
          return;
        }
        const transition = keyTransition(
          event.key,
          segment.type,
          PAGE_STEP[segment.type],
          current,
          store.get()
        );
        if (transition !== undefined) {
          event.preventDefault();
          run(transition, nativeEvent, currentTarget);
        }
      },
      erase(segment, event, target) {
        run(erase(store.get(), segment, eventProps.current.settings), event, target);
      },
      type(type, key, event, target) {
        run(typeKey(store.get(), type, key, eventProps.current.settings), event, target);
      },
      segmentFocused() {
        store.set(segmentFocused(store.get()));
      },
    }),
    [store, run]
  );

  useFormReset(
    hiddenInput,
    controlled
      ? null
      : () => {
          store.set(resetSession(parsedDefault, hourCycle, fields));
          field.reset();
        }
  );

  const description =
    committed === null
      ? undefined
      : strings.format("selectedDateDescription", { date: describeValue(format, committed) });
  const descriptionId = `${fallbackId}-description`;
  const describedBy =
    [description === undefined ? undefined : descriptionId, ariaDescribedBy, field.describedBy]
      .filter((id) => id !== undefined && id !== "")
      .join(" ") || undefined;
  const labelledBy = ariaLabelledBy ?? labelId;

  const segmentName = useCallback(
    (type: Parameters<DateInputRootContextValue["segmentName"]>[0]): string => {
      try {
        return displayNames(locale, { type: "dateTimeField" }).of(type) ?? strings.format(type);
      } catch {
        return strings.format(type);
      }
    },
    [locale, strings]
  );

  const context = useMemo(
    (): DateInputRootContextValue => ({
      disabled,
      readOnly,
      required,
      invalid,
      ios,
      locale,
      hourCycle,
      draft,
      firstEditableIndex,
      ariaLabel,
      ariaLabelledBy: labelledBy,
      describedBy,
      segmentName,
      emptyText: strings.format("empty"),
      actions,
    }),
    [
      disabled,
      readOnly,
      required,
      invalid,
      ios,
      locale,
      hourCycle,
      draft,
      firstEditableIndex,
      ariaLabel,
      labelledBy,
      describedBy,
      segmentName,
      strings,
      actions,
    ]
  );

  const state = useMemo(
    (): DateInputRootState => ({
      disabled,
      readonly: readOnly,
      required,
      invalid,
      empty: entry.kind === "empty",
    }),
    [disabled, readOnly, required, invalid, entry.kind]
  );

  const element = useRender({
    defaultTagName: "div",
    render,
    ref: ref === undefined ? rootRef : [rootRef, ref],
    state,
    stateAttributesMapping: ROOT_STATE_ATTRIBUTES,
    props: {
      "data-slot": "field-group",
      "data-size": size,
      ...mergeProps<"div">(
        // The blur and paste handlers read this render's settings at event time; mergeProps
        // composes them and calls none while rendering.
        // oxlint-disable-next-line react/refs -- a handler's ref read, not a read during render
        {
          role: "group",
          "aria-label": ariaLabel,
          "aria-labelledby": labelledBy,
          "aria-describedby": describedBy,
          "aria-disabled": disabled || undefined,
          className: cn(dateInputVariants({ size }).root(), className),
          // Unicode isolation keeps the segments in order inside right-to-left text, as React Aria's group.
          style: { unicodeBidi: "isolate" },
          onFocus(event) {
            if (isNode(event.relatedTarget) && event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            store.set(focusEntered(store.get()));
            setFocused(true);
          },
          onBlur(event) {
            if (isNode(event.relatedTarget) && event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            run(confirm(store.get(), eventProps.current.settings), event.nativeEvent, undefined);
            blurred(store.get().edited);
          },
          onPointerDown(event) {
            // A press on the box, not on a segment, focuses the last filled segment before it.
            if (disabled || event.pointerType !== "mouse") {
              return;
            }
            event.preventDefault();
            focusBefore(event.currentTarget, event.target);
          },
          onPointerUp(event) {
            if (disabled || event.pointerType === "mouse") {
              return;
            }
            if (isElement(event.target) && event.target.closest(SEGMENT_SELECTOR) !== null) {
              return;
            }
            focusBefore(event.currentTarget, event.target);
          },
          onPaste(event) {
            event.preventDefault();
            const trigger = isElement(event.target) ? event.target : undefined;
            run(
              paste(store.get(), event.clipboardData.getData("text"), eventProps.current.settings),
              event.nativeEvent,
              trigger
            );
          },
          children: segments.map((segment) =>
            children === undefined ? (
              <DateInputSegment key={segment.index} segment={segment} />
            ) : (
              <Fragment key={segment.index}>{children(segment)}</Fragment>
            )
          ),
        },
        definedProps(elementProps)
      ),
    },
  });

  return (
    <DateInputRootContext value={context}>
      {element}
      <input
        ref={hiddenInput}
        id={hiddenInputId}
        type="text"
        tabIndex={-1}
        aria-hidden
        name={field.name}
        form={form}
        value={iso}
        // The input mirrors the committed value; it never takes typing.
        onChange={noChange}
        disabled={disabled}
        onFocus={() => firstSegment.current?.focus()}
        className={dateInputVariants().hiddenInput()}
      />
      {description === undefined ? null : (
        <span id={descriptionId} hidden>
          {description}
        </span>
      )}
    </DateInputRootContext>
  );
}

function noChange(): undefined {
  return undefined;
}
