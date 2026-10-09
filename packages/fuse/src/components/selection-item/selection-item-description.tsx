import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { ITEM_DESCRIPTION_CLASSES } from "../item/item-description-classes";

/**
 * The option's supporting text. It sits inside the row's label, so it is part of the
 * control's accessible name and shows every line: unlike `Item.Description` it carries no
 * two-line clamp, which would cut what a screen reader still reads out. Its own
 * `selection-item-description` slot marks it as label text, and Item.Media and the row's control
 * key their alignment on it as they do on `item-description`.
 * It takes the label text size, `--label-text`, with `leading-normal` as the
 * size's `/normal` modifier: tailwind-merge drops a line height that comes before a font size,
 * and the formatter sorts the classes inside a string.
 * No directive, so a server component renders it, as it did `Item.Description`.
 */
export function SelectionItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return (
    <p
      data-slot="selection-item-description"
      className={cn(ITEM_DESCRIPTION_CLASSES, "text-(length:--label-text)/normal", className)}
      {...props}
    />
  );
}

SelectionItemDescription.displayName = "SelectionItem.Description";
