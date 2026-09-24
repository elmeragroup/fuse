import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlMd } from "./control-size-md";

/**
 * Control size: the size × fit mapping of the density-owned control metrics (`--control-*`
 * in `fuse.css`, mirrored by `theme/tokens/density-metrics.ts`) onto a control. Button,
 * Toggle and ToggleGroup, and RadioIconButton take their size classes from
 * {@link controlSize}. Select's trigger and a segmented ToggleGroup item compose their size
 * from the {@link controlMetrics} slots. Controls without a size axis take the md parts from
 * `control-size-md.ts`.
 *
 * Two rules live here and nowhere else. xs and sm set a fixed `text-xs` / `text-sm` that
 * does not follow density, while md and lg bind the density's `--control-text` /
 * `--control-leading` pair. The icon edge (`has-data-[icon=inline-*]`) swaps the label inset
 * for the tighter icon inset on the side a `data-icon="inline-start"` or `"inline-end"`
 * child sits.
 *
 * Apart from the icon edge, every size class is an unprefixed utility, so a consumer's
 * `className` utility of the same family (`h-12`, `px-4`) replaces it through tailwind-merge.
 *
 * The recipe paints size only. The state face (`state-face.ts`) is a separate fragment,
 * and each control recipe composes both.
 *
 * `control-size.browser.test.tsx` measures every consumer at both densities against
 * `DENSITY_METRICS`.
 */

/** A control size. Each has one metric per sized family in `DENSITY_METRICS`. */
export type ControlSize = "xs" | "sm" | "md" | "lg";

/**
 * A control size's fit: how the control's box fits its content. `label` is a padded box
 * with a label: height, gap, inset, type and the icon edge. `min-square` is a label that is
 * never narrower than it is tall, as Toggle is. `square` is a fixed square of the control
 * height for icon-only controls, with no padding or type of its own.
 */
export type ControlFit = "label" | "square" | "min-square";

/**
 * The metric parts of each control size, one slot per metric family.
 * {@link controlSize} assembles the fits from these parts. `iconInset` is the icon inset on
 * both sides, which a segmented ToggleGroup item takes in place of the label inset. Select's
 * trigger and Sidebar's sub-button read the parts they bind.
 */
export const controlMetrics = tv({
  slots: {
    height: "",
    minWidth: "",
    square: "",
    gap: "",
    inset: "",
    iconInset: "",
    iconEdge: "",
    type: "",
  },
  variants: {
    size: {
      xs: {
        height: "h-(--control-h-xs)",
        minWidth: "min-w-(--control-h-xs)",
        square: "size-(--control-h-xs)",
        gap: "gap-(--control-gap-xs)",
        inset: "px-(--control-px-xs)",
        iconInset: "px-(--control-px-icon-xs)",
        iconEdge:
          "has-data-[icon=inline-end]:pr-(--control-px-icon-xs) has-data-[icon=inline-start]:pl-(--control-px-icon-xs)",
        type: "text-xs",
      },
      sm: {
        height: "h-(--control-h-sm)",
        minWidth: "min-w-(--control-h-sm)",
        square: "size-(--control-h-sm)",
        gap: "gap-(--control-gap-sm)",
        inset: "px-(--control-px-sm)",
        iconInset: "px-(--control-px-icon-sm)",
        iconEdge:
          "has-data-[icon=inline-end]:pr-(--control-px-icon-sm) has-data-[icon=inline-start]:pl-(--control-px-icon-sm)",
        type: "text-sm",
      },
      md: {
        height: controlMd.height(),
        minWidth: controlMd.minWidth(),
        square: controlMd.square(),
        gap: controlMd.gap(),
        inset: controlMd.inset(),
        iconInset: controlMd.iconInset(),
        iconEdge: controlMd.iconEdge(),
        type: controlMd.type(),
      },
      lg: {
        height: "h-(--control-h-lg)",
        minWidth: "min-w-(--control-h-lg)",
        square: "size-(--control-h-lg)",
        gap: "gap-(--control-gap-lg)",
        inset: "px-(--control-px-lg)",
        iconInset: "px-(--control-px-icon-lg)",
        iconEdge:
          "has-data-[icon=inline-end]:pr-(--control-px-icon-lg) has-data-[icon=inline-start]:pl-(--control-px-icon-lg)",
        // The density type pair is one metric for every size, so lg binds md's.
        type: controlMd.type(),
      },
    },
  },
});

/** One size × fit cell of {@link controlSize}. */
type ControlSizeCell = {
  readonly size: ControlSize;
  readonly fit: ControlFit;
  readonly class: string;
};

/** The three fits of one size, as compound variants of {@link controlSize}. */
function fitsOf(size: ControlSize): readonly ControlSizeCell[] {
  const parts = controlMetrics({ size });
  const label = cn(parts.height(), parts.gap(), parts.inset(), parts.type(), parts.iconEdge());
  return [
    { size, fit: "label", class: label },
    { size, fit: "min-square", class: cn(label, parts.minWidth()) },
    { size, fit: "square", class: parts.square() },
  ];
}

/**
 * The size × fit recipe. Every class depends on both axes (a `square` takes the size's
 * square and none of its label parts), so each axis value paints nothing alone and each
 * cell is a compound variant assembled from the {@link controlMetrics} slots. Pass both
 * axes: a call without them paints no size.
 *
 * @example
 * controlSize({ size: "sm", fit: "label" })
 */
export const controlSize = tv({
  variants: {
    size: { xs: "", sm: "", md: "", lg: "" },
    fit: { label: "", square: "", "min-square": "" },
  },
  compoundVariants: [...fitsOf("xs"), ...fitsOf("sm"), ...fitsOf("md"), ...fitsOf("lg")],
});
