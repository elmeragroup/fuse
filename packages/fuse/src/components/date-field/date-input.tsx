"use client";

import { Fragment, use, useCallback, useId, useMemo, useRef } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import type { Bounds } from "../../temporal/bounds";
import { temporal } from "../../temporal/temporal";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import { today } from "../../temporal/today";
import { useTemporalProp } from "../calendar/calendar-input";
import { draftOf, editableSegments, placeholderValue } from "./date-draft";
import { dayPeriodNames, fieldSegments, resolveHourCycle } from "./date-field-format";
import type { FieldFormat } from "./date-field-format";
import { readFieldText } from "./date-field-text";
import { DateInputBoundaryContext } from "./date-input-boundary";
import { DateInputRootContext } from "./date-input-context";
import type { DateInputRootContextValue } from "./date-input-context";
import { useDateInputField } from "./date-input-field";
import { boxPressHandlers, firstFocusableSegment } from "./date-input-focus";
import { useIsIOS } from "./date-input-ios";
import { useDateInputNaming } from "./date-input-naming";
import { DateInputNeighborContext } from "./date-input-neighbors";
import { DateInputScopeContext, scopeShows, standInDay } from "./date-input-scope";
import { DateInputSegment } from "./date-input-segment";
import { basisOf, draftOver, entryOf } from "./date-input-session";
import type { SessionSettings } from "./date-input-session";
import { useSessionActions, useSessionStore } from "./date-input-store";
import type {
  DateInputRootProps,
  DateInputRootState,
  DateInputSegmentData,
  DateInputValue,
} from "./date-input-types";
import { entryError, errorMessage } from "./date-input-validation";
import type { DateInputRules } from "./date-input-validation";
import { dateInputVariants } from "./date-input-variants";
import { todayInstant, useFieldZoneName, zoneNamingInstant } from "./date-input-zone";
import type { KindProps, PropsMadeValue } from "./date-kind-props";
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

const ROOT_STATE_ATTRIBUTES = {
  invalid: (value: boolean) => (value ? { "data-invalid": "true" } : null),
};

/**
 * A date, date-time or zoned date-time edited in segments: one per unit, in the locale's order,
 * with the locale's literals between them. It is a `group`. Its validity inside a Field covers a
 * missing, incomplete, out-of-bounds and unavailable value. It reads `globalThis.Temporal`, so a
 * host without native Temporal imports `@elmeragroup/fuse/temporal-polyfill` once. It never reads
 * the clock while rendering.
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
  const neighbor = use(DateInputNeighborContext);
  const boundary = use(DateInputBoundaryContext);
  const inputScope = use(DateInputScopeContext);
  const scope = inputScope.units;
  const controlled = valueProp !== undefined;

  const parsedValue = useTemporalProp(valueProp, OWNER, "value");
  const parsedDefault = useTemporalProp(defaultValue, OWNER, "defaultValue");
  const minBound = useTemporalProp(minValue, OWNER, "minValue") ?? undefined;
  const maxBound = useTemporalProp(maxValue, OWNER, "maxValue") ?? undefined;

  const hourCycle = resolveHourCycle(locale, hourCycleProp);
  // The edit session's one store. Every gesture is a transition of it; see `date-input-store.ts`.
  const { store, session } = useSessionStore(parsedDefault);
  const committed = controlled ? parsedValue : session.own;

  // A kind a value or default value named sticks, so emptying a zoned input and typing again emits
  // a zoned value; one the granularity and zone made follows them (`useValueKind`). That memory is
  // for an input that owns its value: a time-only input takes the kind its control supplies.
  const { kind } = useValueKind(
    { value: committed, defaultValue: parsedDefault, granularity: granularityProp, timeZone: timeZoneProp },
    OWNER,
    inputScope.units === "time" ? { supplied: inputScope.kind } : { warnOnKindChange: true }
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
      scope,
    }),
    [locale, granularity, hourCycle, shouldForceLeadingZeros, zone, hideTimeZone, scope]
  );
  const fields = useMemo(
    () => editableSegments(granularity, hourCycle).filter((type) => scopeShows(scope, type)),
    [granularity, hourCycle, scope]
  );
  const readText = useCallback((text: string) => readFieldText(format, text), [format]);

  // The key of the committed value and the segments shown, which a draft belongs to.
  const basis = basisOf(committed, hourCycle, fields, scope);
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
        return firstFocusableSegment(rootRef.current);
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
  const { disabled, invalid, hiddenInput, hiddenInputId, labelId } = field;

  // The zone's name for today while the input is empty or holds a time on the stand-in day.
  const zoneName = useFieldZoneName(format, zoneNamingInstant(committed, inputScope));

  const segments = useMemo(() => fieldSegments(format, draft, zoneName), [format, draft, zoneName]);
  const firstEditableIndex = segments.find((segment) => segment.type !== "literal")?.index ?? -1;
  const placeholderZone = zone ?? localeTimeZone;

  // The settings a transition reads. The edit state itself is the store's, read synchronously.
  const settings = useMemo(
    (): SessionSettings => ({
      committed,
      controlled,
      editable: !disabled && !readOnly,
      fields,
      units: scope,
      readText,
      // The instant a pasted value's zone name is checked at: the one the segments name it at.
      zoneInstant: (value) => zoneNamingInstant(value, inputScope) ?? todayInstant(),
      hourCycle,
      kind,
      dayPeriods: dayPeriodNames(locale),
      locale,
      // A time-only input's day is its control's, or the stand-in day; any other input's is today.
      placeholder: () =>
        placeholderValue(
          inputScope.units === "time"
            ? (inputScope.day ?? standInDay())
            : today(placeholderZone ?? temporal().Now.timeZoneId()),
          kind
        ),
    }),
    [
      committed,
      controlled,
      disabled,
      readOnly,
      fields,
      scope,
      readText,
      hourCycle,
      kind,
      locale,
      placeholderZone,
      inputScope,
    ]
  );
  const { actions, rootHandlers } = useSessionActions(store, {
    basis,
    settings,
    rules,
    onValueChange,
    neighbor,
    boundary,
    rootRef,
    defaultValue: parsedDefault,
    field,
  });

  const { description, descriptionId, describedBy, labelledBy, segmentName } = useDateInputNaming({
    strings,
    format,
    committed,
    zoneName,
    id: fallbackId,
    ariaLabelledBy,
    ariaDescribedBy,
    fieldLabelId: labelId,
    fieldDescribedBy: field.describedBy,
  });

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
        // The session's handlers read the last render's settings at event time; mergeProps
        // composes them and calls none while rendering.
        {
          role: "group",
          "aria-label": ariaLabel,
          "aria-labelledby": labelledBy,
          "aria-describedby": describedBy,
          "aria-disabled": disabled || undefined,
          className: cn(dateInputVariants({ size }).root(), className),
          // Unicode isolation keeps the segments in order inside right-to-left text, as React Aria's
          // group does.
          style: { unicodeBidi: "isolate" },
          ...rootHandlers,
          ...boxPressHandlers(disabled),
          children: segments.map((segment) =>
            children === undefined ? (
              <DateInputSegment key={segmentKey(segment)} segment={segment} />
            ) : (
              <Fragment key={segmentKey(segment)}>{children(segment)}</Fragment>
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

/**
 * A segment's React key: a unit or the zone's name by its type, which appears once, and a literal
 * by its place. A unit keeps its element and focus when a granularity change adds or removes others
 * around it, and a removed unit unmounts rather than turning into its neighbor.
 */
function segmentKey(segment: DateInputSegmentData): string {
  return segment.type === "literal" ? `literal-${String(segment.index)}` : segment.type;
}

function noChange(): undefined {
  return undefined;
}
