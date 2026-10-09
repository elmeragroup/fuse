import type { ReactElement, ReactNode } from "react";

import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { FieldFrame, fieldFrameRootClass } from "../field/field-frame";
import { SelectContent, SelectRoot, SelectTrigger, SelectValue } from "../select/select";
import type { SelectTriggerProps } from "../select/select";

type SelectRootProps<Value> = SelectRootType.Props<Value, false>;

export type SelectFieldProps<Value = unknown> = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows its own validation error instead, such as an error `Form` holds under its
   * `name` or the required message.
   */
  errorMessage?: ReactNode;
  /** Forwards `invalid` to `Field.Root`. */
  isInvalid?: boolean;
  /** Forwards `required` to `Select.Root`. */
  isRequired?: boolean;
  /** Forwards `disabled` to `Field.Root` and `Select.Root`. */
  isDisabled?: boolean;
  /** Native `name` the selection submits under, forwarded to `Select.Root`. */
  name?: string;
  /** The `id` of the form the selection submits with, forwarded to `Select.Root`. */
  form?: string;
  /** Shown in the trigger while nothing is selected, forwarded to `Select.Value`. */
  placeholder?: ReactNode;
  /** Controlled selection; `null` selects nothing. */
  value?: SelectRootProps<Value>["value"];
  /** Uncontrolled initial selection. */
  defaultValue?: SelectRootProps<Value>["defaultValue"];
  /** Called with the new selection and Base UI's event details. */
  onValueChange?: SelectRootProps<Value>["onValueChange"];
  /** The options' labels by value, so the trigger can show a label before the popup opens. */
  items?: SelectRootProps<Value>["items"];
  /** The label of an object value, for the trigger. */
  itemToStringLabel?: SelectRootProps<Value>["itemToStringLabel"];
  /** The submitted string of an object value. */
  itemToStringValue?: SelectRootProps<Value>["itemToStringValue"];
  /** Compares an object value with an option's value. */
  isItemEqualToValue?: SelectRootProps<Value>["isItemEqualToValue"];
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Extra classes, merged onto `Select.Trigger`. */
  triggerClassName?: string;
  /** The options, normally `Select.Item`s, rendered inside `Select.Content`. */
  children?: ReactNode;
} & Omit<
  SelectTriggerProps,
  "children" | "className" | "disabled" | "name" | "form" | "value" | "defaultValue"
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
  ...props
}: SelectFieldProps<Value>): ReactElement {
  return (
    <FieldFrame
      className={cn(fieldFrameRootClass, className)}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}>
      <SelectRoot<Value>
        {...definedProps({
          name,
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
        disabled={isDisabled}>
        <SelectTrigger className={cn("w-full", triggerClassName)} {...definedProps(props)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </SelectRoot>
    </FieldFrame>
  );
}

SelectField.displayName = "SelectField";
