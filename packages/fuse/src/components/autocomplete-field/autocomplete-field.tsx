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
 * `isDisabled`, `required` as `isRequired`, `readOnly` as `isReadOnly`, `children`), the ones it
 * redeclares with its own docs and the Root's types (`value`, `onValueChange`, `filter`,
 * `itemToStringValue`), or leaves to the compound: `inline`, since it always renders the popup.
 */
type AutocompleteFieldOwnedRootProps =
  | "items"
  | "filteredItems"
  | "name"
  | "disabled"
  | "required"
  | "readOnly"
  | "inline"
  | "children"
  | "value"
  | "onValueChange"
  | "filter"
  | "itemToStringValue";

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
  /**
   * The visible label, rendered as `Field.Label` 4px above the input. It names the input. For a
   * label row with an info button, or a horizontal field, compose `Field.Root` and the
   * `Autocomplete` parts instead.
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
  /** Makes the input required, so an empty submit is blocked with the required message. */
  isRequired?: boolean;
  /** Disables the field, the input and its buttons. */
  isDisabled?: boolean;
  /**
   * Makes the input read-only, with the muted read-only fill. The input stays focusable and its
   * popup still opens to show the suggestions, but picking one, typing and the clear button change
   * nothing. The text still submits under `name`.
   */
  isReadOnly?: boolean;
  /**
   * The `name` the text submits under, and under which `Form` routes its errors. A `Form` error
   * under it shows below the input, also in the first HTML a server renders, until the user edits
   * the text.
   */
  name?: string;
  /**
   * The text in the input, for a controlled field, whether the user typed it or picked a
   * suggestion. Text that matches no suggestion stays on blur and submits as it is.
   */
  value?: AutocompleteRootProps<ItemValue>["value"];
  /**
   * Called with the input's text on every change. It receives only the string, so capture a
   * picked item in `Autocomplete.Item`'s `onClick`, which runs on a click and on Enter while the
   * item is highlighted.
   */
  onValueChange?: AutocompleteRootProps<ItemValue>["onValueChange"];
  /**
   * The function that matches items against the text. For a search that runs elsewhere, such as
   * a register lookup on a server, pass `filter={null}` and the results as `items`, and the list
   * shows them as given. Keep the request and its state in your component, pass the empty list's
   * states as `Autocomplete.Empty`'s children and the rest as `status`.
   */
  filter?: AutocompleteRootProps<ItemValue>["filter"];
  /**
   * Returns the text an object item fills the input with and submits. With groups, it receives
   * one item of a group, not the group. A `{ value, label }` item uses its `label` without it.
   */
  itemToStringValue?: AutocompleteRootProps<ItemValue>["itemToStringValue"];
  /** The text the empty input shows. */
  placeholder?: string;
  /**
   * Renders the caret button, which opens the whole list for browsing. The list opens as the user
   * types, so the field has no caret unless you pass this. The caret hides while the clear button
   * shows. Its name is the locale dictionary's `toggle` string.
   */
  showTrigger?: boolean;
  /**
   * Renders a button that empties the input while it holds text. Its name is the locale
   * dictionary's `clear` string.
   */
  showClear?: boolean;
  /**
   * The state of a search the app runs, such as the number of results, rendered in
   * `Autocomplete.Status` beside the input. It stays mounted while the popup opens and closes,
   * so screen readers announce each change. Pass the empty list's states, such as loading or no
   * results, as `Autocomplete.Empty`'s children instead.
   */
  status?: ReactNode;
  /** Extra classes for the field's root. */
  className?: string;
  /** Extra classes for the input's field box, which fills the field's width. */
  inputClassName?: string;
  /**
   * The input the user types in. `inputRef` is the Root's hidden input. The props the field does
   * not name, `id` included, go to `Autocomplete.Root`, and the label points at that `id`.
   */
  ref?: Ref<HTMLInputElement>;
  /**
   * The items to suggest: a flat array, or an array of groups that each carry a `value` and their
   * own `items`. Nullish entries are not supported. Base UI filters them against the text in the
   * locale of `LocaleProvider`. A group whose items all fail to match hides with them.
   */
  items?: (Items & NoInfer<ListItems<Items, ItemValue>>) | undefined;
  /**
   * The items the list shows, for filtering outside the list, such as with Base UI's
   * `useFilter()` hook. When given, the list shows these and does not filter `items` itself.
   * With `items` also given, this array keeps its own flat or grouped structure. Nullish entries
   * are not supported, as in `items`.
   */
  filteredItems?: (Filtered & NoInfer<ListItems<Filtered, ItemValue>>) | undefined;
  /**
   * The popup's content, rendered inside `Autocomplete.Content`. Pass an `Autocomplete.List` that
   * renders each item as an `Autocomplete.Item`, and an `Autocomplete.Empty` beside it for the
   * list that matches nothing. The Empty needs `items`, since it shows only while the filtered
   * items are empty. For groups, render each group through `Autocomplete.Collection` inside the
   * List, as an `Autocomplete.Group` that takes the group's `items`, with an
   * `Autocomplete.Label` and a second `Autocomplete.Collection` for its rows. An
   * `Autocomplete.Separator` draws the rule between groups.
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
  isReadOnly = false,
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
        disabled={isDisabled}
        readOnly={isReadOnly}>
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
