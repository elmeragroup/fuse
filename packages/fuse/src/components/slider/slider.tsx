"use client";

import { useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useResetRemount } from "../../hooks/use-reset-remount";
import { definedProps } from "../../internal/defined-props";
import { useLocale } from "../../intl/locale-context";
import { cn } from "../../styles/cn";
import { FieldLabel } from "../field/field";
import { FieldFrame, fieldFrameVariants } from "../field/field-frame";
import { sliderStrings } from "./intl";
import { sliderVariants } from "./slider-variants";

/**
 * The shape of a slider's value: a single number, or one number per thumb for a range. A range
 * holds at least two numbers, since base-ui treats a one-number array as a single value.
 */
export type SliderValue = number | readonly [number, number, ...number[]];

/**
 * What `onChange` reports: a number for a single value, and for a range the value's own array
 * shape with each element widened to `number`, since moving a thumb changes it. A
 * `readonly [20, 80]` range reports `readonly [number, number]`.
 */
type ReportedValue<Value extends SliderValue> = Value extends number
  ? number
  : { [K in keyof Value]: number };

export type SliderProps<Value extends SliderValue = number> = {
  /** Visible label, rendered as `Field.Label`; it names the thumb of a single-value slider. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows its own validation error instead.
   */
  errorMessage?: ReactNode;
  /** Forwards `invalid` to `Field.Root`; the thumb shows the invalid state face. */
  isInvalid?: boolean;
  /** Forwards `disabled` to `Field.Root` and `Slider.Root`; the thumb shows the disabled state face. */
  isDisabled?: boolean;
  /**
   * Controlled value. `Value` is a `number`, or an array of at least two numbers with one value
   * per thumb for a range. A one-number array from untyped code is read as that number, so
   * `onChange` reports a number. `undefined`, passed or omitted, is uncontrolled, as with
   * React's own inputs.
   */
  value?: Value;
  /**
   * Uncontrolled initial value. An array of two or more numbers renders one thumb per entry; a
   * one-number array is read as that number. It is read on mount and again on a native form
   * reset, as React reads its own inputs' defaults.
   */
  defaultValue?: Value;
  /**
   * Called with the new value on every change while it moves. A range keeps the shape of
   * `value`, with each element widened to `number`. A native form reset does not call it.
   */
  onChange?: (value: ReportedValue<Value>) => void;
  /** Lower bound, forwarded as base-ui `min`. Defaults to 0. */
  minValue?: number;
  /** Upper bound, forwarded as base-ui `max`. Defaults to 100. */
  maxValue?: number;
  /** Step for the arrow keys and the snap grid, counted from `minValue`. Defaults to 1. */
  step?: number;
  /** Step for PageUp, PageDown and Shift with an arrow. Defaults to 10. */
  largeStep?: number;
  /** Layout axis. A vertical slider fills its parent's height, and its control below the label row keeps at least 160px. */
  orientation?: "horizontal" | "vertical";
  /**
   * Formatting options for the shown value and each thumb's `aria-valuetext`, forwarded as
   * base-ui `format`. Locale comes from the provider.
   */
  formatOptions?: Intl.NumberFormatOptions;
  /** Shows the formatted value at the end of the label row; a range joins its values with an en dash. */
  showValue?: boolean;
  /**
   * Accessible names of a range's thumbs, by index. Defaults to the locale dictionary's
   * minimum and maximum, joined to `label` or `aria-label`. A single thumb takes its name
   * from `label` or `aria-label` instead.
   */
  thumbLabels?: readonly string[];
  /** Native `name` forwarded to the primitive, so the value submits with a form. */
  name?: string;
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Accessible name for label-less usage. A range joins it to each thumb's name. */
  "aria-label"?: string;
};

/** FieldFrame's own slots: the label row, and the 4px stack between the label and the control. */
const frameSlots = fieldFrameVariants();

/**
 * Unwraps a one-number array to its number. base-ui's keyboard path treats any array as a
 * range while its pointer path treats one number as a single value, so untyped callers that
 * pass `[50]` would see `onChange` switch shape.
 */
function asSliderValue<Value extends SliderValue>(input: Value | undefined): Value | undefined {
  // SAFETY: a one-number array only reaches here from untyped code, and the single value it
  // holds is the shape base-ui's pointer path already reports for it.
  return Array.isArray(input) && input.length === 1 ? (input[0] as Value) : input;
}

/**
 * Base UI nests the thumb's range input itself and takes no props for it beyond a ref, so the
 * ref marks it as the control the within-target focus ring on the thumb reads.
 */
function markFocusRingControl(input: HTMLInputElement | null): void {
  input?.setAttribute("data-focus-ring-control", "");
}

/**
 * Labeled slider composite over Field + base-ui Slider, for a single value or a range.
 * Client. Base UI owns the value and the pointer and keyboard handling, and the range
 * thumbs read their default names from the locale dictionary.
 */
export function Slider<Value extends SliderValue = number>({
  label,
  description,
  errorMessage,
  isInvalid = false,
  isDisabled = false,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  step,
  largeStep,
  orientation = "horizontal",
  formatOptions,
  showValue = false,
  thumbLabels,
  name,
  className,
  "aria-label": ariaLabel,
}: SliderProps<Value>): ReactElement {
  const { locale } = useLocale();
  const strings = useLocalizedStrings(sliderStrings);
  const slots = sliderVariants({ orientation });
  // The reset hook follows the range input of the thumb that last took focus, so a reset
  // that remounts the root hands focus back to the same thumb.
  const thumbInputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusedThumb = useRef(0);
  const resetTarget = useRef<HTMLInputElement | null>(null);
  // base-ui does not observe native form reset; the hook remounts the primitive instead.
  const reset = useResetRemount(resetTarget, value === undefined);
  const thumbInputRef = (index: number, thumbCount: number) => (input: HTMLInputElement | null) => {
    markFocusRingControl(input);
    thumbInputs.current[index] = input;
    // A remount onto fewer thumbs hands focus to the last one left, so its input attaches as
    // the reset target before the hook restores focus.
    focusedThumb.current = Math.min(focusedThumb.current, thumbCount - 1);
    if (index === focusedThumb.current) {
      resetTarget.current = input;
    }
  };
  const thumbName = (index: number, thumbCount: number): string | undefined => {
    if (thumbCount === 1) {
      return ariaLabel;
    }
    const vars = { name: label ?? ariaLabel ?? "", position: index + 1 };
    const key = index === 0 ? "rangeStart" : index === thumbCount - 1 ? "rangeEnd" : "rangeThumb";
    return thumbLabels?.[index] ?? strings.format(key, vars);
  };

  return (
    <FieldFrame
      spacing="part"
      className={cn(slots.frame(), className)}
      invalid={isInvalid}
      disabled={isDisabled}
      description={description}
      errorMessage={errorMessage}>
      <SliderPrimitive.Root<Value>
        key={reset.key}
        data-slot="slider"
        orientation={orientation}
        locale={locale}
        disabled={isDisabled}
        // SAFETY: base-ui reports the value in the shape it was given, and the reported type
        // only widens that shape's elements to `number`.
        onValueChange={(next) => onChange?.(next as ReportedValue<Value>)}
        className={cn(frameSlots.content(), slots.root())}
        {...definedProps({
          value: asSliderValue(value),
          defaultValue: asSliderValue(defaultValue),
          min: minValue,
          max: maxValue,
          step,
          largeStep,
          format: formatOptions,
          name,
        })}>
        {/* The label sits inside Slider.Root so the value beside it can read the slider's state;
            Field.Root above still owns the label id that names a single thumb. */}
        {label || showValue ? (
          <div className={frameSlots.labelRow()}>
            {label ? <FieldLabel>{label}</FieldLabel> : null}
            {showValue ? <SliderPrimitive.Value data-slot="slider-value" className={slots.value()} /> : null}
          </div>
        ) : null}
        <SliderPrimitive.Control
          data-slot="slider-control"
          className={slots.control()}
          // The thumbs follow base-ui's live values, not the latest `defaultValue`: an
          // uncontrolled slider keeps the value it mounted with.
          render={(controlProps, state) => (
            <div {...controlProps}>
              <SliderPrimitive.Track data-slot="slider-track" className={slots.track()}>
                <SliderPrimitive.Indicator data-slot="slider-indicator" className={slots.indicator()} />
              </SliderPrimitive.Track>
              {state.values.map((_, index) => (
                <SliderPrimitive.Thumb
                  key={index}
                  index={index}
                  data-slot="slider-thumb"
                  inputRef={thumbInputRef(index, state.values.length)}
                  // The thumb's name carries its position, so the value text is the formatted
                  // value alone, not base-ui's English "start range" suffix.
                  getAriaValueText={(formattedValue) => formattedValue}
                  onFocus={() => {
                    focusedThumb.current = index;
                    resetTarget.current = thumbInputs.current[index] ?? null;
                  }}
                  className={slots.thumb()}
                  {...definedProps({ "aria-label": thumbName(index, state.values.length) })}
                />
              ))}
            </div>
          )}
        />
      </SliderPrimitive.Root>
    </FieldFrame>
  );
}

Slider.displayName = "Slider";
