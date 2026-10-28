import type { ReactElement, ReactNode, Ref } from "react";

import { definedProps } from "../../internal/defined-props";
import type { ListItemOf, ListItems } from "../../internal/list-items";
import {
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteRoot,
  AutocompleteStatus,
} from "../autocomplete/autocomplete";
import type { AutocompleteRootProps } from "../autocomplete/autocomplete";
import { FieldFrame } from "../field/field-frame";

/**
 * The Root props the field names itself (`items`, `filteredItems`, `name`, `disabled` as
 * `isDisabled`, `required` as `isRequired`, `children`) or leaves to the compound: `readOnly`,
 * since the composite has no `isReadOnly` yet, and `inline`, since it always renders the popup.
 */
type AutocompleteFieldOwnedRootProps =
  | "items"
  | "filteredItems"
  | "name"
  | "disabled"
  | "required"
  | "readOnly"
  | "inline"
  | "children";

/**
 * `AutocompleteField` takes the field's props, the input's `placeholder`, `showTrigger`,
 * `showClear` and `ref`, and `Autocomplete.Root`'s other props, which it forwards to the Root.
 *
 * @template Items - The `items` array, flat or of groups.
 * @template Filtered - The `filteredItems` array, flat or of groups.
 * @template ItemValue - One item of `items`, which `itemToStringValue` receives.
 */
export type AutocompleteFieldProps<
  Items extends readonly unknown[] = readonly never[],
  Filtered extends readonly unknown[] = readonly never[],
  ItemValue = ListItemOf<Items extends readonly never[] ? Filtered : Items>,
> = Omit<AutocompleteRootProps<ItemValue>, AutocompleteFieldOwnedRootProps> & {
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
  /** Forwards `required` to `Autocomplete.Root`, which marks the input required. */
  isRequired?: boolean;
  /** Forwards `disabled` to `Field.Root` and `Autocomplete.Root`, which disable the input and its buttons. */
  isDisabled?: boolean;
  /**
   * Native `name` the text submits under, forwarded to `Field.Root`. A `Form` error under it
   * shows below the input until the user edits the text.
   */
  name?: string;
  /** Shown in the empty input, forwarded to `Autocomplete.Input`. */
  placeholder?: string;
  /**
   * Renders the caret button that opens the whole list. The list opens as the user types, so
   * the field has none by default. It hides while the clear button shows.
   * @default false
   */
  showTrigger?: boolean;
  /**
   * Renders a button that empties the input while it holds text.
   * @default false
   */
  showClear?: boolean;
  /**
   * The state of a search the app runs, such as the number of results, rendered in
   * `Autocomplete.Status` beside the input. It stays mounted while the popup opens and closes,
   * so screen readers announce each change. Pass the empty list's states, such as loading or no
   * results, as `Autocomplete.Empty`'s children instead.
   */
  status?: ReactNode;
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Extra classes, merged onto the input's field box, which fills the field's width. */
  inputClassName?: string;
  /** The input the user types in. `inputRef` is the Root's hidden input. */
  ref?: Ref<HTMLInputElement>;
  /**
   * The items to suggest: a flat array, or an array of groups that each carry their own
   * `items`. Nullish entries are not supported.
   */
  items?: (Items & NoInfer<ListItems<Items, ItemValue>>) | undefined;
  /**
   * Filtered items to display in the list. When given, the list shows these instead of
   * filtering `items` itself. With `items` also given, this array keeps its flat or grouped
   * structure. Nullish entries are not supported, as in `items`. Use it to filter outside the
   * list, such as with Base UI's `useFilter()` hook.
   */
  filteredItems?: (Filtered & NoInfer<ListItems<Filtered, ItemValue>>) | undefined;
  /**
   * The popup's content, such as `Autocomplete.Empty` and `Autocomplete.List`, rendered inside
   * `Autocomplete.Content`.
   */
  children?: ReactNode;
};

/**
 * Labeled autocomplete composite over Field and the `Autocomplete` parts: the label, the input
 * with its suggestions, then the error and the description, laid out like `TextField`, with the
 * label 4px from the input. The input fills the field's width, and its text is the value. The
 * props the field does not name itself go to `Autocomplete.Root`, including `id`, which the label
 * points at; a `ref` goes to the input. Use the `Autocomplete` namespace for a custom layout,
 * such as a label row with an info button or a horizontal field.
 *
 * Server-renderable: it owns no state, and its parts are client modules.
 *
 * @template Items - The `items` array, flat or of groups.
 * @template Filtered - The `filteredItems` array, flat or of groups.
 * @template ItemValue - One item of `items`, which `itemToStringValue` receives. `items` decides
 * it; without `items`, `filteredItems` does; when neither is given, an annotated callback such as
 * `itemToStringValue` sets it.
 */
export function AutocompleteField<
  Items extends readonly unknown[] = readonly never[],
  Filtered extends readonly unknown[] = readonly never[],
  ItemValue = ListItemOf<Items extends readonly never[] ? Filtered : Items>,
>({
  label,
  description,
  errorMessage,
  isInvalid = false,
  isRequired = false,
  isDisabled = false,
  name,
  placeholder,
  showTrigger = false,
  showClear = false,
  status,
  className,
  inputClassName,
  ref,
  children,
  ...props
}: AutocompleteFieldProps<Items, Filtered, ItemValue>): ReactElement {
  return (
    <FieldFrame
      className={className}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}>
      <AutocompleteRoot<Items, Filtered, ItemValue>
        {...definedProps(props)}
        required={isRequired}
        disabled={isDisabled}>
        <AutocompleteInput
          ref={ref}
          {...definedProps({ placeholder, className: inputClassName })}
          showTrigger={showTrigger}
          showClear={showClear}
        />
        <AutocompleteStatus>{status}</AutocompleteStatus>
        <AutocompleteContent>{children}</AutocompleteContent>
      </AutocompleteRoot>
    </FieldFrame>
  );
}

AutocompleteField.displayName = "AutocompleteField";
