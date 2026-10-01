import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { controlMd } from "./control-size-md";

/**
 * Control size: the size × fit mapping of the density-owned control metrics (`--control-*`
 * in `fuse.css`, mirrored by `theme/tokens/density-metrics.ts`) onto a control. Button,
 * Toggle and ToggleGroup, and RadioIconButton take their size classes from
 * {@link controlSize}. Select's trigger takes its label from {@link controlLabel}, and a
 * segmented ToggleGroup item takes its inset from the {@link controlMetrics} slots. Controls
 * without a size axis take the md parts from `control-size-md.ts`.
 *
 * Three rules live here and nowhere else. xs and sm set a fixed `text-xs` / `text-sm` that
 * does not follow density, while md and lg bind the density's `--control-text` /
 * `--control-leading` pair. The icon edge (`has-data-[icon=inline-*]`) swaps the label inset
 * for the tighter icon inset on the side a `data-icon="inline-start"` or `"inline-end"`
 * child sits. The wrap inset (`wrapInset`) is the vertical padding that keeps a one-line
 * `wrap` fit exactly as tall as the `label` fit: half of the height minus one line, less
 * the 1px border every Fuse control box draws. It reads the line as `1lh`, so one formula
 * serves the fixed xs and sm type and the density type alike, and the `min-h` floor still
 * holds on a borderless box.
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
 * height for icon-only controls, with no padding or type of its own. `wrap` is a label whose
 * text may break onto more lines: the label's height becomes a minimum, the wrap inset keeps
 * a one-line box the same height, and each further line adds one line height.
 */
export type ControlFit = "label" | "square" | "min-square" | "wrap";

/**
 * The metric parts of each control size, one slot per metric family.
 * {@link controlSize} assembles the fits from these parts. `iconInset` is the icon inset on
 * both sides, which a segmented ToggleGroup item takes in place of the label inset.
 * `minHeight` and `wrapInset` are the `wrap` fit's floor and vertical inset. Sidebar's
 * sub-button reads the parts it binds.
 */
export const controlMetrics = tv({
  slots: {
    height: "",
    minHeight: "",
    minWidth: "",
    square: "",
    gap: "",
    inset: "",
    iconInset: "",
    iconEdge: "",
    wrapInset: "",
    type: "",
  },
  variants: {
    size: {
      xs: {
        height: "h-(--control-h-xs)",
        minHeight: "min-h-(--control-h-xs)",
        minWidth: "min-w-(--control-h-xs)",
        square: "size-(--control-h-xs)",
        gap: "gap-(--control-gap-xs)",
        inset: "px-(--control-px-xs)",
        iconInset: "px-(--control-px-icon-xs)",
        iconEdge:
          "has-data-[icon=inline-end]:pr-(--control-px-icon-xs) has-data-[icon=inline-start]:pl-(--control-px-icon-xs)",
        wrapInset: "py-[calc((var(--control-h-xs)-1lh)/2-1px)]",
        type: "text-xs",
      },
      sm: {
        height: "h-(--control-h-sm)",
        minHeight: "min-h-(--control-h-sm)",
        minWidth: "min-w-(--control-h-sm)",
        square: "size-(--control-h-sm)",
        gap: "gap-(--control-gap-sm)",
        inset: "px-(--control-px-sm)",
        iconInset: "px-(--control-px-icon-sm)",
        iconEdge:
          "has-data-[icon=inline-end]:pr-(--control-px-icon-sm) has-data-[icon=inline-start]:pl-(--control-px-icon-sm)",
        wrapInset: "py-[calc((var(--control-h-sm)-1lh)/2-1px)]",
        type: "text-sm",
      },
      md: {
        height: controlMd.height(),
        minHeight: controlMd.minHeight(),
        minWidth: controlMd.minWidth(),
        square: controlMd.square(),
        gap: controlMd.gap(),
        inset: controlMd.inset(),
        iconInset: controlMd.iconInset(),
        iconEdge: controlMd.iconEdge(),
        wrapInset: controlMd.wrapInset(),
        type: controlMd.type(),
      },
      lg: {
        height: "h-(--control-h-lg)",
        minHeight: "min-h-(--control-h-lg)",
        minWidth: "min-w-(--control-h-lg)",
        square: "size-(--control-h-lg)",
        gap: "gap-(--control-gap-lg)",
        inset: "px-(--control-px-lg)",
        iconInset: "px-(--control-px-icon-lg)",
        iconEdge:
          "has-data-[icon=inline-end]:pr-(--control-px-icon-lg) has-data-[icon=inline-start]:pl-(--control-px-icon-lg)",
        wrapInset: "py-[calc((var(--control-h-lg)-1lh)/2-1px)]",
        // The density type pair is one metric for every size, so lg binds md's.
        type: controlMd.type(),
      },
    },
  },
});

/** Options for {@link controlLabel}. */
export type ControlLabelOptions = {
  /**
   * Whether the label maps a `data-icon="inline-start"` or `"inline-end"` child onto the
   * icon edge. `"omit"` is for a control that has never tightened its inset around an
   * icon child, as Select's trigger.
   */
  readonly iconEdge: "include" | "omit";
};

/**
 * The `label` fit of one control size: height, gap, inset and type, then the icon edge
 * unless the options omit it. {@link controlSize} builds its `label` and `min-square`
 * fits from this, and a control that composes its own size axis takes it too, so a new
 * label part reaches every label box.
 *
 * @param size - The control size.
 * @param options - Whether the label includes the icon edge.
 * @returns The label's size classes.
 * @example
 * controlLabel("sm", { iconEdge: "omit" })
 */
export function controlLabel(size: ControlSize, options: ControlLabelOptions): string {
  const parts = controlMetrics({ size });
  return cn(
    parts.height(),
    parts.gap(),
    parts.inset(),
    parts.type(),
    options.iconEdge === "include" && parts.iconEdge()
  );
}

/** One size × fit cell of {@link controlSize}. */
type ControlSizeCell = {
  readonly size: ControlSize;
  readonly fit: ControlFit;
  readonly class: string;
};

/**
 * The `wrap` fit of one control size: the label fit with its height relaxed to a minimum,
 * the wrap inset above and below, and wrapping text. A one-line label measures exactly the
 * `label` fit; a longer label grows one line height per line instead of overflowing.
 *
 * @param size - The control size.
 * @returns The wrapping label's size classes.
 * @example
 * controlWrap("md")
 */
export function controlWrap(size: ControlSize): string {
  const parts = controlMetrics({ size });
  return cn(
    parts.minHeight(),
    parts.wrapInset(),
    parts.gap(),
    parts.inset(),
    parts.type(),
    parts.iconEdge(),
    "whitespace-normal"
  );
}

/** The four fits of one size, as compound variants of {@link controlSize}. */
function fitsOf(size: ControlSize): readonly ControlSizeCell[] {
  const parts = controlMetrics({ size });
  const label = controlLabel(size, { iconEdge: "include" });
  return [
    { size, fit: "label", class: label },
    { size, fit: "min-square", class: cn(label, parts.minWidth()) },
    { size, fit: "square", class: parts.square() },
    { size, fit: "wrap", class: controlWrap(size) },
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
    fit: { label: "", square: "", "min-square": "", wrap: "" },
  },
  compoundVariants: [...fitsOf("xs"), ...fitsOf("sm"), ...fitsOf("md"), ...fitsOf("lg")],
});
