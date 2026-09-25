/**
 * Server-visible namespace for `SelectionItem`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { ItemDescription, ItemContent } from "../item/item-markup";
import {
  SelectionItemShell,
  SelectionItemTitle,
  SelectionItemActions,
  SelectionItemSubSection,
} from "./selection-item";

/**
 * Shared selectable card row. `CheckboxItem` / `RadioItem` alias these part objects so
 * `child.type` partitioning keeps working across spellings.
 */
export const SelectionItem = {
  Shell: SelectionItemShell,
  Title: SelectionItemTitle,
  Description: ItemDescription,
  Content: ItemContent,
  Actions: SelectionItemActions,
  SubSection: SelectionItemSubSection,
};
