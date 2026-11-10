"use client";

// The range picker's parts other than its Root: the label, description and merged error it wires
// to both ends, the two ends (each a Base UI Field of its own, with the adapter that reports the
// Field's validity to the Root), the separator and the range calendar. They read only the Root's
// private context (`date-range-picker-context.ts`).

import { useCallback, useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactElement } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";
import { useFormContext } from "@base-ui/react/internals/form-context";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { isRenderableNode } from "../../internal/is-renderable-node";
import { cn } from "../../styles/cn";
import { SEGMENT_SELECTOR } from "../date-field/date-input-context";
import { datePickerVariants } from "../date-picker/date-picker-variants";
import { datePickerStrings } from "../date-picker/intl";
import { stateClassName } from "../date-picker/picker-class-name";
import { PickerDateInput } from "../date-picker/picker-input";
import type { PickerInputPartProps, PickerOwnedCalendarProp } from "../date-picker/picker-root";
import { DefaultCalendarChildren, NO_STATE } from "../date-picker/picker-shell";
import { fieldVariants } from "../field/field-variants";
import { RangeCalendarRoot } from "../range-calendar/range-calendar";
import type { RangeCalendarRootProps } from "../range-calendar/range-calendar";
import { NO_MESSAGES, useRangeRootContext } from "./date-range-picker-context";
import type { DateRangePickerRootContextValue, Endpoint } from "./date-range-picker-context";

const styles = datePickerVariants({ range: true });
const fieldSlots = fieldVariants();

/** The parts of `DateRangePicker.Label`, `.Description` and `.Error`: a `span` or `div` with `render`. */
export type DateRangePickerLabelProps = useRender.ComponentProps<"span">;

/**
 * The picker's visible label. It names the group, both inputs' segments ("month, Start Date,
 * Period"), the trigger and the popup; pressing it focuses the first segment. Its text sits in a span
 * whose id the Root owns, which every name points at, so an `id` of your own on the label (directly
 * or on its `render` element) keeps the names whole, on the server too.
 */
export function DateRangePickerLabel({
  className,
  render,
  children,
  ...props
}: DateRangePickerLabelProps): ReactElement {
  const root = useRangeRootContext("DateRangePicker.Label");
  const { registerPart } = root;
  useLayoutEffect(() => registerPart("label"), [registerPart]);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "field-label",
      ...mergeProps<"span">(
        {
          className: stateClassName(className, NO_STATE, fieldSlots.label()),
          children: <span id={root.labelId}>{children}</span>,
          onClick(event: MouseEvent<HTMLSpanElement>) {
            const picker = event.currentTarget.closest('[data-slot="date-range-picker"]');
            picker?.querySelector<HTMLElement>(SEGMENT_SELECTOR)?.focus();
          },
        },
        definedProps(props)
      ),
    },
  });
}

/** `DateRangePicker.Description` takes a `div`'s props plus Base UI's `render`. */
export type DateRangePickerDescriptionProps = useRender.ComponentProps<"div">;

/**
 * Supporting copy, which describes the group and both inputs. Its text sits in a span whose id the
 * Root owns, as the label's.
 */
export function DateRangePickerDescription({
  className,
  render,
  children,
  ...props
}: DateRangePickerDescriptionProps): ReactElement {
  const root = useRangeRootContext("DateRangePicker.Description");
  const { registerPart } = root;
  useLayoutEffect(() => registerPart("description"), [registerPart]);
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "field-description",
      ...mergeProps<"div">(
        {
          className: stateClassName(className, NO_STATE, fieldSlots.description()),
          children: <span id={root.descriptionId}>{children}</span>,
        },
        definedProps(props)
      ),
    },
  });
}

/** `DateRangePicker.Error` takes a `div`'s props plus Base UI's `render`. */
export type DateRangePickerErrorProps = useRender.ComponentProps<"div">;

/**
 * The merged error of both ends: each end's own message (missing, incomplete, out of bounds,
 * unavailable, an end before its start) and the errors a `Form` holds under `startName` and
 * `endName`, once each, while the picker is invalid. Children that render anything replace them;
 * `null`, `false` and `""` keep them. Renders nothing while the picker is valid. While it renders, the group and both inputs are
 * described by its text, which sits in a span whose id the Root owns.
 */
export function DateRangePickerError({
  className,
  render,
  children,
  ...props
}: DateRangePickerErrorProps): ReactElement | null {
  const root = useRangeRootContext("DateRangePicker.Error");
  const own = isRenderableNode(children) ? children : null;
  const content = own ?? (root.messages.length > 0 ? root.messages.join(" ") : null);
  const shown = root.invalid && content !== null;
  const { registerPart } = root;
  useLayoutEffect(() => (shown ? registerPart("error") : undefined), [shown, registerPart]);
  const element = useRender({
    defaultTagName: "div",
    render,
    enabled: shown,
    props: {
      "data-slot": "field-error",
      ...mergeProps<"div">(
        {
          role: "alert",
          className: stateClassName(className, NO_STATE, fieldSlots.error()),
          children: <span id={root.errorId}>{content}</span>,
        },
        definedProps(props)
      ),
    },
  });
  return shown ? element : null;
}

/** An end's input: `DateInput.Root`'s presentation props. */
export type DateRangePickerInputProps = PickerInputPartProps;

/** Reads its Field's messages and the Form's errors under its name, and reports them to the Root. */
function EndpointMessagesReport({
  endpoint,
  report,
  otherEnd,
  reversed,
}: {
  readonly endpoint: Endpoint;
  readonly report: DateRangePickerRootContextValue["reportMessages"];
  /** The other end's value as ISO text: this end's validity depends on it (a reversed range). */
  readonly otherEnd: string;
  /** Whether this end comes before its start. */
  readonly reversed: boolean;
}): null {
  const field = useFieldRootContext();
  // This end's validity follows the other end too: an end the other end's move reverses validates
  // and shows its error, and a shown error validates again when the other end moves, as when its
  // own value changes.
  const { validation } = field;
  const shownInvalid = field.state.valid === false;
  const committedValue = field.validityData.value;
  const lastOtherEnd = useRef(otherEnd);
  useLayoutEffect(() => {
    if (lastOtherEnd.current === otherEnd) {
      return;
    }
    lastOtherEnd.current = otherEnd;
    if (shownInvalid || reversed) {
      void validation.commit(committedValue);
    }
  }, [otherEnd, shownInvalid, reversed, validation, committedValue]);
  const { errors } = useFormContext();
  const name = field.name;
  const formError = name !== undefined && Object.hasOwn(errors, name) ? errors[name] : undefined;
  const formMessages = formError === undefined ? [] : Array.isArray(formError) ? formError : [formError];
  const messages =
    formMessages.length > 0 ? formMessages : field.state.valid === false ? field.validityData.errors : [];
  const key = messages.join("\n");
  useLayoutEffect(() => {
    report(endpoint, key === "" ? NO_MESSAGES : key.split("\n"));
  }, [report, endpoint, key]);
  useLayoutEffect(() => () => report(endpoint, NO_MESSAGES), [report, endpoint]);
  return null;
}

function DateRangePickerEndpoint({
  endpoint,
  ...props
}: DateRangePickerInputProps & { readonly endpoint: Endpoint }): ReactElement {
  const root = useRangeRootContext(
    endpoint === "start" ? "DateRangePicker.StartInput" : "DateRangePicker.EndInput"
  );
  const strings = useLocalizedStrings(datePickerStrings);
  const reversedMessage = strings.format("rangeReversed");
  const reversed = endpoint === "end" && root.reversed;
  const name = root.names[endpoint];
  const { reportMessages, reportInputInvalid } = root;
  const reportInvalid = useCallback(
    (invalid: boolean) => reportInputInvalid(endpoint, invalid),
    [reportInputInvalid, endpoint]
  );
  return (
    <FieldPrimitive.Root
      // A form reset remounts the end's Field and input, so the draft and shown validity start over.
      key={root.generation}
      className="contents"
      {...definedProps({ name })}
      invalid={root.invalidProp}
      disabled={root.inputSettings.disabled}
      // The end before the start is the end's error, as React Aria reports it.
      validate={() => (reversed ? reversedMessage : null)}>
      <EndpointMessagesReport
        endpoint={endpoint}
        report={reportMessages}
        otherEnd={root.ends[endpoint === "start" ? "end" : "start"]?.toString() ?? ""}
        reversed={reversed}
      />
      <PickerDateInput
        aria-label={strings.format(endpoint === "start" ? "startDate" : "endDate")}
        {...definedProps({
          // The label, or the picker's `aria-label` through a hidden span: "month, Start Date, Period".
          "aria-labelledby": root.endpointLabelledBy,
          "aria-describedby": root.describedBy,
        })}
        {...definedProps(props)}
        onInvalidChange={reportInvalid}
        value={root.ends[endpoint]}
        onValueChange={(value, details) => root.inputChange(endpoint, value, details)}
        {...root.inputSettings}
        invalid={root.invalidProp || reversed}
      />
    </FieldPrimitive.Root>
  );
}

/**
 * The start's segments, a `DateInput.Root` in a Base UI Field of its own under `startName`, named
 * "Start Date" and the picker's label.
 */
export function DateRangePickerStartInput(props: DateRangePickerInputProps): ReactElement {
  return <DateRangePickerEndpoint endpoint="start" {...props} />;
}

/** The end's segments, in a Field of their own under `endName`, named "End Date" and the label. */
export function DateRangePickerEndInput(props: DateRangePickerInputProps): ReactElement {
  return <DateRangePickerEndpoint endpoint="end" {...props} />;
}

/** `DateRangePicker.Separator` takes a `span`'s props plus Base UI's `render`. */
export type DateRangePickerSeparatorProps = useRender.ComponentProps<"span">;

/**
 * The en dash between the inputs. Hidden from assistive technology: the segments already say
 * "Start Date" and "End Date".
 */
export function DateRangePickerSeparator({
  className,
  render,
  ...props
}: DateRangePickerSeparatorProps): ReactElement {
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "date-range-picker-separator",
      ...mergeProps<"span">(
        {
          "aria-hidden": true,
          className: stateClassName(className, NO_STATE, styles.separator()),
          children: "–",
        },
        definedProps(props)
      ),
    },
  });
}

/**
 * `DateRangePicker.Calendar` takes `RangeCalendar.Root`'s presentation props, and
 * `commitBehavior`; the range, bounds and calendar options come from the Root.
 */
export type DateRangePickerCalendarProps = Omit<RangeCalendarRootProps, PickerOwnedCalendarProp> & {
  /** Extra classes, merged after the picker's own. */
  className?: string;
};

/**
 * The picker's calendar, a `RangeCalendar.Root` on the range's days. A completed range reports its
 * reason and, pressed or chosen by key, closes the popup. Escape on a half-picked range drops it and
 * keeps the popup open. With a preset pane, focus leaving the calendar drops a half-picked range
 * (`commitBehavior` `"reset"`); without one it completes it (`"select"`). Without children it renders
 * the month buttons, the heading and the months.
 */
export function DateRangePickerCalendar({
  className,
  children,
  commitBehavior,
  ...props
}: DateRangePickerCalendarProps): ReactElement {
  const root = useRangeRootContext("DateRangePicker.Calendar");
  return (
    <RangeCalendarRoot
      key={root.calendarKey}
      {...definedProps(props)}
      commitBehavior={commitBehavior ?? (root.hasPresets ? "reset" : "select")}
      value={root.calendarRange}
      onValueChange={root.selectRange}
      {...root.calendarSettings}
      className={cn(styles.calendar(), className)}>
      {children ?? <DefaultCalendarChildren />}
    </RangeCalendarRoot>
  );
}
