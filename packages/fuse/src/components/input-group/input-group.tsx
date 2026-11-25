"use client";

import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { OWN_CLICK_SELECTOR } from "../../internal/own-click";
import { cn } from "../../styles/cn";
import { fieldReads } from "../../styles/field-size";
import { Button } from "../button/button";
import { InputControl } from "../input/input";
import type { InputControlProps } from "../input/input";
import { inputClass } from "../input/input-class";
import { textareaClass } from "../textarea/textarea-class";
import { inputGroupControlClass, inputGroupInputControlClass } from "./input-group-class";
import {
  inputGroupAddonVariants,
  inputGroupButtonVariants,
  inputGroupRootVariants,
} from "./input-group-variants";

/**
 * The empty attribute on the group's own control. The addon finds the control by it rather than
 * by `data-slot`, because a consumer may give the control its own `data-slot` as a styling hook.
 */
const CONTROL_ATTRIBUTE = "data-input-group-control";

/**
 * Marks the group's own control for `InputGroup.Addon`. Each part that renders the control takes
 * it after the consumer's props. A Base UI part takes it in its own props, not on its `render`
 * element, so a consumer's `render` replacement carries it too.
 */
export const INPUT_GROUP_CONTROL_MARKER = { [CONTROL_ATTRIBUTE]: "" } as const;

/** Props for `InputGroup.Root`. */
export type InputGroupRootProps = Omit<ComponentProps<"div">, "children"> & {
  /**
   * The control size, also written as `data-size`. `default` is the md control size, and `sm`
   * the sm one. The group's input, addon text and `icon-sm` buttons follow it.
   */
  size?: "sm" | "default";
  /**
   * One `InputGroup.Input` or `InputGroup.Textarea` and its `InputGroup.Addon` rails. Keep the
   * input or textarea a direct child: the group paints its disabled, read-only and invalid look
   * from that child alone, so a field nested in an addon, such as a `NumberField`, keeps its
   * state to itself. To make the whole field unavailable, disable the input or textarea. A
   * disabled addon button leaves the field enabled.
   */
  children?: ComponentProps<"div">["children"];
};

/** Props for `InputGroup.Addon`. */
export type InputGroupAddonProps = Omit<ComponentProps<"div">, "children"> &
  VariantProps<typeof inputGroupAddonVariants> & {
    /**
     * Where the rail sits, also written as `data-align`. `inline-start` and `inline-end` put it
     * before or after the control on its line. `block-start` and `block-end` make it a
     * full-width row above or below the control.
     */
    align?: VariantProps<typeof inputGroupAddonVariants>["align"];
    /**
     * An icon, `InputGroup.Text`, a `kbd`, or a few `InputGroup.Button`s that act on the
     * control. A click on the rail outside them focuses the control. A `Field.Description` here
     * still describes the control, so a looked-up value, such as a city beside a postcode, is
     * read with it. The rail has no role, so pass `role="group"` and `aria-label` when its
     * buttons need a shared name.
     */
    children?: ComponentProps<"div">["children"];
  };

type InputGroupButtonSize = NonNullable<VariantProps<typeof inputGroupButtonVariants>["size"]>;
type IconInputGroupButtonSize = Extract<InputGroupButtonSize, `icon${string}`>;
type LabelInputGroupButtonSize = Exclude<InputGroupButtonSize, IconInputGroupButtonSize>;

type InputGroupButtonBase = Omit<ComponentProps<typeof Button>, "size" | "type"> & {
  /**
   * The native button type. An addon button submits the surrounding form only when it is
   * `submit`.
   */
  type?: "button" | "submit" | "reset";
};

export type InputGroupButtonProps =
  | (InputGroupButtonBase & {
      /**
       * The button size, smaller than Button's sizes so the button fits in the field box. `xs` is
       * the xs control height, at least 24px, and `sm` the group's field height.
       */
      size?: LabelInputGroupButtonSize;
    })
  | (InputGroupButtonBase & {
      /**
       * `icon-xs` is an xs square, at least 24px, and `icon-sm` the group's inner square, which
       * follows the group's `size`. An icon size needs `aria-label`.
       */
      size: IconInputGroupButtonSize;
      "aria-label": string;
    });
/** Props for `InputGroup.Text`. */
export type InputGroupTextProps = ComponentProps<"span">;
/**
 * Props for `InputGroup.Input`, which are `Input`'s props without its field size. The group's input
 * reads the size of the group around it, and keeps the native numeric `size` attribute.
 */
export type InputGroupInputProps = Omit<InputControlProps, "aria-label"> & {
  /**
   * The input's name when no visible label names it. For a visible label, put the group in a
   * `Field.Root` with a `Field.Label`. The `Field.Root` also marks the input invalid, and the group
   * paints the invalid look from it.
   */
  "aria-label"?: InputControlProps["aria-label"];
};
/** Props for `InputGroup.Textarea`. */
export type InputGroupTextareaProps = Omit<ComponentProps<"textarea">, "aria-label"> & {
  /**
   * The textarea's name. A `Field.Root` around the group does not wire the textarea to its
   * `Field.Label`, so name it here or with `aria-labelledby`.
   */
  "aria-label"?: ComponentProps<"textarea">["aria-label"];
};

/** A field box that joins a control with icons, text and buttons. */
export function InputGroupRoot({ className, size = "default", ...props }: InputGroupRootProps): ReactElement {
  return (
    <div
      data-slot="input-group"
      role="group"
      data-size={size}
      className={cn(inputGroupRootVariants({ size }), className)}
      {...props}
    />
  );
}

/**
 * A rail inside the field box. It publishes `--inner-corner`, the field corner less its inset, for
 * its buttons, its kbd and any part that rounds with `rounded-inner`. It has no role, because an
 * unnamed group inside the Root's group adds a container level for some screen readers and
 * announces nothing.
 */
export function InputGroupAddon({
  className,
  align = "inline-start",
  onClick,
  ...props
}: InputGroupAddonProps): ReactElement {
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- the addon's own click only widens the pointer hit area of the Root's control, which keyboard users focus directly; a role or key handler here would duplicate that control (#568)
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(event) => {
        // The addon is an extension of the group's own control's hit area, except over a
        // nested control, such as a button, a label or a field, which keeps its own click and
        // focus, and except for a click that bubbles through React from a portaled popup.
        // The own control is the Root's direct child that carries `INPUT_GROUP_CONTROL_MARKER`.
        // The first input in DOM order can be a field nested in an addon or a combobox's hidden
        // input, and a Textarea group has no input at all.
        const { currentTarget, target } = event;
        if (
          target instanceof Element &&
          currentTarget.contains(target) &&
          !currentTarget.contains(target.closest(OWN_CLICK_SELECTOR))
        ) {
          currentTarget.parentElement?.querySelector<HTMLElement>(`:scope > [${CONTROL_ATTRIBUTE}]`)?.focus();
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}

/** A compact button inside an addon. */
export function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: InputGroupButtonProps): ReactElement {
  return (
    <Button
      type={type}
      // The local compact axis is never Button's `size` prop. The recipe applies it as extra
      // classes, and `data-size` reflects it to the DOM.
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

/** Muted text in an addon, such as a prefix or a unit. */
export function InputGroupText({ className, ...props }: InputGroupTextProps): ReactElement {
  return (
    <span
      // ButtonGroup's `[data-slot]` child selectors need this slot.
      data-slot="input-group-text"
      className={cn(
        fieldReads.type(),
        "flex items-center gap-2 text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/** The group's single-line input. It takes Input's `filter`. */
export function InputGroupInput({ className, ...props }: InputGroupInputProps): ReactElement {
  return (
    <InputControl
      data-slot="input-group-control"
      data-focus-ring-control=""
      className={cn(inputClass, inputGroupInputControlClass, className)}
      {...props}
      {...INPUT_GROUP_CONTROL_MARKER}
    />
  );
}

/**
 * `InputGroup.Input`'s look on a plain `<input>`, for a Base UI part that wires the Field itself,
 * such as `Combobox.Input`. `InputGroup.Input` renders `Field.Control`, which would name the input
 * after the Field and submit its text beside the part's own hidden input.
 */
export function InputGroupPlainInput({ className, ...props }: ComponentProps<"input">): ReactElement {
  return (
    <input
      data-slot="input-group-control"
      data-focus-ring-control=""
      className={cn(inputClass, inputGroupInputControlClass, className)}
      {...props}
      {...INPUT_GROUP_CONTROL_MARKER}
    />
  );
}

/**
 * A textarea with Textarea's look and no field size of its own, so it reads the group's size.
 */
export function InputGroupTextarea({ className, ...props }: InputGroupTextareaProps): ReactElement {
  return (
    <textarea
      data-slot="input-group-control"
      data-focus-ring-control=""
      className={cn(textareaClass, inputGroupControlClass, "resize-none py-2", className)}
      {...props}
      {...INPUT_GROUP_CONTROL_MARKER}
    />
  );
}

InputGroupRoot.displayName = "InputGroup.Root";
InputGroupAddon.displayName = "InputGroup.Addon";
InputGroupButton.displayName = "InputGroup.Button";
InputGroupText.displayName = "InputGroup.Text";
InputGroupInput.displayName = "InputGroup.Input";
InputGroupPlainInput.displayName = "InputGroupPlainInput";
InputGroupTextarea.displayName = "InputGroup.Textarea";
