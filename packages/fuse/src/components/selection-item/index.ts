/**
 * Server-visible namespace for `SelectionItem`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Shell, Title, Description, Content, Actions, SubSection } from "./index.parts";

/**
 * Shared selectable card row. `CheckboxItem` / `RadioItem` alias these part objects in
 * later tickets so `child.type` partitioning keeps working across spellings.
 */
export const SelectionItem = {
  Shell,
  Title,
  Description,
  Content,
  Actions,
  SubSection,
};

export { SelectionGroupLayout, SelectionItemGroup } from "./selection-item";
