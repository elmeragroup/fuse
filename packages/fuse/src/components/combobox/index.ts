/**
 * Server-visible namespace for `Combobox`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Input,
  Trigger,
  Clear,
  Content,
  List,
  Item,
  Group,
  Label,
  Collection,
  Empty,
  Separator,
  Chips,
  Chip,
  ChipsInput,
  Value,
} from "./index.parts";

export const Combobox = {
  Root,
  Input,
  Trigger,
  Clear,
  Content,
  List,
  Item,
  Group,
  Label,
  Collection,
  Empty,
  Separator,
  Chips,
  Chip,
  ChipsInput,
  Value,
};

export { useComboboxAnchor } from "./combobox";
export type {
  ComboboxChipProps,
  ComboboxClearProps,
  ComboboxContentProps,
  ComboboxInputProps,
  ComboboxRootProps,
} from "./combobox";
