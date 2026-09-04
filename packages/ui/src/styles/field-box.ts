import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlInsetMdClass } from "./control-inset";
import { selfFocusRingClass, withinFocusRingClass } from "./utils";

/**
 * The field box's *chrome* — the surface a reader recognises as "a field": elevation
 * rung, radius rung, hairline border, fill, and the transition that animates all three.
 *
 * It is a standalone constant because every field box paints it and they must not drift
 * (spec 08 user story 6; date-field.md §8.9, 2026-09-03): the base-ui tier through
 * {@link fieldBox} below and NumberField's group, and the interim react-aria tier through
 * `fieldGroupVariants` in `react-aria/internal/field.tsx`. Everything that is *not*
 * chrome stays with its consumer — padding, the control-type pair, the focus adapter
 * (`self` for a focusable control, `state` for RAC's non-focusable `Group`, `within` for
 * NumberField), and the disabled/invalid faces, which they express through different
 * selectors.
 *
 * `internal-stack.test.ts` asserts every token here reaches all three consumers' computed
 * output and that none carries a second radius or elevation rung; `date-field.browser.test.tsx`
 * asserts the two boxes' *computed* radius and shadow are equal in one rendered form.
 * A `satisfies` could not give either guard.
 */
export const fieldBoxChromeClass =
  "shadow-xs rounded-md border border-input bg-card transition-[color,border-color,box-shadow]";

/** NumberField group chrome — same elevation as Input, `within` focus, invalid ring. */
export const numberFieldGroupClass = cn(
  fieldBoxChromeClass,
  "flex h-(--control-h-md) w-full min-w-0 items-center overflow-hidden aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
  withinFocusRingClass
);

/**
 * Package-private field-box chrome shared by Input and Textarea. Hosts add only
 * per-control deltas. The `box` axis picks the height model: `control` pins the
 * md control rung, `content` grows with its content — no host may cancel a
 * recipe class via twMerge.
 */
export const fieldBox = tv({
  base: cn(
    fieldBoxChromeClass,
    "w-full",
    controlInsetMdClass,
    "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
    selfFocusRingClass
  ),
  variants: {
    box: {
      control: "h-(--control-h-md)",
      content: "min-h-16 py-2",
    },
  },
  defaultVariants: {
    box: "control",
  },
});
