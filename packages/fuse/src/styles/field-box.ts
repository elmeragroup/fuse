import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlInsetMdClass } from "./control-inset";
import { selfFocusRingClass, withinFocusRingClass } from "./utils";

/**
 * The field box chrome: elevation, radius, hairline border, fill and the transition that
 * animates them. {@link fieldBox} paints it for Input and Textarea. RAC
 * `fieldGroupVariants`, Select's trigger and NumberField's group paint it without being
 * `fieldBox` variants.
 *
 * `field-box.test.ts` pins the tokens. `internal-stack.test.ts` checks that each token
 * reaches every consumer's merged classes and that no consumer adds a second radius or
 * elevation rung. `date-field.browser.test.tsx` compares the computed radius and shadow of
 * two rendered boxes.
 */
export const fieldBoxChromeClass = cn(
  "shadow-xs box-border rounded-md border border-input bg-card transition-[color,border-color,box-shadow]"
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
      control: "h-(--control-h-md) py-0",
      content: "min-h-16 py-2",
    },
  },
  defaultVariants: {
    box: "control",
  },
});
