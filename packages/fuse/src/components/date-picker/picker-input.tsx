"use client";

import { useLayoutEffect } from "react";
import type { ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { DateInputRoot } from "../date-field/date-input";
import type { DateInputRootProps, DateInputValue } from "../date-field/date-input";
import { DateInputBoundaryContext } from "../date-field/date-input-boundary";
import { DateInputNeighborContext } from "../date-field/date-input-neighbors";
import type { KindFromValue } from "../date-field/date-kind-props";
import { datePickerVariants } from "./date-picker-variants";
import { stateClassName } from "./picker-class-name";
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
 * naming to the segments, which keep names such as "month, Start date". Its `render` state tells
 * the picker whether the input shows as invalid.
 *
 * The picker gives it a focus boundary that covers the input and the popup; see
 * `date-input-boundary.ts`.
 */
export function PickerDateInput({
  className,
  onInvalidChange,
  ...props
}: PickerDateInputProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Input");
  const inputClass = datePickerVariants({ range: shell.range }).input();

  return (
    // The picker's inputs are one run of segments for focus: a range's start moves on to its end.
    <DateInputNeighborContext value={shell.adjacentInput}>
      <DateInputBoundaryContext value={shell.inputBoundary}>
        <DateInputRoot<KindFromValue, DateInputValue>
          {...definedProps(props)}
          render={(inputProps, state) => (
            <div
              {...inputProps}
              role="presentation"
              aria-labelledby={undefined}
              aria-label={undefined}
              aria-describedby={undefined}
              aria-disabled={undefined}
              data-slot="date-picker-input"
              className={stateClassName(className, state, inputClass)}>
              {inputProps.children}
              <InvalidReport invalid={state.invalid} report={onInvalidChange} />
            </div>
          )}
        />
      </DateInputBoundaryContext>
    </DateInputNeighborContext>
  );
}
