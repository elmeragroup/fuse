import { tv } from "tailwind-variants";

/**
 * Module-private recipe for the avatar frame. Not exported from
 * `@elmeragroup/ui/avatar` — there is no proven recipe-borrowing use. `grouped`
 * owns the separating ring so the docs demos never restyle the component.
 */
export const avatarVariants = tv({
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- avatar's square is a decorative size, not a control-box rung
  base: "text-sm font-medium inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-muted-foreground select-none",
  variants: {
    grouped: {
      true: "ring-2 ring-background",
    },
  },
  defaultVariants: {
    grouped: false,
  },
});
