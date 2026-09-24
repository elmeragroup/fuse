import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";

// Runtime-free recipe so other components can borrow it without Button's client graph.
// The state face composes two targets. `native` covers a native <button> that borrows
// the recipe, and `data` covers Base UI roots that never match `:disabled`, such as
// `render={<a />}` or `focusableWhenDisabled`. Both carry the `aria-disabled` arm, which
// covers `isVisuallyDisabled` and a consumer's own `aria-disabled`. No target drops pointer events, so a Tooltip on a
// disabled button still opens, and Base UI already cancels clicks on a disabled root.
// Hover and press styles use the `enabled-hover:` and `enabled-active:` variants from
// fuse.css, so a disabled root never changes fill, border, text or position under the
// pointer. `aria-expanded:` follows an open popup, not the pointer, so it has no gate.
// Every size rounds with the theme's `--radius-button`. The arbitrary value keeps
// tailwind-merge able to replace it with a consumer `rounded-*` class, which the custom
// `rounded-button` utility would not be.
// Inside a ButtonGroup a button keeps the group radius, `rounded-md`, not the button role.
// The group joins its buttons edge to edge, often with inputs and text, into one bar that
// rounds like a field, and a pill button would bulge out of that outline.
export const buttonVariants = tv({
  base: cn(
    "group/button font-medium box-border inline-flex shrink-0 items-center justify-center rounded-(--radius-button) border border-transparent bg-clip-padding p-0 whitespace-nowrap transition-[color,background-color,border-color,box-shadow,translate,opacity] select-none in-data-[slot=button-group]:rounded-md enabled-active:not-aria-[haspopup]:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    selfFocusRingClass,
    nativeStateFaceClass,
    dataStateFaceClass
  ),
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground enabled-hover:bg-primary/80",
      outline:
        "shadow-xs border-border bg-background aria-expanded:bg-muted aria-expanded:text-foreground enabled-hover:bg-muted enabled-hover:text-foreground",
      secondary:
        "bg-secondary text-secondary-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground enabled-hover:bg-secondary-hover",
      ghost:
        "aria-expanded:bg-muted aria-expanded:text-foreground enabled-hover:bg-muted enabled-hover:text-foreground",
      destructive:
        "border-error/20 bg-error/10 text-error enabled-hover:border-error enabled-hover:bg-error/20",
      success:
        "border-success/20 bg-success/10 text-success enabled-hover:border-success enabled-hover:bg-success/20",
      link: "text-primary underline-offset-4 enabled-hover:underline",
    },
    size: {
      default:
        "h-(--control-h-md) gap-(--control-gap-md) px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)] has-data-[icon=inline-end]:pr-(--control-px-icon-md) has-data-[icon=inline-start]:pl-(--control-px-icon-md)",
      xs: "text-xs h-(--control-h-xs) gap-(--control-gap-xs) px-(--control-px-xs) has-data-[icon=inline-end]:pr-(--control-px-icon-xs) has-data-[icon=inline-start]:pl-(--control-px-icon-xs) [&_svg:not([class*='size-'])]:size-3",
      sm: "text-sm h-(--control-h-sm) gap-(--control-gap-sm) px-(--control-px-sm) has-data-[icon=inline-end]:pr-(--control-px-icon-sm) has-data-[icon=inline-start]:pl-(--control-px-icon-sm)",
      lg: "h-(--control-h-lg) gap-(--control-gap-lg) px-(--control-px-lg) [font-size:var(--control-text)] [line-height:var(--control-leading)] has-data-[icon=inline-end]:pr-(--control-px-icon-lg) has-data-[icon=inline-start]:pl-(--control-px-icon-lg)",
      icon: "size-(--control-h-md)",
      "icon-xs": "size-(--control-h-xs) [&_svg:not([class*='size-'])]:size-3",
      "icon-sm": "size-(--control-h-sm)",
      "icon-inline": "hit-area-1 aspect-square h-lh w-auto",
      "icon-lg": "size-(--control-h-lg)",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
