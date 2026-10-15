/**
 * Item.Description class string without the two-line clamp. Item.Description adds
 * `line-clamp-2`; Alert.Description renders it unclamped on a `div` so an alert can
 * carry full instructions, lists and paragraphs, and swaps its size for the density's
 * `--label-text`.
 * Item.Description and SelectionItem.Description render a `p`, so the string resets block
 * margins: a host without Tailwind's preflight would keep the user agent's 1em above and below,
 * and the content column's gap would no longer be the only space around the description.
 * Package-private. It is not on the `@elmeragroup/fuse/item` facade.
 */
import { cn } from "../../styles/cn";

export const ITEM_DESCRIPTION_CLASSES = cn(
  "text-sm leading-normal font-normal group-data-[size=xs]/item:text-xs m-0 text-left text-pretty text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary"
);
