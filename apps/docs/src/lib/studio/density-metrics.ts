import type { Density } from "@elmeragroup/fuse/theme";
import type { DensityMetricName, DensityRole } from "@elmeragroup/fuse/theme-catalog";

import { DENSITY_CATALOG, DENSITY_METRIC_ORDER } from "../../generated/density-catalog";
import type { CustomProperties } from "./artboard-style";

/** Metric edits for one density, in px, keyed by metric name without its leading dashes. */
export type MetricOverrides = Readonly<Partial<Record<DensityMetricName, number>>>;

/** The visitor's metric edits per density. A density without edits may be absent. */
export type DensityOverrides = Readonly<Partial<Record<Density, MetricOverrides>>>;

/** One metric the studio edits: its name, the role that reads it and its base px per density. */
export type StudioMetric = {
  readonly name: DensityMetricName;
  readonly role: DensityRole;
  readonly px: { readonly [D in Density]: number };
};

const NAMES: ReadonlySet<string> = new Set(
  DENSITY_CATALOG.flatMap(({ metrics }) => metrics.map(({ name }) => name))
);

/** Whether `name` is a density metric, such as `control-h-md`. */
export function isMetricName(name: string): name is DensityMetricName {
  return NAMES.has(name);
}

/**
 * Every density metric in `fuse.css` order, with its role and its base px per density. The
 * catalog groups metrics by role, which puts surface metrics before label text, so the order
 * comes from its `fuse.css` sequence.
 */
export const STUDIO_METRICS: readonly StudioMetric[] = DENSITY_CATALOG.flatMap(({ role, metrics }) =>
  metrics.flatMap(({ name, dense, comfortable }) =>
    isMetricName(name) ? [{ name, role, px: { dense, comfortable } }] : []
  )
).toSorted((a, b) => DENSITY_METRIC_ORDER.indexOf(a.name) - DENSITY_METRIC_ORDER.indexOf(b.name));

/** The largest px a metric knob, and a share link, accepts. */
export const MAX_METRIC_PX = 96;

/** The metric's px in effect at `density`: the visitor's edit, else the base value. */
export function metricPx(metric: StudioMetric, density: Density, overrides: MetricOverrides): number {
  return overrides[metric.name] ?? metric.px[density];
}

/**
 * The inline declarations that apply one density's metric edits on an artboard's scope element,
 * which already carries `data-density`, so every part inside reads them.
 *
 * @param overrides - The edits for the artboard's density.
 */
export function metricStyle(overrides: MetricOverrides): CustomProperties {
  const style: CustomProperties = {};
  for (const [name, px] of Object.entries(overrides)) {
    style[`--${name}`] = `${String(px)}px`;
  }
  return style;
}
