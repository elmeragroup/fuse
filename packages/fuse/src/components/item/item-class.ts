/**
 * The class strings of Item's parts without an axis: `Item.Content`, `Item.Description`,
 * `Item.Actions` and `Item.Header`. Package-private: not on the `@elmeragroup/fuse/item` facade.
 * The workspace-only recipe catalog re-exports them for the Figma component sync.
 */
import { cn } from "../../styles/cn";
import { ITEM_DESCRIPTION_CLASSES } from "./item-description-classes";

/**
 * `Item.Content`: the column of the title and the description. It grows to the row's spare width,
 * and beside a description it tops with the media. A second content column after it keeps its own
 * width.
 */
export const itemContentClass = cn(
  "flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 item-described:self-start [&+[data-slot=item-content]]:flex-none"
);

/** `Item.Description`: the shared description face, clamped to two lines. */
export const itemDescriptionClass = cn(ITEM_DESCRIPTION_CLASSES, "line-clamp-2");

/** `Item.Actions`: the row's trailing controls, centred on the row. */
export const itemActionsClass = cn("flex items-center gap-2");

/** `Item.Header`: a full-width line above the row's media and content. */
export const itemHeaderClass = cn("flex basis-full items-center justify-between gap-2");
