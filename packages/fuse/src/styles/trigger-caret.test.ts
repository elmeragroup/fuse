import { describe, expect, it } from "vitest";

import { autocompleteVariants } from "../components/autocomplete/autocomplete-variants";
import { comboboxVariants } from "../components/combobox/combobox-variants";
import { navigationMenuVariants } from "../components/navigation-menu/navigation-menu-variants";
import { selectTriggerVariants } from "../components/select/select-variants";
import { triggerCaretClass } from "./trigger-caret";

/**
 * The caret every popup trigger draws, spelled out independently of the owner: 16px, muted,
 * click-through and turning over 200ms.
 */
const CARET_BASE = [
  "size-4",
  "text-muted-foreground",
  "pointer-events-none",
  "transition-transform",
  "duration-200",
  "ease-in-out",
];

const CARET_SLOTS = {
  Select: selectTriggerVariants().caret(),
  Combobox: comboboxVariants().caret(),
  Autocomplete: autocompleteVariants().caret(),
  NavigationMenu: navigationMenuVariants().triggerIcon(),
};

function tokens(classes: string): Set<string> {
  return new Set(classes.split(/\s+/u).filter(Boolean));
}

describe("triggerCaretClass", () => {
  it("holds exactly the caret base", () => {
    expect([...tokens(triggerCaretClass)].toSorted()).toEqual(CARET_BASE.toSorted());
  });

  it.each(Object.entries(CARET_SLOTS))("is the base of %s's caret slot", (_name, slot) => {
    // Unit: each recipe's caret slot. Oracle: the owner's tokens, which every slot must carry
    // after tailwind-merge resolves the slot's own rotation classes against them.
    expect([...tokens(slot)]).toEqual(expect.arrayContaining([...tokens(triggerCaretClass)]));
  });
});
