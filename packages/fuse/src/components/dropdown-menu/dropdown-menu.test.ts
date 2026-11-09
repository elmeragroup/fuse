import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import {
  menuItemIndicatorClass,
  menuItemIndicatorRoomClass,
  menuSeparatorClass,
} from "../overlay/menu-row-classes";
import { dropdownMenuVariants } from "./dropdown-menu-variants";

function tokens(classes: string): string[] {
  return classes.split(/\s+/u).filter(Boolean).toSorted();
}

describe("dropdownMenuVariants", () => {
  it("maps the destructive variant onto error-token classes, never a destructive class", () => {
    const item = dropdownMenuVariants().item();
    expect(item).toContain("data-[variant=destructive]:text-error");
    expect(item).toContain("data-[variant=destructive]:focus:bg-error/10");
    expect(item).not.toContain("text-destructive");
    expect(item).not.toContain("bg-destructive");
    expect(item).toContain("data-inset:pl-[calc(var(--row-px)+1.5rem)]");
  });

  // Unit: the checkable, indicator and separator slots. Oracle: the shared menu-row classes they
  // forward, composed as the components merged them by hand before the slots owned them, so the
  // rendered classes stay what they were.
  it("forwards the shared menu-row classes through its checkable, indicator and separator slots", () => {
    const slots = dropdownMenuVariants();
    expect(tokens(slots.checkableItem())).toEqual(tokens(cn(slots.item(), menuItemIndicatorRoomClass)));
    expect(tokens(slots.itemIndicator())).toEqual(tokens(menuItemIndicatorClass));
    expect(tokens(slots.separator())).toEqual(tokens(menuSeparatorClass));
  });
});
