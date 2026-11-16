"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { Check } from "../../icons/generated/check";
import { Minus } from "../../icons/generated/minus";
import { definedProps } from "../../internal/defined-props";
import { isTextNode } from "../../internal/is-text-node";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { FieldFrame } from "../field/field-frame";
import { SelectionGroupLayout, SelectionItemGroup } from "../selection-item/selection-item";
import { selectionGroupOrientationVariants } from "../selection-item/selection-item-variants";
import { checkboxVariants } from "./checkbox-variants";

const slots = checkboxVariants();

/**
 * A 16px checkbox with no label, built on Base UI's checkbox, which owns the checked state. It
 * shows a `Minus` while indeterminate and a `Check` otherwise. Label it with `Field.Root` and
 * `Field.Label`, or use `CheckboxItem`. A disabled checkbox dims to 50% inside or outside a
 * field. The box rounds with `rounded-md`, capped at 4px in every theme. A native form reset,
 * including React's reset after a form action, keeps the shown state and the submitted value in
 * step. An uncontrolled checkbox does not return to `defaultChecked`.
 */
export function Checkbox({
  className,
  inputRef,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  return (
    <CheckboxPrimitive.Root
      inputRef={syncedInputRef}
      data-slot="checkbox"
      className={mergeClassName(className, slots.root())}
      {...definedProps(props)}>
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={slots.indicator()}
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>{state.indeterminate ? <Minus /> : <Check />}</span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export type CheckboxGroupProps = {
  /** The group's visible name, rendered as `Field.Legend variant="label"`. Leave it out to drop the legend row. */
  label?: string;
  /**
   * Hides the legend visually and keeps it as the group's accessible name. Use it for a group
   * under a heading that already names it. The first option moves up into the legend's place.
   */
  isLabelHidden?: boolean;
  /** Supporting text under the options, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error text, rendered as `Field.Error` when truthy. While it is falsy, the field shows
   * its own validation error instead, such as a native constraint message.
   */
  errorMessage?: ReactNode;
  /**
   * How the options line up. `vertical` stacks them `--surface-gap-sm` apart, and joins
   * `CheckboxItem` rows into one card with a line between rows. `horizontal` wraps them in a row
   * `--surface-gap-lg` apart, and each `CheckboxItem` row is a card of its own. The cards share the
   * line in equal widths. A `basis-*` class on a row sets the width below which it wraps.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * Controlled selected values. The group decides which members with a `value` are checked, so
   * their own `checked` and `defaultChecked` have no effect.
   */
  value?: string[];
  /**
   * Uncontrolled initial selected values. Start a member checked by listing its `value` here, not
   * with its `defaultChecked`, which the group ignores.
   */
  defaultValue?: string[];
  /** Called with the selected values as a `string[]` when the selection changes. */
  onChange?: (value: string[]) => void;
  /**
   * Every member value, for a group with a `parent` checkbox. The parent is checked when all of
   * them are selected, indeterminate when some are, and unchecked when none are. Checking it
   * selects them all.
   */
  allValues?: string[];
  /** Disables every option. */
  isDisabled?: boolean;
  /** Marks the field invalid, so the options show the invalid face. */
  isInvalid?: boolean;
  /** The form field name every checked option submits its `value` under. */
  name?: string;
  /** The `id` of the element that holds the options. */
  id?: string;
  /** Extra classes for the element that holds the options. */
  className?: string;
  /**
   * The options. Write each `Checkbox` in a `Field.Item` with a `Field.Label` around it and its
   * text, or use `CheckboxItem` rows.
   */
  children?: ReactNode;
};

/**
 * A labeled group of checkboxes, built on Field and Base UI's checkbox group. A native form
 * reset, including React's reset after a form action, keeps the selection of Fuse members and
 * the submitted values in step. An uncontrolled group does not return to `defaultValue`.
 */
export function CheckboxGroup({
  label,
  isLabelHidden = false,
  description,
  errorMessage,
  orientation = "vertical",
  value,
  defaultValue,
  onChange,
  allValues,
  isDisabled,
  isInvalid,
  name,
  id,
  className,
  children,
}: CheckboxGroupProps): ReactElement {
  return (
    <FieldFrame
      heading="legend"
      label={label}
      isLabelHidden={isLabelHidden}
      description={description}
      errorMessage={errorMessage}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}>
      <CheckboxGroupPrimitive
        data-slot="checkbox-group"
        // The layout axis, as Card writes it: a vertical stack of selection shells is connected.
        data-direction={orientation}
        {...definedProps({
          id,
          value,
          defaultValue,
          onValueChange: onChange,
          allValues,
          disabled: isDisabled,
        })}
        className={cn(selectionGroupOrientationVariants({ orientation }).group(), className)}>
        <SelectionGroupLayout orientation={orientation}>{children}</SelectionGroupLayout>
      </CheckboxGroupPrimitive>
    </FieldFrame>
  );
}

/**
 * A `CheckboxGroup` for `CheckboxItem` rows, which it puts in a `role="list"`. A vertical
 * group joins the rows into one card. A horizontal group wraps them, `--surface-gap-lg`
 * apart, each a card of its own.
 */
export function CheckboxItemGroup({ orientation = "vertical", ...props }: CheckboxGroupProps): ReactElement {
  // The default is spelled here because the docs API extractor reads a part's
  // documented defaults out of its own destructuring.
  return (
    <CheckboxGroup {...props} orientation={orientation}>
      <SelectionItemGroup orientation={orientation}>{props.children}</SelectionItemGroup>
    </CheckboxGroup>
  );
}

export type CheckboxDescriptionProps = {
  /** The labeled checkbox the note sits beside, usually a `Field.Root` holding a `Checkbox`. */
  children?: ReactNode;
  /**
   * The note after the checkbox. A string renders as a muted `<small>`, and any other node
   * renders as given. Screen readers do not read it as the checkbox's description. Use
   * `Field.Description` when they should.
   */
  describedBy?: ReactNode;
};

/** A row with a checkbox and a note after it. The note is not the checkbox's accessible description. */
export function CheckboxDescription({ children, describedBy }: CheckboxDescriptionProps): ReactElement {
  // Only a string `describedBy` becomes the muted `<small>` note.
  return (
    <div className="flex items-start gap-2">
      {children}
      {isTextNode(describedBy) ? (
        <small className="text-sm text-muted-foreground">{describedBy}</small>
      ) : (
        describedBy
      )}
    </div>
  );
}

Checkbox.displayName = "Checkbox";
CheckboxGroup.displayName = "CheckboxGroup";
CheckboxItemGroup.displayName = "CheckboxItemGroup";
CheckboxDescription.displayName = "CheckboxDescription";
