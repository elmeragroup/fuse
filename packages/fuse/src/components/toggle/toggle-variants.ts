import { cn } from "../../styles/cn";
import { controlSize } from "../../styles/control-size";
import { compactCornerClass } from "../../styles/corner-radius";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

// This recipe is runtime-free, so ToggleGroup.Item can use it without Toggle's client graph.
// The state face composes the `native` and `data` targets, like Button's, and the
// hover and press faces sit behind the `enabled-hover:` and `enabled-active:` gates from
// fuse.css. A disabled toggle keeps pointer events, so a Tooltip on it still opens, and it
// never repaints or scales under the pointer. A pressed toggle fills with the theme's
// `toggle-pressed` pair. Neutral themes keep the quiet `muted` face on their neutral page.
// Branded themes fill with `primary`, since `muted` barely clears their tinted brand pages
// and would match the hover tint. `enabled-hover:` adds no specificity, so the pressed face
// outranks the hover tint and a pressed toggle keeps its face under the pointer. Each size is
// the control-size recipe's `min-square`, so a toggle is never narrower than it is tall.
export const toggleVariants = tv({
  base: cn(
    "group/toggle font-medium inline-flex items-center justify-center rounded-md whitespace-nowrap transition-[color,background-color,box-shadow,scale] aria-pressed:bg-toggle-pressed aria-pressed:text-toggle-pressed-foreground data-pressed:bg-toggle-pressed data-pressed:text-toggle-pressed-foreground enabled-hover:bg-muted enabled-hover:text-foreground enabled-active:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
