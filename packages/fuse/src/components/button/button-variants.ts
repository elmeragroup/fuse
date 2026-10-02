import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { controlSize } from "../../styles/control-size";
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
// The text and icon sizes take their box from the control-size recipe: `default` is the md
// label, `icon*` the squares. The xs glyph size and `icon-inline`, a square as tall as the
// surrounding line that follows no density, stay local.
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
      default: controlSize({ size: "md", fit: "label" }),
      xs: controlSize({ size: "xs", fit: "label", class: "[&_svg:not([class*='size-'])]:size-3" }),
      sm: controlSize({ size: "sm", fit: "label" }),
      lg: controlSize({ size: "lg", fit: "label" }),
      icon: controlSize({ size: "md", fit: "square" }),
      "icon-xs": controlSize({ size: "xs", fit: "square", class: "[&_svg:not([class*='size-'])]:size-3" }),
      "icon-sm": controlSize({ size: "sm", fit: "square" }),
      "icon-inline": "hit-area-1 aspect-square h-lh w-auto",
      "icon-lg": controlSize({ size: "lg", fit: "square" }),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
