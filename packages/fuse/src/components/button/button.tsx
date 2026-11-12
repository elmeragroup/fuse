"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "tailwind-variants";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { usePredictedEvents } from "../../hooks/use-predicted-events";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { buttonVariants } from "./button-variants";

/** Every Button `size`: the label sizes and the square `icon*` sizes. */
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/** The square icon-only sizes. A button at one of them requires an `aria-label`. */
export type IconButtonSize = Extract<ButtonSize, `icon${string}`>;

/** The label sizes: `xs`, `sm`, `default` and `lg`. */
export type LabelButtonSize = Exclude<ButtonSize, IconButtonSize>;

type ButtonPrimitiveProps = Omit<ComponentProps<typeof ButtonPrimitive>, "className">;

type ButtonSharedProps = ButtonPrimitiveProps & {
  /**
   * The label and icons. Mark a leading icon with `data-icon="inline-start"` and a trailing one
   * with `data-icon="inline-end"`, and that side takes the narrower icon padding. Your own icon
   * components must pass `data-icon` through to the element they render. An SVG without a
   * `size-*` class renders at 16px, or 12px at the `xs` and `icon-xs` sizes. Any `size-*` class
   * opts out, `size-auto` included, and `w-*` or `h-*` alone does not. An SVG without a `viewBox`
   * clips at that size instead of scaling. Give it `size-auto` to keep its own `width` and
   * `height`, or restore the `viewBox`.
   */
  children?: ReactNode;
  /**
   * The fill and text colour. The theme sets the `outline` border. `link` looks like an inline
   * text link.
   */
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /**
   * Extra classes, merged last through `cn`. A `px-*` class replaces the label padding only. The
   * icon side keeps its own padding, which `has-data-[icon=inline-start]:pl-*` or
   * `has-data-[icon=inline-end]:pr-*` replaces.
   */
  className?: string;
  /**
   * Makes the button look and announce disabled while it stays interactive. It stamps
   * `aria-disabled`, and an explicit `aria-disabled` wins. Click, keyboard and focus still work,
   * and a Tooltip on the button still opens. Use it for an action that explains on activation
   * why it is unavailable.
   */
  isVisuallyDisabled?: boolean;
  /**
   * Marks an action in flight. The button blocks activation, dims, and stamps `data-pending` and
   * `aria-busy`. It stays in the focus order, so a keyboard user is still on it when the result
   * arrives. `focusableWhenDisabled={false}` takes it out of the focus order. `aria-busy`
   * announces nothing, so say what is happening in the label, such as "Saving", or in a
   * `role="status"` region outside the button. Put a label that changes with the state in its
   * own element, such as `<span>{label}</span>`: page translation replaces a bare text child
   * with its own nodes, so React's update to the old text node never shows.
   */
  isPending?: boolean;
  /**
   * What a pending button shows in its leading icon position. When you omit it, a spinner shows
   * there and the button's leading and bare icons hide, while a `data-icon="inline-end"` icon
   * stays. A node replaces the spinner and does not animate on its own. `null` or `false` shows
   * nothing and hides nothing, so the call site draws its own pending state. Fade that content
   * with `group-data-pending/button:opacity-0`, not `invisible`, which drops the label from the
   * accessible name, and give an overlay no `data-icon`.
   */
  pendingIndicator?: ReactNode;
  /** Pixels added to every side of the hit rect when predicting pointer intent. */
  predictionZoneSize?: number;
  /**
   * Fires once when the pointer's predicted path enters the inflated hit rect, for prefetching.
   * Browsers without pointer prediction never fire it.
   */
  onIntent?: () => void;
};

/**
 * The props of a button with a visible label, at a label size. A wrapper that supplies its own
 * label types its props as `Omit<LabelButtonProps, "children">`.
 */
export type LabelButtonProps = ButtonSharedProps & {
  /** The height and padding. The `icon*` sizes are square and require an `aria-label`. */
  size?: LabelButtonSize;
};

/** The props of a square icon-only button: an `icon*` size and the `aria-label` that names it. */
export type IconButtonProps = ButtonSharedProps & {
  /** The height and padding. The `icon*` sizes are square and require an `aria-label`. */
  size: IconButtonSize;
  "aria-label": string;
};

/**
 * `LabelButtonProps | IconButtonProps`. `Omit` on this union collapses it and lets an icon size
 * through without its name. Omit from {@link LabelButtonProps} or {@link IconButtonProps}
 * instead, or distribute the omit over the union.
 */
export type ButtonProps = LabelButtonProps | IconButtonProps;

/**
 * Triggers an action. `children` lists the icon rules. To render a link, pass
 * `render={<a href="…" />}` and `nativeButton={false}`.
 */
export function Button({
  className,
  variant = "default",
  size = "default",
  isVisuallyDisabled = false,
  disabled = false,
  isPending = false,
  pendingIndicator,
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
  // `null` and `false` opt out of the indicator and of the icon swap; every other value, `0`
  // included, is a node to show, and `undefined` is the default spinner.
  const showsIndicator = isPending && pendingIndicator !== null && pendingIndicator !== false;

  return (
    <ButtonPrimitive
      data-slot="button"
      data-size={size}
      data-pending={isPending || undefined}
      // Present only while an indicator renders: the recipe's icon swap keys off it, so a
      // `null` indicator hides nothing.
      data-pending-indicator={showsIndicator || undefined}
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
      {children}
      {showsIndicator ? (
        // Decorative: the state is announced through aria-busy and the label. The slot is a
        // leading icon, so the icon edge tightens the start inset as for any inline-start child,
        // and the recipe hides the button's own leading and bare SVG children while it shows. A
        // consumer's node rides in the same slot, so it gets the same place and the same
        // aria-hidden; only the default spinner animates. `null` never reaches this branch, so
        // the coalescing only fills in `undefined`.
        // It renders after the children and `order-first` moves it to the leading edge, so React
        // appends it instead of inserting it before the first child. Page translation (Chrome's
        // built-in translate) replaces a bare text child with its own `<font>` nodes, and an
        // insert before the detached text node threw `NotFoundError` and unmounted the tree.
        // `order` needs the root's flex layout, so a `className` that replaces `inline-flex` with
        // `block` or `inline-block` moves the indicator after the label.
        <span
          data-slot="button-pending-indicator"
          data-icon="inline-start"
          aria-hidden
          className="pointer-events-none order-first inline-flex shrink-0 items-center justify-center">
          {pendingIndicator ?? <SpinnerGap className="animate-spin" />}
        </span>
      ) : null}
    </ButtonPrimitive>
  );
}

Button.displayName = "Button";
