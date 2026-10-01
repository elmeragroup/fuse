"use client";

import type { ComponentProps, ReactElement } from "react";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "tailwind-variants";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { usePredictedEvents } from "../../hooks/use-predicted-events";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { buttonVariants } from "./button-variants";

/** Every `size` the Button recipe knows: the label sizes plus the square `icon*` sizes. */
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/** The square icon-only sizes. A button at one of these requires an `aria-label`. */
export type IconButtonSize = Extract<ButtonSize, `icon${string}`>;

/** The label sizes: `xs`, `sm`, `default` and `lg`. */
export type LabelButtonSize = Exclude<ButtonSize, IconButtonSize>;

type ButtonPrimitiveProps = Omit<ComponentProps<typeof ButtonPrimitive>, "className">;

type ButtonSharedProps = ButtonPrimitiveProps &
  Omit<VariantProps<typeof buttonVariants>, "size"> & {
    /** Extra classes, merged last through `cn`. */
    className?: string;
    /**
     * Stamps `aria-disabled` (an explicit consumer value wins), which renders the disabled
     * treatment (`opacity-50`, the `not-allowed` cursor, no hover or press paint), and
     * suppresses focus-on-press while the button stays fully interactive — click, keyboard
     * and focus-visible all still work, and a Tooltip on it still opens. For "looks
     * disabled but explains itself on activation" flows. The treatment keys off
     * `aria-disabled`, so an explicit `aria-disabled={false}` also turns it off: the button
     * then looks and announces enabled and only the focus-on-press suppression remains.
     */
    isVisuallyDisabled?: boolean;
    /**
     * The in-flight state of an async action. Stamps `data-pending` and `aria-busy`, blocks
     * activation (effective disabled is `disabled || isPending`) and renders the disabled
     * treatment, but keeps the button in the focus order like `focusableWhenDisabled`, so a
     * keyboard user who activated it is still on it when the result arrives. Shows a spinning
     * `SpinnerGap` in the leading icon position and hides any direct SVG child meanwhile, so the
     * spinner takes an icon's place and a hand-placed spinner is not doubled. An explicit
     * `focusableWhenDisabled={false}` restores the native `disabled` attribute while pending.
     * `aria-busy` announces nothing by itself: say what is happening through the label
     * ("Saving") or a `role="status"` region.
     */
    isPending?: boolean;
    /** Pixels the hit rect is inflated on every side when predicting pointer intent. */
    predictionZoneSize?: number;
    /**
     * Predictive-prefetch callback. Fires once when the pointer's predicted trajectory
     * lands inside the inflated hit rect; browsers without the prediction API fail soft.
     */
    onIntent?: () => void;
  };

/**
 * The props of a button with a visible label: every size except the square `icon*` ones, so
 * an accessible name is optional. A wrapper that supplies its own label types its props as
 * `Omit<LabelButtonProps, "children">` and keeps the size union in sync with the recipe.
 */
export type LabelButtonProps = ButtonSharedProps & {
  /** Recipe size axis. The `icon*` sizes are square and additionally require an `aria-label`. */
  size?: LabelButtonSize;
};

/**
 * The props of a square icon-only button: one of the `icon*` sizes plus the `aria-label` that
 * names it, since the icon is the whole content.
 */
export type IconButtonProps = ButtonSharedProps & {
  /** Recipe size axis. The `icon*` sizes are square and additionally require an `aria-label`. */
  size: IconButtonSize;
  "aria-label": string;
};

/**
 * `LabelButtonProps | IconButtonProps`. `Omit` on this union collapses it and lets an icon
 * size through without its name; omit from {@link LabelButtonProps} or
 * {@link IconButtonProps} instead, or distribute the omit over the union.
 */
export type ButtonProps = LabelButtonProps | IconButtonProps;

export function Button({
  className,
  variant,
  size,
  isVisuallyDisabled = false,
  disabled = false,
  isPending = false,
  predictionZoneSize = 30,
  onIntent,
  onMouseDown,
  children,
  ref,
  ...props
}: ButtonProps): ReactElement {
  const { ref: predictedRef } = usePredictedEvents({
    predictionZoneSize,
    onIntent,
    enabled: !disabled && !isPending && !isVisuallyDisabled && onIntent !== undefined,
  });
  const mergedRef = useMergedRefs(ref, onIntent === undefined ? null : predictedRef);

  return (
    <ButtonPrimitive
      data-slot="button"
      data-pending={isPending || undefined}
      disabled={disabled || isPending}
      // A pending button stays in the focus order and announces busy: Base UI then drops the
      // native `disabled`, stamps `aria-disabled` and `data-disabled` and still cancels click
      // and keyboard activation. Both keys are omitted, not undefined, when not pending, so a
      // consumer's own `focusableWhenDisabled` for a plain `disabled` button flows through the
      // later {...definedProps(props)} spread, where an explicit value also wins while pending.
      {...definedProps({
        focusableWhenDisabled: isPending || undefined,
        "aria-busy": isPending || undefined,
      })}
      // Announced as unavailable without being disabled: the button still activates so
      // the flow that explains itself can run. An explicit consumer value wins through the
      // later {...definedProps(props)} spread. When not visually disabled the key is omitted,
      // not undefined, so Base UI's own aria-disabled (focusableWhenDisabled, non-native
      // disabled) survives.
      {...definedProps({ "aria-disabled": isVisuallyDisabled || undefined })}
      className={cn(buttonVariants({ variant, size }), className)}
      onMouseDown={(event) => {
        if (isVisuallyDisabled) {
          event.preventDefault();
        }
        onMouseDown?.(event);
      }}
      // Filtered so a forwarded undefined cannot erase what Base UI's Button sets itself,
      // such as aria-disabled, type and role.
      {...definedProps(props)}
      ref={mergedRef}>
      {isPending ? (
        // Decorative: the state is announced through aria-busy and the label. The spinner is a
        // leading icon, so the icon edge tightens the start inset as for any inline-start child,
        // and the recipe hides the other direct SVG children while it shows.
        <SpinnerGap
          data-slot="button-pending-indicator"
          data-icon="inline-start"
          aria-hidden
          className="animate-spin"
        />
      ) : null}
      {children}
    </ButtonPrimitive>
  );
}

Button.displayName = "Button";
