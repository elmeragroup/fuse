/**
 * Item.Description class string without the two-line clamp. Item.Description adds
 * `line-clamp-2`; Alert.Description renders it unclamped on a `div` so an alert can
 * carry full instructions, lists and paragraphs.
 * Package-private. It is not on the `@elmeragroup/fuse/item` facade.
 */
import { cn } from "../../styles/cn";

export const ITEM_DESCRIPTION_CLASSES = cn(
  "text-sm leading-normal font-normal group-data-[size=xs]/item:text-xs text-left text-pretty text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary"
);
