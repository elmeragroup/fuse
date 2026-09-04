import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlInsetMdClass } from "./control-inset";
import { selfFocusRingClass, withinFocusRingClass } from "./utils";

/**
 * The field box's *chrome* — the surface a reader recognises as "a field": elevation
 * rung, radius rung, hairline border, fill, and the transition that animates all three.
 *
 * Sibling of {@link fieldBox}: that recipe is a flat `box` axis consumed as a string by
 * Input/Textarea, and chrome is also painted by RAC `fieldGroupVariants` and Select's
 * trigger, which are not field-box variants. NumberField's group is a second sibling —
 * same chrome, plus flex/`within` focus/invalid ring. Export names stay.
 *
 * `internal-stack.test.ts` asserts every token here reaches all three consumers' computed
 * output and that none carries a second radius or elevation rung; `date-field.browser.test.tsx`
 * asserts the two boxes' *computed* radius and shadow are equal in one rendered form.
 */
export const fieldBoxChromeClass = cn(
  "shadow-xs rounded-md border border-input bg-card transition-[color,border-color,box-shadow]"
);

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
