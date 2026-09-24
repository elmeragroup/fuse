import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { compactCornerClass } from "../../styles/corner-radius";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";

// Runtime-free recipe so ToggleGroup.Item can borrow it without Toggle's client graph.
// The state face composes the `native` and `data` targets, like Button's, and the
// hover and press faces sit behind the `enabled-hover:` / `enabled-active:` gate from
// fuse.css, so a disabled toggle keeps pointer events (a Tooltip on it still opens) and
// never repaints or scales under the pointer.
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
        "text-xs h-(--control-h-xs) min-w-(--control-h-xs) gap-(--control-gap-xs) px-(--control-px-xs) has-data-[icon=inline-end]:pr-(--control-px-icon-xs) has-data-[icon=inline-start]:pl-(--control-px-icon-xs) [&_svg:not([class*='size-'])]:size-3",
        compactCornerClass
      ),
      sm: "text-sm h-(--control-h-sm) min-w-(--control-h-sm) gap-(--control-gap-sm) px-(--control-px-sm) has-data-[icon=inline-end]:pr-(--control-px-icon-sm) has-data-[icon=inline-start]:pl-(--control-px-icon-sm)",
      default:
        "h-(--control-h-md) min-w-(--control-h-md) gap-(--control-gap-md) px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)] has-data-[icon=inline-end]:pr-(--control-px-icon-md) has-data-[icon=inline-start]:pl-(--control-px-icon-md)",
      lg: "h-(--control-h-lg) min-w-(--control-h-lg) gap-(--control-gap-lg) px-(--control-px-lg) [font-size:var(--control-text)] [line-height:var(--control-leading)] has-data-[icon=inline-end]:pr-(--control-px-icon-lg) has-data-[icon=inline-start]:pl-(--control-px-icon-lg)",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
