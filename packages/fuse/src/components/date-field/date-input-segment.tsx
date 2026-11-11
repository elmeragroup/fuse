"use client";

import { useId, useLayoutEffect, useMemo, useRef } from "react";
import type { ComponentProps, FocusEvent, KeyboardEvent, PointerEvent, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { hasFocus } from "../../internal/active-element";
import { definedProps } from "../../internal/defined-props";
import { isHTMLElement } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { fromHourCycle, segmentLimits } from "./date-draft";
import { hourName, monthName } from "./date-field-format";
import { useDateInputRootContext } from "./date-input-context";
import type { DateInputRootContextValue } from "./date-input-context";
import { useSegmentInput } from "./date-input-segment-dom";
import type {
  DateInputEditableSegmentData,
  DateInputFocusableSegmentData,
  DateInputSegmentProps,
  DateInputSegmentState,
  DateInputSegmentType,
} from "./date-input-types";
import { dateInputVariants } from "./date-input-variants";

const SEGMENT_STATE_ATTRIBUTES = {
  type: (value: DateInputSegmentType) => ({ "data-type": value }),
  invalid: (value: boolean) => (value ? { "data-invalid": "true" } : null),
};

/**
 * One segment of a `DateInput.Root`. An editable one is a `spinbutton` (a `textbox` on iOS, whose
 * VoiceOver cannot focus a spinbutton) named by its unit and the field's label, with its number as
 * its value and the month's name or the hour as said in its value text. It edits through the
 * keyboard: digits fill it and move on, the arrows step it, Page Up and Page Down by a page, Home
 * and End to its ends, Backspace and Delete clear a digit. A literal is hidden from assistive
 * technology.
 */
export function DateInputSegment({
  segment,
  className,
  render,
  ref,
  ...props
}: DateInputSegmentProps): ReactElement {
  const root = useDateInputRootContext();
  const { actions } = root;
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const isZone = segment.type === "timeZoneName";
  const editable = segment.isEditable && !root.disabled && !root.readOnly;

  const inputRef = useSegmentInput({
    editable,
    dayPeriod: segment.type === "dayPeriod",
    erase(event) {
      if (segment.isEditable && isHTMLElement(event.currentTarget)) {
        actions.erase(segment, event, event.currentTarget);
      }
    },
    type(key, event) {
      if (segment.isEditable && isHTMLElement(event.currentTarget)) {
        actions.type(segment.type, key, event, event.currentTarget);
      }
    },
  });

  // The element this segment renders, read when it unmounts: a focused segment that leaves hands
  // focus on before React removes it, so focus never drops to the body. Only an unmount does: the
  // cleanup runs once, reading the Root's actions as they are then.
  const elementRef = useRef<HTMLElement>(null);
  const actionsRef = useRef(actions);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });
  useLayoutEffect(
    () => () => {
      const element = elementRef.current;
      if (element !== null && hasFocus(element)) {
        actionsRef.current.segmentRemoved(element);
      }
    },
    []
  );

  const state = useMemo(
    (): DateInputSegmentState => ({
      type: segment.type,
      placeholder: segment.isPlaceholder,
      disabled: root.disabled,
      readonly: root.readOnly || isZone,
      invalid: root.invalid,
    }),
    [segment.type, segment.isPlaceholder, root.disabled, root.readOnly, root.invalid, isZone]
  );

  const own: ComponentProps<"span"> =
    segment.type === "literal"
      ? { "aria-hidden": true, suppressHydrationWarning: true }
      : {
          ...segmentAttributes(root, segment, id, editable),
          onKeyDown(event: KeyboardEvent<HTMLElement>) {
            actions.keyDown(segment, event);
          },
          onFocus(event: FocusEvent<HTMLElement>) {
            actions.segmentFocused();
            // A collapsed selection, or Chrome fires no input events into the segment.
            event.currentTarget.ownerDocument.getSelection()?.collapse(event.currentTarget);
          },
        };

  return useRender({
    defaultTagName: "span",
    render,
    ref:
      segment.type === "literal"
        ? ref
        : ref === undefined
          ? [inputRef, elementRef]
          : [inputRef, elementRef, ref],
    state,
    stateAttributesMapping: SEGMENT_STATE_ATTRIBUTES,
    props: {
      "data-slot": "date-input-segment",
      ...mergeProps<"span">(
        { ...own, className: cn(dateInputVariants().segment(), className), children: segment.text },
        // `undefined` from a consumer must not erase the segment's own id, name or description.
        definedProps(props)
      ),
    },
  });
}

/** A focusable segment's attributes: a unit, or the zone's name, which is a read-only textbox. */
function segmentAttributes(
  root: DateInputRootContextValue,
  segment: DateInputFocusableSegmentData,
  id: string,
  editable: boolean
): ComponentProps<"span"> {
  const isZone = segment.type === "timeZoneName";
  const name = root.segmentName(segment.type);
  // As React Aria: the unit, the field's aria-label, and the labelling element after this one's id.
  const label = `${name}${root.ariaLabel === undefined ? "" : `, ${root.ariaLabel}`}${root.ariaLabelledBy === undefined ? "" : ", "}`;
  const attributes: ComponentProps<"span"> = {
    id,
    role: root.ios || isZone ? "textbox" : "spinbutton",
    "aria-label": label,
    "aria-labelledby": root.ariaLabelledBy === undefined ? undefined : `${id} ${root.ariaLabelledBy}`,
    "aria-describedby":
      segment.index === root.firstEditableIndex || root.invalid ? root.describedBy : undefined,
    "aria-invalid": root.invalid || undefined,
    "aria-readonly": root.readOnly || isZone || undefined,
    "aria-disabled": root.disabled || undefined,
    "aria-required": (root.required && !isZone) || undefined,
    tabIndex: root.disabled ? undefined : 0,
    contentEditable: editable,
    suppressContentEditableWarning: editable,
    spellCheck: editable ? "false" : undefined,
    autoCorrect: editable ? "off" : undefined,
    autoCapitalize: editable ? "off" : undefined,
    enterKeyHint: editable ? "next" : undefined,
    inputMode: editable && segment.type !== "dayPeriod" ? "numeric" : undefined,
    onPointerDown(event: PointerEvent<HTMLSpanElement>) {
      // A press on a segment focuses it natively; the Root's press handling is for the box.
      event.stopPropagation();
    },
  };
  if (root.ios || !segment.isEditable) {
    return attributes;
  }
  return { ...attributes, ...spinAttributes(root, segment) };
}

function spinAttributes(
  root: DateInputRootContextValue,
  segment: DateInputEditableSegmentData
): ComponentProps<"span"> {
  const { type } = segment;
  const limits = segmentLimits(type, root.hourCycle);
  const number = root.draft[type];
  let text = segment.isPlaceholder ? "" : segment.text;
  if (!segment.isPlaceholder && type === "month" && root.draft.month !== null) {
    const name = monthName(root.locale, root.draft.month);
    text = name === segment.text ? name : `${segment.text} – ${name}`;
  } else if (!segment.isPlaceholder && type === "hour" && root.draft.hour !== null) {
    const hour24 = fromHourCycle(root.draft.hour, root.draft.dayPeriod ?? 0, root.hourCycle);
    text = hourName(root.locale, hour24, root.hourCycle);
  }
  return {
    "aria-valuenow": number ?? undefined,
    "aria-valuemin": limits.min,
    "aria-valuemax": limits.max,
    "aria-valuetext": text === "" ? root.emptyText : text,
  };
}
