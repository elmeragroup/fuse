/**
 * The metrics each density sets, grouped by the density role that reads them: control metrics
 * (`--control-*`), row metrics (`--row-*`), surface metrics (`--surface-pad-*`,
 * `--surface-gap-*`) and label metrics (`--label-*`). `fuse.css` declares the same values by
 * hand, dense on `:root` and comfortable on `:root[data-density="comfortable"]`, and
 * `density-css.test.ts` requires both rules to equal {@link DENSITY_METRICS}. Tooling that cannot
 * read CSS, such as the demo-stage artifact and the resolved theme catalog the Figma sync reads,
 * reads this module.
 */

import type { RemLength } from "../css-values";
import type { Density } from "../density";
import type { DensityRole } from "./density-roles";

/** The box or type property a metric sets, which decides how design tools offer it. */
export type DensityMetricKind = "height" | "padding" | "gap" | "fontSize" | "lineHeight";

/** The roles that read density metrics; `layout` and `fixed` parts read none. */
export type DensityMetricRole = Exclude<DensityRole, "layout" | "fixed">;

/** A family's name stem, the kind its metrics set and the role that reads them. */
type FamilySpec = { family: string; kind: DensityMetricKind; role: DensityMetricRole };

/** The control sizes a sized family has one metric for, in `fuse.css` order. */
const CONTROL_SIZES = ["xs", "sm", "md", "lg"] as const;

/** One control size, such as `md`. */
type ControlSize = (typeof CONTROL_SIZES)[number];

/** A family with one metric per control size, and what the metric at each size is for. */
type SizedFamilySpec = FamilySpec & { describe: (size: ControlSize) => string };

/** A family that is one metric, and what the metric is for. */
type SingleFamilySpec = FamilySpec & { description: string };

/**
 * The families with one metric per control size, such as `control-h-md`, in `fuse.css` order.
 * `control-px-button` is Button's label inset. Dense matches `control-px`, and comfortable,
 * the external default, takes the side padding of the customer-facing reference button,
 * except at xs, which keeps `control-px` until design picks one. `control-px-button-icon` is
 * the edge beside a leading or trailing icon on those labels. Dense matches `control-px-icon`,
 * and comfortable, from sm up, keeps it at three quarters of the label inset, so the icon and
 * its gap balance the label side; xs keeps `control-px-icon` until design picks one. Only
 * Button reads the two families, so fields, Select and Toggle keep `control-px` and
 * `control-px-icon`.
 */
const SIZED_FAMILIES = [
  {
    family: "control-h",
    kind: "height",
    role: "control",
    describe: (size) => `The height of a control at size ${size}, such as a Button, Input or Select.`,
  },
  {
    family: "control-px",
    kind: "padding",
    role: "control",
    describe: (size) =>
      `The inline padding of a control label at size ${size}, such as in an Input or a Select. Button pads with control-px-button-${size} instead.`,
  },
  {
    family: "control-px-icon",
    kind: "padding",
    role: "control",
    describe: (size) =>
      `The padding on the edge of a control beside a leading or trailing icon at size ${size}. Button pads with control-px-button-icon-${size} instead.`,
  },
  {
    family: "control-px-button",
    kind: "padding",
    role: "control",
    describe: (size) =>
      `The inline padding of Button at size ${size}. It matches control-px-${size} when dense, and from sm up it widens to the padding of the customer-facing reference when comfortable.`,
  },
  {
    family: "control-px-button-icon",
    kind: "padding",
    role: "control",
    describe: (size) =>
      `The padding of Button on the edge beside a leading or trailing icon at size ${size}.`,
  },
  {
    family: "control-gap",
    kind: "gap",
    role: "control",
    describe: (size) =>
      `The gap between the pieces of a control at size ${size}, such as its icon and label.`,
  },
] as const satisfies readonly SizedFamilySpec[];

/**
 * The families that are one metric each, in `fuse.css` order.
 *
 * - `control-text` and `control-leading` are a control's type.
 * - The row metrics size one line of a collection: a menu, listbox, navigation or sidebar row.
 *   A row keeps 14/20 text at both densities, so `2 × row-py + 20px` is `row-h`, and a wrapped
 *   row grows by its leading. `row-h-header` is a table head, `row-h` plus 8px.
 * - `label-text` and `label-leading` are the words that describe a control, such as a selection
 *   row's title and description, and the text of a notice set beside the controls, such as an
 *   Alert's title and body. Dense matches `text-sm`, and comfortable takes the
 *   customer-facing reference radio card's 16px, a step below the 18px field and button text.
 */
const SINGLE_FAMILIES = [
  {
    family: "control-text",
    kind: "fontSize",
    role: "control",
    description: "The font size of control text at sizes md and lg. Sizes xs and sm keep a fixed size.",
  },
  {
    family: "control-leading",
    kind: "lineHeight",
    role: "control",
    description: "The line height of control text at sizes md and lg.",
  },
  {
    family: "row-h",
    kind: "height",
    role: "row",
    description:
      "The height of one line of a collection, such as a menu, listbox, navigation or sidebar row.",
  },
  {
    family: "row-h-header",
    kind: "height",
    role: "row",
    description: "The height of a table head row, row-h plus 8px.",
  },
  {
    family: "row-px",
    kind: "padding",
    role: "row",
    description: "The inline padding of one line of a collection, such as a menu row.",
  },
  {
    family: "row-py",
    kind: "padding",
    role: "row",
    description: "The block padding of one line of a collection, such as a menu row.",
  },
  {
    family: "label-text",
    kind: "fontSize",
    role: "label",
    description:
      "The font size of the words that describe a control, such as field labels and selection row text, and of the title and body of an Alert.",
  },
  {
    family: "label-leading",
    kind: "lineHeight",
    role: "label",
    description:
      "The line height of label text in field labels, descriptions and errors and in plain-text selection rows. Alert text and selection row titles and descriptions set their own line height.",
  },
] as const satisfies readonly SingleFamilySpec[];

/**
 * The surface padding tiers, in `fuse.css` order. A shell pads with its tier by what it holds:
 * `sm` around control-sized rows, `md` around compact content and `lg` around content surfaces.
 */
const SURFACE_PAD_TIERS = ["sm", "md", "lg"] as const;

/** What each surface padding tier pads. */
const SURFACE_PAD_DESCRIPTIONS = {
  sm: "The padding of shells that hold control-sized rows, such as menus, Select and Combobox lists and Calendar. It is the same at both densities.",
  md: "The padding of shells around compact content, such as Popover, Toast and Accordion items.",
  lg: "The padding of content surfaces, such as Card sections, Dialog, Frame panels and Empty.",
} as const satisfies Record<(typeof SURFACE_PAD_TIERS)[number], string>;

/**
 * The surface gap tiers, in `fuse.css` order: the space between the parts a stack groups, such
 * as options (`sm`), a field's label and control (`md`), option rows laid out in a line or
 * nested groups (`lg`), and the fields of a set (`xl`). Gaps of 6px or less between one part's
 * own pieces are part spacing and stay fixed.
 */
const SURFACE_GAP_TIERS = ["sm", "md", "lg", "xl"] as const;

/** What each surface gap tier spaces. */
const SURFACE_GAP_DESCRIPTIONS = {
  sm: "The gap between the options of a stack.",
  md: "The gap between the parts of a field, such as its label and control.",
  lg: "The gap between option rows laid out in a line, or between nested groups.",
  xl: "The gap between the fields of a set.",
} as const satisfies Record<(typeof SURFACE_GAP_TIERS)[number], string>;

/** The family with one surface metric per padding tier: a shell's padding. */
const SURFACE_PAD_FAMILY = {
  family: "surface-pad",
  kind: "padding",
  role: "surface",
} as const satisfies FamilySpec;

/** The family with one surface metric per gap tier: a stack's gap. */
const SURFACE_GAP_FAMILY = {
  family: "surface-gap",
  kind: "gap",
  role: "surface",
} as const satisfies FamilySpec;

/** One density metric, the custom property without its leading dashes. */
export type DensityMetricName =
  | `${(typeof SIZED_FAMILIES)[number]["family"]}-${ControlSize}`
  | (typeof SINGLE_FAMILIES)[number]["family"]
  | `${(typeof SURFACE_PAD_FAMILY)["family"]}-${(typeof SURFACE_PAD_TIERS)[number]}`
  | `${(typeof SURFACE_GAP_FAMILY)["family"]}-${(typeof SURFACE_GAP_TIERS)[number]}`;

/** One metric of a family, with what it is for. */
export type DensityMetricSpec = {
  /** The custom property without its leading dashes. */
  readonly name: DensityMetricName;

  /** What the metric is for, in one or two sentences for a designer picking a variable. */
  readonly description: string;
};

/** A family of density metrics, the kind they share and the role that reads them. */
export type DensityMetricFamily = {
  /** The kind every metric of the family has. */
  readonly kind: DensityMetricKind;

  /** The density role whose parts read the family. */
  readonly role: DensityMetricRole;

  /** The family's metrics in `fuse.css` order. */
  readonly metrics: readonly DensityMetricSpec[];
};

/**
 * Every metric family in `fuse.css` order. A metric's name is built from its family, so its
 * kind and role cannot contradict the name.
 */
export const DENSITY_METRIC_FAMILIES: readonly DensityMetricFamily[] = [
  ...SIZED_FAMILIES.map(({ family, kind, role, describe }) => ({
    kind,
    role,
    metrics: CONTROL_SIZES.map((size) => ({
      name: `${family}-${size}` as const,
      description: describe(size),
    })),
  })),
  ...SINGLE_FAMILIES.map(({ family, kind, role, description }) => ({
    kind,
    role,
    metrics: [{ name: family, description }],
  })),
  {
    kind: SURFACE_PAD_FAMILY.kind,
    role: SURFACE_PAD_FAMILY.role,
    metrics: SURFACE_PAD_TIERS.map((tier) => ({
      name: `${SURFACE_PAD_FAMILY.family}-${tier}` as const,
      description: SURFACE_PAD_DESCRIPTIONS[tier],
    })),
  },
  {
    kind: SURFACE_GAP_FAMILY.kind,
    role: SURFACE_GAP_FAMILY.role,
    metrics: SURFACE_GAP_TIERS.map((tier) => ({
      name: `${SURFACE_GAP_FAMILY.family}-${tier}` as const,
      description: SURFACE_GAP_DESCRIPTIONS[tier],
    })),
  },
];

/** Every density metric in `fuse.css` order. */
export const DENSITY_METRIC_NAMES: readonly DensityMetricName[] = DENSITY_METRIC_FAMILIES.flatMap((family) =>
  family.metrics.map((metric) => metric.name)
);

/** A metric's `rem` length in each density. */
export type DensityMetricValues = { readonly [D in Density]: RemLength };

/**
 * Every density metric with its value per density, as the `rem` lengths `fuse.css` declares.
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
  "control-px-button-xs": { dense: "0.5rem", comfortable: "0.75rem" },
  "control-px-button-sm": { dense: "0.625rem", comfortable: "1rem" },
  "control-px-button-md": { dense: "0.625rem", comfortable: "2rem" },
  "control-px-button-lg": { dense: "0.625rem", comfortable: "2rem" },
  "control-px-button-icon-xs": { dense: "0.375rem", comfortable: "0.625rem" },
  "control-px-button-icon-sm": { dense: "0.375rem", comfortable: "0.75rem" },
  "control-px-button-icon-md": { dense: "0.5rem", comfortable: "1.5rem" },
  "control-px-button-icon-lg": { dense: "0.5rem", comfortable: "1.5rem" },
  "control-gap-xs": { dense: "0.25rem", comfortable: "0.375rem" },
  "control-gap-sm": { dense: "0.25rem", comfortable: "0.375rem" },
  "control-gap-md": { dense: "0.375rem", comfortable: "0.5rem" },
  "control-gap-lg": { dense: "0.375rem", comfortable: "0.5rem" },
  "control-text": { dense: "0.875rem", comfortable: "1.125rem" },
  "control-leading": { dense: "1.25rem", comfortable: "1.5rem" },
  "row-h": { dense: "2rem", comfortable: "2.25rem" },
  "row-h-header": { dense: "2.5rem", comfortable: "2.75rem" },
  "row-px": { dense: "0.5rem", comfortable: "0.75rem" },
  "row-py": { dense: "0.375rem", comfortable: "0.5rem" },
  "label-text": { dense: "0.875rem", comfortable: "1rem" },
  "label-leading": { dense: "1.25rem", comfortable: "1.5rem" },
  "surface-pad-sm": { dense: "0.25rem", comfortable: "0.25rem" },
  "surface-pad-md": { dense: "0.75rem", comfortable: "1rem" },
  "surface-pad-lg": { dense: "1rem", comfortable: "1.5rem" },
  "surface-gap-sm": { dense: "0.5rem", comfortable: "0.75rem" },
  "surface-gap-md": { dense: "0.75rem", comfortable: "1rem" },
  "surface-gap-lg": { dense: "1rem", comfortable: "1.5rem" },
  "surface-gap-xl": { dense: "1.5rem", comfortable: "2rem" },
} as const satisfies Record<DensityMetricName, DensityMetricValues>;
