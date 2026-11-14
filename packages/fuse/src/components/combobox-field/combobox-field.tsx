import type { ReactElement, ReactNode, Ref } from "react";

import { definedProps } from "../../internal/defined-props";
import type { ListItemOf, ListItems } from "../../internal/list-items";
import { ComboboxContent, ComboboxInput, ComboboxRoot } from "../combobox/combobox";
import type { ComboboxRootProps } from "../combobox/combobox";
import { FieldFrame } from "../field/field-frame";

/**
 * The Root props the field names itself (`items`, `filteredItems`, `name`, `disabled` as
 * `isDisabled`, `required` as `isRequired`, `readOnly` as `isReadOnly`, `children`) or leaves to
 * the compound: `multiple`, since the field takes one selection, and `inline`, since it always
 * renders the popup.
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
  /**
   * The visible label, rendered as `Field.Label` 4px above the input. It names the input. For a
   * label row with an info button, or a label beside the input, compose `Field.Root` and the
   * `Combobox` parts instead.
   */
  label?: string;
  /** Supporting text, rendered as `Field.Description` below the error. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` under the input, ahead of the description,
   * while it is truthy. Pass `isInvalid` with it, so the input is marked invalid too. Without it,
   * the field shows its own error, such as one `Form` holds under its `name` or the required
   * message.
   */
  errorMessage?: ReactNode;
  /** Marks the field invalid, with the invalid look. */
  isInvalid?: boolean;
  /** Makes a selection required, so an empty submit is blocked with the required message. */
  isRequired?: boolean;
  /** Disables the field, the input and its buttons. */
  isDisabled?: boolean;
  /**
   * Makes the combobox read-only, with the muted read-only fill. The input stays focusable and its
   * popup still opens to show the options, but choosing one, typing and the clear button change
   * nothing. The value still submits under `name`.
   */
  isReadOnly?: boolean;
  /**
   * The `name` the selected value submits under, once, and under which `Form` routes its errors.
   * A `Form` error under it shows below the input, also in the first HTML a server renders, until
   * the selection changes. A new `errors` object shows it again.
   */
  name?: string;
  /** The text the empty input shows. */
  placeholder?: string;
  /** Renders the caret button that opens the list. It hides while the clear button shows. */
  showTrigger?: boolean;
  /** Renders a button that clears the selection while there is one. */
  showClear?: boolean;
  /** Extra classes for the field's root. */
  className?: string;
  /** Extra classes for the input's field box, which fills the field's width. */
  inputClassName?: string;
  /**
   * The input the user types in. `inputRef` is the Root's hidden input. The props the field does
   * not name, `id` included, go to `Combobox.Root`, and the label points at that `id`.
   */
  ref?: Ref<HTMLInputElement>;
  /**
   * The options: a flat array, or an array of groups that each carry their own `items`. Nullish
   * entries are not supported. With object items, the item type sets the value's type and what
   * `itemToStringLabel` and `itemToStringValue` receive. The field takes one selection, which
   * `value`, `defaultValue` and `onValueChange` hold. For multiple selection or chips, compose
   * `Field.Root` and the `Combobox` parts.
   */
  items?: (Items & NoInfer<ListItems<Items, Value>>) | undefined;
  /**
   * The options the list shows, for filtering outside the list, such as with Base UI's
   * `useFilter()` hook. When given, the list shows these and does not filter `items` itself.
   * With `items` also given, this array keeps its own flat or grouped structure. Nullish entries
   * are not supported, as in `items`.
   */
  filteredItems?: (Filtered & NoInfer<ListItems<Filtered, Value>>) | undefined;
  /**
   * The popup's content, rendered inside `Combobox.Content`. Pass a `Combobox.List` that renders
   * each item as a `Combobox.Item`, and a `Combobox.Empty` beside it for a search that matches
   * nothing.
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
  isReadOnly = false,
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
        disabled={isDisabled}
        readOnly={isReadOnly}>
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
