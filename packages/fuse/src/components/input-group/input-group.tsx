"use client";

import type { ComponentProps, ReactElement } from "react";

import type { VariantProps } from "tailwind-variants";

import { OWN_CLICK_SELECTOR } from "../../internal/own-click";
import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import { inputGroupRootClass } from "../../styles/field-box";
import { Button } from "../button/button";
import { Input } from "../input/input";
import type { InputProps } from "../input/input";
import { inputClass } from "../input/input-class";
import { Textarea } from "../textarea/textarea";
import { inputGroupControlClass, inputGroupInputControlClass } from "./input-group-class";
import { inputGroupAddonVariants, inputGroupButtonVariants } from "./input-group-variants";

/**
 * Group chrome follows the disabled, read-only and invalid state of its own input or textarea,
 * independently of addon buttons. Keep `InputGroup.Input` or `InputGroup.Textarea` a direct
 * child of the root: the group reads its state from that child only, so a field nested in an
 * addon, such as a NumberField, keeps its state to itself.
 */
export type InputGroupRootProps = ComponentProps<"div">;
export type InputGroupAddonProps = ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>;

type InputGroupButtonSize = NonNullable<VariantProps<typeof inputGroupButtonVariants>["size"]>;
type IconInputGroupButtonSize = Extract<InputGroupButtonSize, `icon${string}`>;
type LabelInputGroupButtonSize = Exclude<InputGroupButtonSize, IconInputGroupButtonSize>;

type InputGroupButtonBase = Omit<ComponentProps<typeof Button>, "size" | "type"> & {
  /**
   * Native button type, re-typed over `Button`'s own. Defaults to `"button"`, so an
   * addon action never submits the surrounding form unless it asks to.
   */
  type?: "button" | "submit" | "reset";
};

export type InputGroupButtonProps =
  | (InputGroupButtonBase & {
      /**
       * Local compact size axis, not Button's `size`. Labelled values; icon
       * sizes require `aria-label`.
       * @default "xs"
       */
      size?: LabelInputGroupButtonSize;
    })
  | (InputGroupButtonBase & {
      /**
       * Local compact size axis, not Button's `size`. Icon sizes require
       * `aria-label`.
       */
      size: IconInputGroupButtonSize;
      "aria-label": string;
    });
export type InputGroupTextProps = ComponentProps<"span">;
export type InputGroupInputProps = InputProps;
export type InputGroupTextareaProps = ComponentProps<"textarea">;

export function InputGroupRoot({ className, ...props }: InputGroupRootProps): ReactElement {
  return (
    <div data-slot="input-group" role="group" className={cn(inputGroupRootClass, className)} {...props} />
  );
}

/**
 * An addon rail inside the field box. It publishes `--inner-corner` for its buttons, its kbd and
 * any part that rounds with `rounded-inner`: the field corner less its inset.
 */
export function InputGroupAddon({
  className,
  align = "inline-start",
  onClick,
  ...props
}: InputGroupAddonProps): ReactElement {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(event) => {
        // The addon is an extension of the group's own control's hit area, except over a
        // nested control, such as a button, a label or a field, which keeps its own click and
        // focus, and except for a click that bubbles through React from a portalled popup.
        // The own control is the Root's direct input-group-control child: the first input in
        // DOM order can be a field nested in an addon or a combobox's hidden input, and a
        // Textarea group has no input at all.
        const { currentTarget, target } = event;
        if (
          target instanceof Element &&
          currentTarget.contains(target) &&
          !currentTarget.contains(target.closest(OWN_CLICK_SELECTOR))
        ) {
          currentTarget.parentElement
            ?.querySelector<HTMLElement>(":scope > [data-slot=input-group-control]")
            ?.focus();
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
}

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
      // The local compact axis is never Button's `size` prop: it is applied
      // as extra classes and reflected to the DOM as `data-size`.
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

export function InputGroupText({ className, ...props }: InputGroupTextProps): ReactElement {
  return (
    <span
      // The reference omits the slot, which breaks the
      // ButtonGroup `[data-slot]` child-selector contract.
      data-slot="input-group-text"
      className={cn(
        controlMd.type(),
        "flex items-center gap-2 text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

export function InputGroupInput({ className, ...props }: InputGroupInputProps): ReactElement {
  return (
    <Input
      data-slot="input-group-control"
      data-focus-ring-control=""
      className={cn(inputGroupInputControlClass, className)}
      {...props}
    />
  );
}

/**
 * `InputGroup.Input`'s look on a plain `<input>`, for a primitive that wires the Field itself,
 * such as Base UI's `Combobox.Input`. `InputGroup.Input` renders `Field.Control`, which would
 * name the input after the Field and submit its text beside the primitive's own hidden input.
 */
export function InputGroupPlainInput({ className, ...props }: ComponentProps<"input">): ReactElement {
  return (
    <input
      data-slot="input-group-control"
      data-focus-ring-control=""
      className={cn(inputClass, inputGroupInputControlClass, className)}
      {...props}
    />
  );
}

export function InputGroupTextarea({ className, ...props }: InputGroupTextareaProps): ReactElement {
  return (
    <Textarea
      data-slot="input-group-control"
      data-focus-ring-control=""
      className={cn(inputGroupControlClass, "resize-none py-2", className)}
      {...props}
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
