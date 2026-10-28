import type { ReactElement, ReactNode, Ref } from "react";

import { definedProps } from "../../internal/defined-props";
import type { ListItemOf, ListItems } from "../../internal/list-items";
import { ComboboxContent, ComboboxInput, ComboboxRoot } from "../combobox/combobox";
import type { ComboboxRootProps } from "../combobox/combobox";
import { FieldFrame } from "../field/field-frame";

/**
 * The Root props the field names itself (`items`, `filteredItems`, `name`, `disabled` as
 * `isDisabled`, `required` as `isRequired`, `children`) or leaves to the compound: `multiple`,
 * since the field takes one selection, `readOnly`, since it has no `isReadOnly` yet, and
 * `inline`, since it always renders the popup.
 */
type ComboboxFieldOwnedRootProps =
  | "items"
  | "filteredItems"
  | "name"
  | "disabled"
  | "required"
  | "readOnly"
  | "inline"
  | "multiple"
  | "children";

/**
 * `ComboboxField` takes the field's props, the input's `placeholder`, `showTrigger`, `showClear`
 * and `ref`, and `Combobox.Root`'s other props for one selection, which it forwards to the Root.
 *
 * @template Items - The `items` array, flat or of groups.
 * @template Filtered - The `filteredItems` array, flat or of groups.
 * @template Value - One item of `items`, which is the selected value and what
 * `itemToStringValue` receives.
 */
export type ComboboxFieldProps<
  Items extends readonly unknown[] = readonly never[],
  Filtered extends readonly unknown[] = readonly never[],
  Value = ListItemOf<Items extends readonly never[] ? Filtered : Items>,
> = Omit<ComboboxRootProps<Value>, ComboboxFieldOwnedRootProps> & {
  /** Visible label, rendered as `Field.Label`. It names the input. */
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
  /** Forwards `required` to `Combobox.Root`, which marks the input required. */
  isRequired?: boolean;
  /** Forwards `disabled` to `Field.Root` and `Combobox.Root`, which disable the input and its buttons. */
  isDisabled?: boolean;
  /**
   * Native `name` the selected value submits under, forwarded to `Field.Root`. A `Form` error
   * under it shows below the input until the selection changes.
   */
  name?: string;
  /** Shown in the empty input, forwarded to `Combobox.Input`. */
  placeholder?: string;
  /**
   * Renders the caret button that opens the list. It hides while the clear button shows.
   * @default true
   */
  showTrigger?: boolean;
  /**
   * Renders a button that clears the selection while there is one.
   * @default false
   */
  showClear?: boolean;
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Extra classes, merged onto the input's field box, which fills the field's width. */
  inputClassName?: string;
  /** The input the user types in. `inputRef` is the Root's hidden input. */
  ref?: Ref<HTMLInputElement>;
  /**
   * The options: a flat array, or an array of groups that each carry their own `items`. Nullish
   * entries are not supported.
   */
  items?: (Items & NoInfer<ListItems<Items, Value>>) | undefined;
  /**
   * Filtered options to display in the list. When given, the list shows these instead of
   * filtering `items` itself. With `items` also given, this array keeps its flat or grouped
   * structure. Nullish entries are not supported, as in `items`. Use it to filter outside the
   * list, such as with Base UI's `useFilter()` hook.
   */
  filteredItems?: (Filtered & NoInfer<ListItems<Filtered, Value>>) | undefined;
  /**
   * The popup's content, such as `Combobox.Empty` and `Combobox.List`, rendered inside
   * `Combobox.Content`.
   */
  children?: ReactNode;
};

/**
 * Labeled combobox composite over Field and the `Combobox` parts: the label, the input with its
 * options, then the error and the description, laid out like `TextField`, with the label 4px from
 * the input. The input fills the field's width, and the selected option is the value. The props
 * the field does not name itself go to `Combobox.Root`, including `id`, which the label points
 * at; a `ref` goes to the input. Single selection; use the `Combobox` namespace for multiple
 * selection, chips or a custom layout, such as a label row with an info button or a horizontal
 * field.
 *
 * Server-renderable: it owns no state, and its parts are client modules.
 *
 * @template Items - The `items` array, flat or of groups.
 * @template Filtered - The `filteredItems` array, flat or of groups.
 * @template Value - One item of `items`, which is the selected value and what
 * `itemToStringValue` receives. `items` decides it; without `items`, `filteredItems` does; when
 * neither is given, `value`, `defaultValue` or an annotated callback sets it.
 */
export function ComboboxField<
  Items extends readonly unknown[] = readonly never[],
  Filtered extends readonly unknown[] = readonly never[],
  Value = ListItemOf<Items extends readonly never[] ? Filtered : Items>,
>({
  label,
  description,
  errorMessage,
  isInvalid = false,
  isRequired = false,
  isDisabled = false,
  name,
  placeholder,
  showTrigger = true,
  showClear = false,
  className,
  inputClassName,
  ref,
  children,
  ...props
}: ComboboxFieldProps<Items, Filtered, Value>): ReactElement {
  return (
    <FieldFrame
      className={className}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}>
      <ComboboxRoot<Items, Filtered, Value>
        {...definedProps(props)}
        required={isRequired}
        disabled={isDisabled}>
        <ComboboxInput
          ref={ref}
          {...definedProps({ placeholder, className: inputClassName })}
          showTrigger={showTrigger}
          showClear={showClear}
        />
        <ComboboxContent>{children}</ComboboxContent>
      </ComboboxRoot>
    </FieldFrame>
  );
}

ComboboxField.displayName = "ComboboxField";
