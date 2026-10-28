/**
 * What Dialog and Alert dialog share, as Fuse's Dialog renders both: a `Dialog.Content` popup
 * holding a title, a description and a footer row of actions.
 *
 * - The popup is `<div data-slot="dialog-content">` with `dialogContentVariants({ size: "md" })`,
 *   which Base UI stamps `data-open` while it is open.
 * - The title is Base UI's `<h2>` and the description its `<p>`. The copy differs by cell, so no
 *   TEXT property sets either.
 */
import { dialogContentVariants, dialogVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { userAgentDisplay } from "./element-defaults";
import { OPEN_FACTS, always } from "./popup-facts";

const dialog = dialogVariants();

/** The popup's fields a Dialog content set spreads: its slot, recipe, open facts and omissions. */
export const DIALOG_CONTENT_SET: Pick<
  ComponentDefinition,
  | "slot"
  | "classesFor"
  | "states"
  | "facts"
  | "omittedStates"
  | "omittedCompositions"
  | "label"
  | "iconsFor"
  | "swapProperties"
> = {
  slot: "dialog-content",
  classesFor: () => dialogContentVariants({ size: "md" }),
  states: {},
  facts: OPEN_FACTS,
  // The popup takes focus only while a keyboard user lands on it, and the kit draws it at rest.
  omittedStates: new Set(["focus-visible"]),
  omittedCompositions: new Map([
    ["*", "`*:[a]:` underlines and darkens a link inside the description, and the demos' copy holds none"],
  ]),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

/**
 * The title, Base UI's `<h2>`.
 *
 * @param charactersFor - The title's copy in a cell.
 * @param classesFor - The title's classes in a cell, Dialog's title recipe by default.
 * @returns The title part.
 */
export function dialogTitle(
  charactersFor: (cell: Cell) => string,
  classesFor: (cell: Cell) => string = () => dialog.title()
): PartDefinition {
  return {
    key: "title",
    slot: "dialog-title",
    shownIn: always,
    classesFor,
    elementDefaults: userAgentDisplay("h2"),
    label: { key: "text", name: "text", charactersFor, shownIn: always },
    iconsFor: () => [],
  };
}

/**
 * The description, Base UI's `<p>`.
 *
 * @param charactersFor - The description's copy in a cell.
 * @returns The description part.
 */
export function dialogDescription(charactersFor: (cell: Cell) => string): PartDefinition {
  return {
    key: "description",
    slot: "dialog-description",
    shownIn: always,
    classesFor: () => dialog.description(),
    elementDefaults: userAgentDisplay("p"),
    label: { key: "text", name: "text", charactersFor, shownIn: always },
    iconsFor: () => [],
  };
}

/**
 * The footer row of the popup's actions.
 *
 * @param parts - The actions, in order.
 * @returns The footer part.
 */
export function dialogFooter(parts: readonly (PartDefinition | InstanceDefinition)[]): PartDefinition {
  return {
    key: "footer",
    slot: "dialog-footer",
    shownIn: always,
    classesFor: () => dialog.footer(),
    label: undefined,
    iconsFor: () => [],
    parts,
  };
}
