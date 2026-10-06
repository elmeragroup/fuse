import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlMdInsetTypeClass } from "./control-size-md";
import { fieldCornerClass } from "./corner-radius";
import { ariaStateFaceClass, nativeStateFaceClass, withinStateFaceClass } from "./state-face";
import { selfFocusRingClass, withinFocusRingClass } from "./utils";

/**
 * The field box chrome: elevation, the field corner, hairline border, fill and the transition
 * that animates them. The corner is `--radius-field` in external themes and `--radius` in
 * internal ones (`corner-radius.ts`). {@link fieldBox} paints it for Input and Textarea. RAC
 * `fieldGroupVariants`, Select's trigger, NumberField's group and InputGroup's root paint it
 * without being `fieldBox` variants.
 *
 * `field-box.test.ts` pins the tokens. `internal-stack.test.ts` checks that each token
 * reaches every consumer's merged classes and that no consumer adds a second radius or
 * elevation rung. `date-field.browser.test.tsx` compares the computed radius and shadow of
 * two rendered boxes.
 */
export const fieldBoxChromeClass = cn(
  "shadow-xs box-border",
  fieldCornerClass,
  "border border-input bg-card transition-[color,border-color,box-shadow]"
);

/**
 * The read-only fill, the React Aria FieldGroup's `isReadOnly` face, so a read-only Input
 * reads as locked next to a read-only DateField. It keys off the `readonly` attribute, not
 * `:read-only`, which also matches a disabled input and a file input, and it leaves a
 * disabled box its disabled fill.
 */
export const readOnlyFillClass = "[&[readonly]:not(:disabled)]:bg-muted";

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
 * InputGroup root chrome — the whole field box around a stripped `InputGroup.Input` or
 * `InputGroup.Textarea`, so it paints the shared chrome, fill included, once. It pins the md
 * control rung, and block addons and textareas grow it instead. Like NumberField's group it
 * takes the within-target state face from its own `data-focus-ring-control` control, a direct
 * child, plus that control's disabled and read-only fills.
 */
export const inputGroupRootClass = cn(
  fieldBoxChromeClass,
  "group/input-group relative flex h-(--control-h-md) w-full min-w-0 items-center",
  "has-[>[data-focus-ring-control]:disabled]:bg-input/50",
  "has-[>[data-focus-ring-control][readonly]:not(:disabled)]:bg-muted",
  "has-[[data-focus-ring-control]:focus-visible]:border-ring",
  withinStateFaceClass,
  "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto",
  "has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
  withinFocusRingClass
);

/**
 * Package-private field-box chrome shared by Input and Textarea. Hosts add only
 * per-control deltas. The `box` axis picks the height model: `control` pins the
 * md control rung, `content` grows with its content — no host may cancel a
 * recipe class via twMerge. The disabled and invalid looks are the native-target state
 * face, whose `aria-disabled` arm dims an `aria-disabled` box as the gate stills it; the box
 * adds only its disabled fill and {@link readOnlyFillClass}.
 */
export const fieldBox = tv({
  base: cn(
    fieldBoxChromeClass,
    "w-full",
    controlMdInsetTypeClass,
    "placeholder:text-muted-foreground disabled:bg-input/50",
    readOnlyFillClass,
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
