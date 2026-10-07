import { cn } from "../../styles/cn";
import { controlSize } from "../../styles/control-size";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
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
// label, `icon*` the squares. The labels replace the control inset with Button's own,
// `--control-px-button-*`, which comfortable density widens to the customer-facing
// reference's side padding while fields, Select and Toggle keep the control inset. The icon
// edge follows it: `--control-px-button-icon-*` replaces the control icon edge, so a leading
// or trailing icon does not sit tight against one end of a wide button. The xs
// glyph size and `icon-inline`, a square as tall as the surrounding line that follows no
// density, stay local.
// Every size rounds with the theme's `--radius-button`. The arbitrary value keeps
// tailwind-merge able to replace it with a consumer `rounded-*` class, which the custom
// `rounded-button` utility would not be.
// Inside a ButtonGroup a button keeps the group radius, `rounded-md`, not the button role.
// The group joins its buttons edge to edge, often with inputs and text, into one bar that
// rounds like a field, and a pill button would bulge out of that outline.
// The pointer cursor is the library's policy for an interactive control, as on the
// Accordion trigger and the selection labels. The state face's `disabled:`,
// `data-disabled:` and `aria-disabled:` cursors are variants, so they sort after this
// plain utility and a disabled button keeps `not-allowed`.
// While Button renders a pending indicator it stamps `data-pending-indicator`, and the
// recipe then hides the button's own leading and bare direct SVG children, so the indicator
// takes a leading icon's place, an icon-only square shows the indicator alone, and a spinner
// a consumer still places by hand is not doubled. A trailing `data-icon="inline-end"` icon
// stays, as its marker keeps the end inset tight either way, and text stays. With
// `pendingIndicator={null}` the attribute is absent and nothing hides.
// The outline border reads the theme's `--button-outline` at `--button-outline-width`: a 1px
// `--border` hairline in internal themes and the reference's 2px ring in the text color in
// external ones. A host without themes.css declares neither, so both fall back to the 1px
// `--border` hairline. Only the hairline casts `shadow-xs`, so the shadow spells out
// Tailwind's `shadow-xs` value as a function of the width, which a host `--shadow-xs`
// override does not reach. It equals `shadow-xs` at 1px. From 2px its blur is 0 and its
// spread plus blur plus y offset is negative, so it stays inside the border box, where an
// outer shadow never paints. It
// starts with two plain lengths, so tailwind-merge still files it as a shadow, and a
// consumer's own `shadow-*` utility replaces it.
export const buttonVariants = tv({
  base: cn(
    "group/button font-medium box-border inline-flex shrink-0 cursor-pointer items-center justify-center rounded-(--radius-button) border border-transparent bg-clip-padding p-0 whitespace-nowrap transition-[color,background-color,border-color,box-shadow,translate,opacity] select-none in-data-[slot=button-group]:rounded-md enabled-active:not-aria-[haspopup]:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[pending-indicator]:[&>svg:not([data-icon=inline-end])]:hidden",
    selfFocusRingClass,
    nativeStateFaceClass,
    dataStateFaceClass
  ),
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground enabled-hover:bg-primary/80",
      outline:
        "border-[length:var(--button-outline-width,1px)] border-button-outline bg-background shadow-[0_1px_max(0px,4px-2*var(--button-outline-width,1px))_min(0px,2px-2*var(--button-outline-width,1px))_rgb(0_0_0/0.05)] aria-expanded:bg-muted aria-expanded:text-foreground enabled-hover:bg-muted enabled-hover:text-foreground",
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
      default: controlSize({
        size: "md",
        fit: "label",
        class:
          "px-(--control-px-button-md) has-data-[icon=inline-end]:pr-(--control-px-button-icon-md) has-data-[icon=inline-start]:pl-(--control-px-button-icon-md)",
      }),
      xs: controlSize({
        size: "xs",
        fit: "label",
        class:
          "px-(--control-px-button-xs) has-data-[icon=inline-end]:pr-(--control-px-button-icon-xs) has-data-[icon=inline-start]:pl-(--control-px-button-icon-xs) [&_svg:not([class*='size-'])]:size-3",
      }),
      sm: controlSize({
        size: "sm",
        fit: "label",
        class:
          "px-(--control-px-button-sm) has-data-[icon=inline-end]:pr-(--control-px-button-icon-sm) has-data-[icon=inline-start]:pl-(--control-px-button-icon-sm)",
      }),
      lg: controlSize({
        size: "lg",
        fit: "label",
        class:
          "px-(--control-px-button-lg) has-data-[icon=inline-end]:pr-(--control-px-button-icon-lg) has-data-[icon=inline-start]:pl-(--control-px-button-icon-lg)",
      }),
      icon: controlSize({ size: "md", fit: "square" }),
      "icon-xs": controlSize({ size: "xs", fit: "square", class: "[&_svg:not([class*='size-'])]:size-3" }),
      "icon-sm": controlSize({ size: "sm", fit: "square" }),
      // The hit area extends the padding box, the `::before` containing block, by `hit-area-1`
      // or as far as the fixed 24px target needs. `100%` in an inset is that padding box, so
      // the border, of any variant or width, and a short line under a small host root cannot
      // take the target under 24px.
      "icon-inline": "hit-area-[max(0.25rem,calc((24px_-_100%)/2))] aspect-square h-lh w-auto",
      "icon-lg": controlSize({ size: "lg", fit: "square" }),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
