/**
 * Server-visible namespace for `SelectionItem`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { ItemContent } from "../item/item-markup";
import { SelectionItemShell, SelectionItemTitle, SelectionItemActions } from "./selection-item";
import { SelectionItemDescription } from "./selection-item-description";
import { SelectionItemSubSection } from "./selection-item-sub-section";

/**
 * The selectable card row. `CheckboxItem` and `RadioItem` reuse these part objects, so the row
 * recognises a SubSection by `child.type` under either spelling.
 */
export const SelectionItem = {
  Shell: SelectionItemShell,
  Title: SelectionItemTitle,
  Description: SelectionItemDescription,
  Content: ItemContent,
  Actions: SelectionItemActions,
  SubSection: SelectionItemSubSection,
};
