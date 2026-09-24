import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlInsetMdClass } from "./control-inset";
import { ariaStateFaceClass, nativeStateFaceClass, withinStateFaceClass } from "./state-face";
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

/**
 * NumberField group chrome — same elevation as Input, `within` focus. The group box is the
 * control, so it takes the within-target state face: it dims once and shows the
 * `not-allowed` cursor when its own `data-focus-ring-control` input, a direct child, is
 * disabled, and the input and steppers inside inherit that dim rather than painting their
 * own. The group also carries `aria-invalid` itself, so it takes the aria-target face for
 * the invalid look.
 */
export const numberFieldGroupClass = cn(
  fieldBoxChromeClass,
  "flex h-(--control-h-md) w-full min-w-0 items-center overflow-hidden",
  withinStateFaceClass,
  ariaStateFaceClass,
  withinFocusRingClass
);

/**
 * Package-private field-box chrome shared by Input and Textarea. Hosts add only
 * per-control deltas. The `box` axis picks the height model: `control` pins the
 * md control rung, `content` grows with its content — no host may cancel a
 * recipe class via twMerge. The disabled and invalid looks are the native-target state
 * face, whose `aria-disabled` arm dims an `aria-disabled` box as the gate stills it; the box
 * adds only its disabled fill.
 */
export const fieldBox = tv({
  base: cn(
    fieldBoxChromeClass,
    "w-full",
    controlInsetMdClass,
    "placeholder:text-muted-foreground disabled:bg-input/50",
    nativeStateFaceClass,
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
