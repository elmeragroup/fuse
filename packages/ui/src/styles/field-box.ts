import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { focusRing } from "./utils";

/**
 * Package-private field-box chrome shared by Input and Textarea. Hosts add only
 * per-control deltas. The `box` axis picks the height model: `control` pins the
 * md control rung, `content` grows with its content — no host may cancel a
 * recipe class via twMerge.
 */
export const fieldBox = tv({
  base: cn(
    "shadow-xs w-full rounded-md border border-input bg-card px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)] transition-[color,border-color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
    focusRing({ target: "self" }).root()
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
