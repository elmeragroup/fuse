/**
 * PUBLIC recipe. Consumers borrow it from
 * `@elmeragroup/fuse/pagination`. Layout only — colors, radius, focus ring, and
 * control-box sizing come from the borrowed public `buttonVariants`.
 *
 * `direction` is not a consumer-facing prop. No recipe
 * default — Previous/Next pass the axis internally (ConfirmButton/TimelineList).
 *
 * `pl-2.5` / `pr-2.5` are reviewed chevron-side layout literals, not a
 * control-box size axis. The ellipsis is the md control square, so it matches its sibling
 * links at either density.
 */
import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import { tv } from "../../styles/tv";

export const paginationVariants = tv({
  slots: {
    base: "mx-auto flex w-full flex-col items-center justify-center space-y-4",
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the gap between pagination items is layout, not a control rung
    content: "flex max-w-full flex-row flex-wrap items-center justify-center gap-1",
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the chevron-to-label gap is fixed layout inside the borrowed button
    link: "gap-1",
    linkIcon: "size-4",
    ellipsis: cn("flex items-center justify-center", controlMd.square()),
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
