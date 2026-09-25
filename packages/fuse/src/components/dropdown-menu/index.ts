/**
 * Server-visible namespace for `DropdownMenu`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import {
  Root,
  Trigger,
  Portal,
  Content,
  Group,
  Label,
  Item,
  LinkItem,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  Separator,
  Shortcut,
  Sub,
  SubTrigger,
  SubContent,
} from "./index.parts";

export const DropdownMenu = {
  Root,
  Trigger,
  Portal,
  Content,
  Group,
  Label,
  Item,
  LinkItem,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  Separator,
  Shortcut,
  Sub,
  SubTrigger,
  SubContent,
};

export type {
  DropdownMenuCheckboxItemProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuLabelProps,
  DropdownMenuRadioGroupProps,
  DropdownMenuRadioItemProps,
  DropdownMenuSubContentProps,
  DropdownMenuSubTriggerProps,
} from "./dropdown-menu";
