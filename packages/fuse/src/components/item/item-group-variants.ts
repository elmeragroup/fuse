import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { itemCompactShellClass, itemCompactSmShellClass } from "../../styles/inner-corner/item";
import { tv } from "../../styles/tv";

/**
 * The `Item.Group` recipe. `root` lays out the group, `item` is what each `Item.Root` inside
 * it adds to its own classes, and `separator` spaces `Item.Separator`. The `size` axis is the
 * row's own size, so the compact padding lands as plain classes that a row's `className` can
 * still override.
 *
 * The compact variant draws one connected list: no gap, tighter rows (`xs` keeps its own
 * padding) and flush separators. Outline rows drop their corners and bottom edge, so each
 * shared edge is one line; the group then rounds the outer corners and closes the bottom edge
 * on its first and last visible child, skipping `hidden` ones through `:nth-child(1 of
 * :not([hidden]))` and its `nth-last-child` mirror. That child is the row itself, or the
 * `item-listitem` wrapper around a row with a `render` element (the wrapper copies the row's
 * `hidden`), so each corner rule has both forms. A boolean-`hidden` direct row also gets
 * `display: none` from the group, because without preflight its own `flex` beats the
 * user-agent `[hidden]` rule and the row would still paint between the skipped endpoints.
 * The wrapper carries no display class, so the user-agent rule already hides it.
 *
 * Package-private: not exported from `package.json#exports` or the `Item` namespace.
 */
export const itemGroupVariants = tv({
  slots: {
    root: "group/item-group flex w-full flex-col",
    item: "",
    separator: "",
  },
  variants: {
    variant: {
      default: {
        root: "gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",
        separator: "my-2",
      },
      compact: {
        root: cn(
          "gap-0 [&>[data-slot=item][hidden]:not([hidden=until-found])]:hidden",
          "[&>[data-variant=outline]:nth-child(1_of_:not([hidden]))]:rounded-t-md",
          "[&>[data-variant=outline]:nth-last-child(1_of_:not([hidden]))]:rounded-b-md [&>[data-variant=outline]:nth-last-child(1_of_:not([hidden]))]:border-b",
          "[&>:nth-child(1_of_:not([hidden]))>[data-slot=item][data-variant=outline]]:rounded-t-md",
          "[&>:nth-last-child(1_of_:not([hidden]))>[data-slot=item][data-variant=outline]]:rounded-b-md [&>:nth-last-child(1_of_:not([hidden]))>[data-slot=item][data-variant=outline]]:border-b"
        ),
        item: "data-[variant=outline]:rounded-none data-[variant=outline]:border-b-0",
        separator: "my-0",
      },
    },
    size: {
      default: "",
      sm: "",
      xs: "",
    },
  },
  compoundVariants: [
    { variant: "compact", size: "default", class: { item: itemCompactShellClass } },
    { variant: "compact", size: "sm", class: { item: itemCompactSmShellClass } },
  ],
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

/** The look of an `Item.Group`: spaced rows, or one connected compact list. */
export type ItemGroupVariant = NonNullable<VariantProps<typeof itemGroupVariants>["variant"]>;
