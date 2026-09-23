/**
 * The control metrics each density sets. `fuse.css` declares the same values by hand in the
 * rules {@link DENSITY_SELECTORS} names, and `density-css.test.ts` requires both rules to equal
 * {@link DENSITY_METRICS}. Tooling that cannot read CSS, such as the demo-stage artifact and
 * the Figma sync, reads this module.
 */

import type { RemLength } from "../css-values";
import type { Density } from "../density";

/** The box or type property a metric sets, which decides how design tools offer it. */
export type DensityMetricKind = "height" | "padding" | "gap" | "fontSize" | "lineHeight";

/** The control sizes a sized family has one metric for, in `fuse.css` order. */
const CONTROL_SIZES = ["xs", "sm", "md", "lg"] as const;

/** The families with one metric per control size, such as `control-h-md`, in `fuse.css` order. */
const SIZED_FAMILIES = [
  { family: "control-h", kind: "height" },
  { family: "control-px", kind: "padding" },
  { family: "control-px-icon", kind: "padding" },
  { family: "control-gap", kind: "gap" },
] as const satisfies readonly { family: string; kind: DensityMetricKind }[];

/** The families that are one metric for every control size, in `fuse.css` order. */
const SINGLE_FAMILIES = [
  { family: "control-text", kind: "fontSize" },
  { family: "control-leading", kind: "lineHeight" },
] as const satisfies readonly { family: string; kind: DensityMetricKind }[];

/** One density control metric, the `--control-*` custom property without its leading dashes. */
export type DensityMetricName =
  | `${(typeof SIZED_FAMILIES)[number]["family"]}-${(typeof CONTROL_SIZES)[number]}`
  | (typeof SINGLE_FAMILIES)[number]["family"];

/** A family of control metrics and the kind they share. */
export type DensityMetricFamily = {
  /** The kind every metric of the family has. */
  readonly kind: DensityMetricKind;

  /** The family's metrics in `fuse.css` order. */
  readonly metrics: readonly DensityMetricName[];
};

/**
 * Every metric family in `fuse.css` order. A metric's name is built from its family, so its
 * kind cannot contradict the name.
 */
export const DENSITY_METRIC_FAMILIES: readonly DensityMetricFamily[] = [
  ...SIZED_FAMILIES.map(({ family, kind }) => ({
    kind,
    metrics: CONTROL_SIZES.map((size) => `${family}-${size}` as const),
  })),
  ...SINGLE_FAMILIES.map(({ family, kind }) => ({ kind, metrics: [family] })),
];

/** Every control metric in `fuse.css` order. */
export const DENSITY_METRIC_NAMES: readonly DensityMetricName[] = DENSITY_METRIC_FAMILIES.flatMap(
  (family) => family.metrics
);

/** A metric's `rem` length in each density. */
export type DensityMetricValues = { readonly [D in Density]: RemLength };

/**
 * Every control metric with its value per density, as the `rem` lengths `fuse.css` declares.
 * A new metric without an entry, or a value that is not a `rem` length, fails to compile.
 */
export const DENSITY_METRICS = {
  "control-h-xs": { dense: "1.5rem", comfortable: "2rem" },
  "control-h-sm": { dense: "2rem", comfortable: "2.25rem" },
  "control-h-md": { dense: "2.25rem", comfortable: "2.75rem" },
  "control-h-lg": { dense: "2.5rem", comfortable: "3rem" },
  "control-px-xs": { dense: "0.5rem", comfortable: "0.75rem" },
  "control-px-sm": { dense: "0.625rem", comfortable: "0.875rem" },
  "control-px-md": { dense: "0.625rem", comfortable: "0.875rem" },
  "control-px-lg": { dense: "0.625rem", comfortable: "0.875rem" },
  "control-px-icon-xs": { dense: "0.375rem", comfortable: "0.625rem" },
  "control-px-icon-sm": { dense: "0.375rem", comfortable: "0.625rem" },
  "control-px-icon-md": { dense: "0.5rem", comfortable: "0.75rem" },
  "control-px-icon-lg": { dense: "0.5rem", comfortable: "0.75rem" },
  "control-gap-xs": { dense: "0.25rem", comfortable: "0.375rem" },
  "control-gap-sm": { dense: "0.25rem", comfortable: "0.375rem" },
  "control-gap-md": { dense: "0.375rem", comfortable: "0.5rem" },
  "control-gap-lg": { dense: "0.375rem", comfortable: "0.5rem" },
  "control-text": { dense: "0.875rem", comfortable: "1.125rem" },
  "control-leading": { dense: "1.25rem", comfortable: "1.5rem" },
} as const satisfies Record<DensityMetricName, DensityMetricValues>;

/**
 * The `fuse.css` rule that declares each density's metrics. Dense is the default on `:root`,
 * and comfortable overrides it on the rooted attribute. The `fuse.css` cross-check in
 * `density-css.test.ts` is its only reader.
 */
export const DENSITY_SELECTORS = {
  dense: ":root",
  comfortable: ':root[data-density="comfortable"]',
} as const satisfies Record<Density, string>;
