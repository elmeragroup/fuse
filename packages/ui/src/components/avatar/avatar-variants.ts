/**
 * Module-private Avatar recipe (avatar.md §4). Not exported from
 * `@elmeragroup/ui/avatar` — size stays a `className` concern, so there is no
 * public axis. Empty `variants` / `defaultVariants` satisfy
 * `elmera/enforce-variant-standard` on this colocated module.
 */
import { tv } from "tailwind-variants";

export const avatarVariants = tv({
  slots: {
    root: "text-sm font-medium inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-muted-foreground select-none",
  },
  variants: {},
  defaultVariants: {},
});

export const ROOT_CLASSES = avatarVariants().root();
