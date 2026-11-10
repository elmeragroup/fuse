"use client";

import { useLayoutEffect, useRef } from "react";
import type { FocusEvent, ReactElement } from "react";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { isNode } from "../../internal/dom-node";
import { DateInputRoot } from "../date-field/date-input";
import type { DateInputRootProps, DateInputValue } from "../date-field/date-input";
import { datePickerVariants } from "./date-picker-variants";
import { stateClassName } from "./picker-class-name";
import { markInternalFocusout } from "./picker-focus-boundary";
import { usePickerShellContext } from "./picker-shell";

/** Reports the input's shown validity to its picker, which marks the group. */
function InvalidReport({
  invalid,
  report,
}: {
  readonly invalid: boolean;
  readonly report: (invalid: boolean) => void;
}): null {
  useLayoutEffect(() => {
    report(invalid);
  }, [invalid, report]);
  useLayoutEffect(() => () => report(false), [report]);
  return null;
}

/** A picker's input: `DateInput.Root`'s props, and where its validity goes. */
export type PickerDateInputProps = Omit<DateInputRootProps<DateInputValue>, "render"> & {
  /** Receives whether the input shows as invalid, after every change. */
  readonly onInvalidChange: (invalid: boolean) => void;
};

/**
 * A `DateInput.Root` inside a picker's group, through its public props alone. The group is the
 * named field box, so the input renders as a presentational row that paints no box and leaves its
 * naming to the segments, which keep their names ("month, Start date"). Its `render` state tells
 * the picker whether the input shows as invalid.
 *
 * Its focus boundary is the input together with the popup: focus moving from the segments into the
 * popup is no blur of the input, so its Field validation waits. The picker delivers the deferred
 * blur, as a real `focusout` toward where focus went, once focus lands outside the input and the
 * popup; focus coming back from the popup is no new focus either.
 */
export function PickerDateInput({
  className,
  onInvalidChange,
  ref,
  ...props
}: PickerDateInputProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Input");
  const elementRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(elementRef, ref ?? null);
  // Whether the input's blur into the popup is waiting, and whether a delivery is passing through.
  const deferred = useRef(false);
  const delivering = useRef(false);
  const { registerInputBoundary, popupRef } = shell;
  const inputClass = datePickerVariants({ range: shell.range }).input();
  useLayoutEffect(
    () =>
      registerInputBoundary({
        element: () => elementRef.current,
        flush(next) {
          const element = elementRef.current;
          if (!deferred.current || element === null) {
            return;
          }
          deferred.current = false;
          const view = element.ownerDocument.defaultView;
          if (view === null) {
            return;
          }
          delivering.current = true;
          try {
            element.dispatchEvent(
              markInternalFocusout(new view.FocusEvent("focusout", { bubbles: true, relatedTarget: next }))
            );
          } finally {
            delivering.current = false;
          }
        },
      }),
    [registerInputBoundary]
  );

  return (
    <DateInputRoot<DateInputValue>
      {...definedProps(props)}
      ref={mergedRef}
      render={(inputProps, state) => (
        <div
          {...inputProps}
          role="presentation"
          aria-labelledby={undefined}
          aria-label={undefined}
          aria-describedby={undefined}
          aria-disabled={undefined}
          data-slot="date-picker-input"
          className={stateClassName(className, state, inputClass)}
          onBlur={(event: FocusEvent<HTMLDivElement>) => {
            const next = event.relatedTarget;
            if (!delivering.current && isNode(next) && popupRef.current?.contains(next) === true) {
              deferred.current = true;
              return;
            }
            inputProps.onBlur?.(event);
          }}
          onFocus={(event: FocusEvent<HTMLDivElement>) => {
            if (deferred.current) {
              // Focus came back from the popup: the input never left.
              deferred.current = false;
              return;
            }
            inputProps.onFocus?.(event);
          }}>
          {inputProps.children}
          <InvalidReport invalid={state.invalid} report={onInvalidChange} />
        </div>
      )}
    />
  );
}
