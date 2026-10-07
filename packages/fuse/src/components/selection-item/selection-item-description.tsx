import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { ITEM_DESCRIPTION_CLASSES } from "../item/item-description-classes";

/**
 * The option's supporting text. It sits inside the row's label, so it is part of the
 * control's accessible name and shows every line: unlike `Item.Description` it carries no
 * two-line clamp, which would cut what a screen reader still reads out. It keeps the
 * `item-description` slot, so the control at the row's start stays aligned with the title.
 * No directive, so a server component renders it, as it did `Item.Description`.
 */
export function SelectionItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return <p data-slot="item-description" className={cn(ITEM_DESCRIPTION_CLASSES, className)} {...props} />;
}

SelectionItemDescription.displayName = "SelectionItem.Description";
