"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useStableCallback } from "../../hooks/use-stable-callback";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import type { TemporalValue, ValueKind } from "../../temporal/temporal-value";
import { DateInputRoot } from "../date-field/date-input";
import type { DateInputValue } from "../date-field/date-input";
import type { DateInputValueChangeEventDetails } from "../date-field/date-input-change-details";
import { DateInputScopeContext } from "../date-field/date-input-scope";
import type { DateInputScope } from "../date-field/date-input-scope";
import type { KindFromValue } from "../date-field/date-kind-props";
import { datePickerVariants } from "./date-picker-variants";
import { datePickerStrings } from "./intl";
import { endDay, endKind, endTime } from "./picker-draft";
import type { EndpointDraft } from "./picker-draft";
import type { PickerInputPartProps, PickerTimeSettings } from "./picker-root";

const styles = datePickerVariants();

/**
 * What a picker Root binds one popup time input to, memoized by `usePickerTimeBinding` so the input
 * keeps its settings while they hold.
 */
export type PickerTimeBinding = {
  /** The value whose time the input shows: the end's value, or a time held for it (`endTime`). */
  readonly value: TemporalValue | null;
  /** The day the end holds, which a typed time forms on; `null` for the stand-in day (`endDay`). */
  readonly day: Temporal.PlainDate | null;
  /** The kind the input's values take (`endKind`), the one source of its kind. */
  readonly kind: ValueKind;
  /** The Root's time change for this input. */
  readonly onValueChange: (value: TemporalValue | null, details: DateInputValueChangeEventDetails) => void;
};

/**
 * A Root's binding for one end's popup time input: what it shows, the day a typed time forms on,
 * the kind it forms it in, and its change, one object while the end's draft and the kind hold.
 *
 * @param draft - The end's draft.
 * @param kind - The picker's kind now.
 * @param onValueChange - The Root's time change for this input; read when it fires, so a new
 *   function each render keeps the binding.
 * @returns The binding.
 */
export function usePickerTimeBinding(
  draft: EndpointDraft,
  kind: ValueKind,
  onValueChange: PickerTimeBinding["onValueChange"]
): PickerTimeBinding {
  const change = useStableCallback(onValueChange);
  return useMemo(
    (): PickerTimeBinding => ({
      value: endTime(draft, kind),
      day: endDay(draft),
      kind: endKind(draft, kind),
      onValueChange: change,
    }),
    [draft, kind, change]
  );
}

/** A picker's time input: the part's presentation props and what its Root binds it to. */
export type PickerTimeInputProps = PickerInputPartProps & {
  /** The Root's binding for this input. */
  readonly binding: PickerTimeBinding;
  /** What the Root's time inputs forward, or `null` while its values have no time to show. */
  readonly settings: PickerTimeSettings | null;
  /** The key of the input's default name in `datePickerStrings`. */
  readonly label: "time" | "startTime" | "endTime";
  /** The Root's form-reset generation, which remounts the input and its Field. */
  readonly resetKey: number;
};

/**
 * A time input in a picker's popup: a `DateInput.Root` that shows only the time segments of the
 * value the picker holds, as React Spectrum's picker shows a time field under its calendar. It
 * renders nothing while the picker's values have no time to show. It sits in a Base UI Field of
 * its own, so it is no second control of the picker's Field: it submits nothing, and its own
 * validity (a half-typed time on blur) never marks the picker. Its value carries the picker's day,
 * and the picker takes only its time.
 */
export function PickerTimeInput({
  binding,
  settings,
  label,
  resetKey,
  className,
  ...props
}: PickerTimeInputProps): ReactElement | null {
  const strings = useLocalizedStrings(datePickerStrings);
  const { day, kind } = binding;
  // One scope per day and kind, so the input's settings keep their identity while they hold.
  const scope = useMemo((): DateInputScope => ({ units: "time", day, kind }), [day, kind]);
  if (settings === null) {
    return null;
  }
  return (
    <FieldPrimitive.Root
      // A form reset remounts the time input and its Field, as it does the picker's own input, so a
      // half-typed time and its shown error start over.
      key={resetKey}
      className={styles.timeField()}
      disabled={settings.disabled}>
      <DateInputScopeContext value={scope}>
        <DateInputRoot<KindFromValue, DateInputValue>
          aria-label={strings.format(label)}
          {...definedProps(props)}
          value={binding.value}
          onValueChange={binding.onValueChange}
          {...settings}
          data-slot="date-picker-time-input"
          className={cn(styles.timeInput(), className)}
        />
      </DateInputScopeContext>
    </FieldPrimitive.Root>
  );
}
