import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { controlSize } from "../../styles/control-size";
import { compactCornerClass } from "../../styles/corner-radius";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";

// Runtime-free recipe so ToggleGroup.Item can borrow it without Toggle's client graph.
// The state face composes the `native` and `data` targets, like Button's, and the
// hover and press faces sit behind the `enabled-hover:` / `enabled-active:` gate from
// fuse.css, so a disabled toggle keeps pointer events (a Tooltip on it still opens) and
// never repaints or scales under the pointer. Each size is the control-size recipe's
// `min-square`, so a toggle is never narrower than it is tall.
export const toggleVariants = tv({
  base: cn(
    "group/toggle font-medium inline-flex items-center justify-center rounded-md whitespace-nowrap transition-[color,box-shadow,scale] aria-pressed:bg-muted data-pressed:bg-muted enabled-hover:bg-muted enabled-hover:text-foreground enabled-active:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    selfFocusRingClass,
    nativeStateFaceClass,
    dataStateFaceClass
  ),
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "shadow-xs border border-input bg-transparent enabled-hover:bg-muted",
    },
    size: {
      xs: cn(
        controlSize({ size: "xs", fit: "min-square" }),
        "[&_svg:not([class*='size-'])]:size-3",
        compactCornerClass
      ),
      sm: controlSize({ size: "sm", fit: "min-square" }),
      default: controlSize({ size: "md", fit: "min-square" }),
      lg: controlSize({ size: "lg", fit: "min-square" }),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
