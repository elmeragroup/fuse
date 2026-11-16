"use client";

import { useLayoutEffect } from "react";
import type { ReactElement } from "react";

import { definedProps } from "../../internal/defined-props";
import { DateInputRoot } from "../date-field/date-input";
import type { DateInputRootProps, DateInputValue } from "../date-field/date-input";
import { DateInputBoundaryContext } from "../date-field/date-input-boundary";
import { DateInputKindContext } from "../date-field/date-input-kind";
import { DateInputNeighborContext } from "../date-field/date-input-neighbors";
import { DateInputResetContext } from "../date-field/date-input-reset";
import type { KindFromValue } from "../date-field/date-kind-props";
import { datePickerVariants } from "./date-picker-variants";
import { stateClassName } from "./picker-class-name";
import { endKind, endOfValue } from "./picker-draft";
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
 * A `DateInput.Root` inside a picker's group. The picker controls four things that the input cannot
 * see from its own props, through the input's private seams. Its focus boundary is the input
 * together with the popup; see `date-input-boundary.ts`. Its neighbor lookup moves focus from a
 * range's start on to its end; see `date-input-neighbors.ts`. Its form reset runs with the picker's;
 * see `date-input-reset.ts`. The picker also supplies its kind; see `date-input-kind.ts`.
 * Everything else goes through `DateInput.Root`'s public props: its value, change, settings and
 * validity.
 *
 * The group is the named field box, so the input renders as a presentational row that paints no
 * box and leaves its naming to the segments, which keep names such as "month, Start date". Its
 * `render` state tells the picker whether the input shows as invalid.
 */
export function PickerDateInput({
  className,
  onInvalidChange,
  ...props
}: PickerDateInputProps): ReactElement {
  const shell = usePickerShellContext("DatePicker.Input");
  const inputClass = datePickerVariants({ range: shell.range }).input();
  // A value keeps its own kind and zone, so a range's end in another zone than its start shows,
  // pastes and steps in its own zone. An empty input forms the picker's kind. A new kind object each
  // render is fine, because the input keeps the object it has while the picker supplies an equal
  // one; see `useValueKind`.
  const kind = endKind(endOfValue(props.value ?? null), shell.kind);

  return (
    // The picker's inputs are one run of segments for focus: a range's start moves on to its end.
    <DateInputNeighborContext value={shell.adjacentInput}>
      <DateInputBoundaryContext value={shell.inputBoundary}>
        <DateInputResetContext value={shell.resetOwner}>
          <DateInputKindContext value={kind}>
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
          </DateInputKindContext>
        </DateInputResetContext>
      </DateInputBoundaryContext>
    </DateInputNeighborContext>
  );
}
