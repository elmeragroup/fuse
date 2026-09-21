/**
 * Item.Title class string. Shared with Alert.Title so the alert
 * heading keeps the same type while staying an `h*`.
 * Package-private — not on the `@elmeragroup/fuse/item` facade.
 */
import { cn } from "../../styles/cn";

export const ITEM_TITLE_CLASSES = cn(
  "text-sm leading-snug font-medium line-clamp-1 flex w-fit items-center gap-2 underline-offset-4"
);
