/**
 * The control metrics each density sets. `fuse.css` declares the same values by hand, the
 * dense ones on `:root` and the comfortable ones on `:root[data-density="comfortable"]`, and
 * `density-css.test.ts` requires both blocks to equal {@link DENSITY_METRICS}. Tooling that
 * cannot read CSS, such as the demo-stage artifact and the Figma sync, reads this module.
 */

import type { Density } from "../density";

/** The `--control-*` custom properties, without their leading dashes, in `fuse.css` order. */
export const DENSITY_METRIC_NAMES = [
  "control-h-xs",
  "control-h-sm",
  "control-h-md",
  "control-h-lg",
  "control-px-xs",
  "control-px-sm",
  "control-px-md",
  "control-px-lg",
  "control-px-icon-xs",
  "control-px-icon-sm",
  "control-px-icon-md",
  "control-px-icon-lg",
  "control-gap-xs",
  "control-gap-sm",
  "control-gap-md",
  "control-gap-lg",
  "control-text",
  "control-leading",
] as const;

/** One density control metric, such as `control-h-md`. */
export type DensityMetricName = (typeof DENSITY_METRIC_NAMES)[number];

/** The box or type property a metric sets, which decides how design tools offer it. */
export type DensityMetricKind = "height" | "padding" | "gap" | "fontSize" | "lineHeight";

/** A metric's kind and its CSS length in each density. */
export type DensityMetric = {
  readonly kind: DensityMetricKind;
} & { readonly [D in Density]: string };

/**
 * Every control metric with its value per density, as the `rem` lengths `fuse.css` declares.
 * A new metric without an entry fails to compile.
 */
export const DENSITY_METRICS = {
  "control-h-xs": { kind: "height", dense: "1.5rem", comfortable: "2rem" },
  "control-h-sm": { kind: "height", dense: "2rem", comfortable: "2.25rem" },
  "control-h-md": { kind: "height", dense: "2.25rem", comfortable: "2.75rem" },
  "control-h-lg": { kind: "height", dense: "2.5rem", comfortable: "3rem" },
  "control-px-xs": { kind: "padding", dense: "0.5rem", comfortable: "0.75rem" },
  "control-px-sm": { kind: "padding", dense: "0.625rem", comfortable: "0.875rem" },
  "control-px-md": { kind: "padding", dense: "0.625rem", comfortable: "0.875rem" },
  "control-px-lg": { kind: "padding", dense: "0.625rem", comfortable: "0.875rem" },
  "control-px-icon-xs": { kind: "padding", dense: "0.375rem", comfortable: "0.625rem" },
  "control-px-icon-sm": { kind: "padding", dense: "0.375rem", comfortable: "0.625rem" },
  "control-px-icon-md": { kind: "padding", dense: "0.5rem", comfortable: "0.75rem" },
  "control-px-icon-lg": { kind: "padding", dense: "0.5rem", comfortable: "0.75rem" },
  "control-gap-xs": { kind: "gap", dense: "0.25rem", comfortable: "0.375rem" },
  "control-gap-sm": { kind: "gap", dense: "0.25rem", comfortable: "0.375rem" },
  "control-gap-md": { kind: "gap", dense: "0.375rem", comfortable: "0.5rem" },
  "control-gap-lg": { kind: "gap", dense: "0.375rem", comfortable: "0.5rem" },
  "control-text": { kind: "fontSize", dense: "0.875rem", comfortable: "1.125rem" },
  "control-leading": { kind: "lineHeight", dense: "1.25rem", comfortable: "1.5rem" },
} as const satisfies Record<DensityMetricName, DensityMetric>;
