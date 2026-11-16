import type { ReactElement, ReactNode } from "react";

import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { FieldFrame } from "../field/field-frame";
import { SelectContent, SelectRoot, SelectTrigger, SelectValue } from "../select/select";
import type { SelectTriggerProps } from "../select/select";

type SelectRootProps<Value> = SelectRootType.Props<Value, false>;

/** The props of {@link SelectField}. */
export type SelectFieldProps<Value = unknown> = {
  /**
   * The visible label, rendered as `Field.Label` above the trigger. For a label row with an info
   * button, or a label beside the trigger, compose `Field.Root` and the `Select` parts instead.
   */
  label?: string;
  /** Supporting text, rendered as `Field.Description` below the error. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` under the trigger, ahead of the description,
   * while it is truthy. Pass `isInvalid` with it, so the trigger is marked invalid too. Without
   * it, the field shows its own error, such as one `Form` holds under its `name` or the required
   * message.
   */
  errorMessage?: ReactNode;
  /** Marks the field invalid, with the invalid look. */
  isInvalid?: boolean;
  /** Makes a selection required, so an empty submit is blocked with the required message. */
  isRequired?: boolean;
  /** Disables the field and the trigger. */
  isDisabled?: boolean;
  /**
   * Makes the select read-only, with the muted read-only fill. The trigger stays focusable and
   * its popup still opens to show the options, but no choice changes the value. The value still
   * submits under `name`.
   */
  isReadOnly?: boolean;
  /**
   * The `name` the selection submits under, and under which `Form` routes its errors. A `Form`
   * error under it shows below the trigger until the selection changes, and a new `errors` object
   * shows it again.
   */
  name?: string;
  /** The `id` of the form the selection submits with, when the field sits outside it. */
  form?: string;
  /** The text the trigger shows while nothing is selected. */
  placeholder?: ReactNode;
  /**
   * The selection, for a controlled field. `null` selects nothing. The field takes one value; for
   * multiple selection, compose `Field.Root` and the `Select` parts.
   */
  value?: SelectRootProps<Value>["value"];
  /** The starting selection of an uncontrolled field. */
  defaultValue?: SelectRootProps<Value>["defaultValue"];
  /** Called with the new selection and Base UI's event details. */
  onValueChange?: SelectRootProps<Value>["onValueChange"];
  /**
   * The options' labels by value. Pass them, so the trigger shows the selected label before the
   * popup has opened.
   */
  items?: SelectRootProps<Value>["items"];
  /** Returns the label of an object value, for the trigger. */
  itemToStringLabel?: SelectRootProps<Value>["itemToStringLabel"];
  /** Returns the string an object value submits as. */
  itemToStringValue?: SelectRootProps<Value>["itemToStringValue"];
  /** Compares an object value with an option's value. */
  isItemEqualToValue?: SelectRootProps<Value>["isItemEqualToValue"];
  /** Extra classes for the field's root. */
  className?: string;
  /** Extra classes for `Select.Trigger`, which fills the field's width. */
  triggerClassName?: string;
  /** The options, as `Select.Item`s, rendered inside `Select.Content`. */
  children?: ReactNode;
  /** The trigger button. It also takes every prop `SelectField` does not name. */
  ref?: SelectTriggerProps["ref"];
} & Omit<
  SelectTriggerProps,
  "children" | "className" | "disabled" | "name" | "form" | "value" | "defaultValue" | "ref"
>;

/**
 * Labeled select composite over Field and the Base UI `Select` parts: the label, the trigger
 * showing the selection, the options popup, then the error and the description. The trigger
 * fills the field's width, and a `ref` and the remaining props go to it. Single selection;
 * use the `Select` namespace for multiple selection or a custom layout, such as a label row
 * with an info button or a horizontal field.
 *
 * Server-renderable: it owns no state, and its parts are client modules.
 */
export function SelectField<Value = unknown>({
  label,
  description,
  errorMessage,
  isInvalid = false,
  isRequired = false,
  isDisabled = false,
  isReadOnly = false,
  name,
  form,
  placeholder,
  value,
  defaultValue,
  onValueChange,
  items,
  itemToStringLabel,
  itemToStringValue,
  isItemEqualToValue,
  className,
  triggerClassName,
  children,
  size = "default",
  ...props
}: SelectFieldProps<Value>): ReactElement {
  return (
    <FieldFrame
      className={className}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}>
      <SelectRoot<Value>
        {...definedProps({
          form,
          value,
          defaultValue,
          onValueChange,
          items,
          itemToStringLabel,
          itemToStringValue,
          isItemEqualToValue,
        })}
        required={isRequired}
        disabled={isDisabled}
        readOnly={isReadOnly}>
        <SelectTrigger className={cn("w-full", triggerClassName)} size={size} {...props}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </SelectRoot>
    </FieldFrame>
  );
}

SelectField.displayName = "SelectField";
