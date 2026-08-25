import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";

// Runtime-free recipe so ToggleGroup.Item can borrow it without Toggle's client graph.
export const toggleVariants = tv({
  base: cn(
    "group/toggle font-medium inline-flex items-center justify-center rounded-md whitespace-nowrap transition-[color,box-shadow,scale] hover:bg-muted hover:text-foreground active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-error/20 aria-pressed:bg-muted data-pressed:bg-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    focusRing({ target: "self" }).root()
  ),
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "shadow-xs border border-input bg-transparent hover:bg-muted",
    },
    size: {
      xs: "text-xs h-(--control-h-xs) min-w-(--control-h-xs) gap-(--control-gap-xs) rounded-[min(var(--radius-md),10px)] px-(--control-px-xs) has-data-[icon=inline-end]:pr-(--control-px-icon-xs) has-data-[icon=inline-start]:pl-(--control-px-icon-xs) [&_svg:not([class*='size-'])]:size-3",
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
