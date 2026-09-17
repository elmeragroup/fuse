/**
 * PUBLIC recipe. Consumers borrow it from
 * `@elmeragroup/ui/pagination`. Layout only — colors, radius, focus ring, and
 * control-box sizing come from the borrowed public `buttonVariants`.
 *
 * `direction` is not a consumer-facing prop. No recipe
 * default — Previous/Next pass the axis internally (ConfirmButton/TimelineList).
 *
 * `pl-2.5` / `pr-2.5` are spec-named chevron-side layout literals, not a
 * control-box size axis. `size-9` on the ellipsis slot is
 * the spec-named decorative box, not a density rung.
 */
import { tv } from "tailwind-variants";

export const paginationVariants = tv({
  slots: {
    base: "mx-auto flex w-full flex-col items-center justify-center space-y-4",
    content: "flex max-w-full flex-row flex-wrap items-center justify-center gap-1",
    link: "gap-1",
    linkIcon: "size-4",
    ellipsis: "flex size-9 items-center justify-center",
    ellipsisIcon: "size-4",
  },
  variants: {
    direction: {
      previous: {
        link: "pl-2.5",
      },
      next: {
        link: "pr-2.5",
      },
    },
  },
  // Required shape: elmera/enforce-variant-standard makes every recipe declare
  // `defaultVariants`. There is no default direction — Previous/Next pass the axis.
  defaultVariants: {},
});
