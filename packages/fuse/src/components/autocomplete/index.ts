/**
 * Server-visible namespace for `Autocomplete`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  AutocompleteRoot,
  AutocompleteInput,
  AutocompleteTrigger,
  AutocompleteClear,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteGroup,
  AutocompleteLabel,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteStatus,
  AutocompleteSeparator,
} from "./autocomplete";

export const Autocomplete = {
  Root: AutocompleteRoot,
  Input: AutocompleteInput,
  Trigger: AutocompleteTrigger,
  Clear: AutocompleteClear,
  Content: AutocompleteContent,
  List: AutocompleteList,
  Item: AutocompleteItem,
  Group: AutocompleteGroup,
  Label: AutocompleteLabel,
  Collection: AutocompleteCollection,
  Empty: AutocompleteEmpty,
  Status: AutocompleteStatus,
  Separator: AutocompleteSeparator,
};
