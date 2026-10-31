/**
 * Packed-only chart type cases. They hold only without the workspace csstype augmentation, which
 * types every `--*` property, so `scripts/package-check-chart-types.ts` compiles them against the
 * tarball and the workspace never type-checks them.
 */
import { BarChart } from "@elmeragroup/fuse/chart";

// @ts-expect-error a misspelt chart custom property fails, because React's CSSProperties declares no custom property
export const styleTypo = <BarChart.Bar dataKey="desktop" style={{ "--chart-hovr-dim": 1 }} />;

// @ts-expect-error a property outside the chart's public list fails too
export const unknownProperty = <BarChart.Line dataKey="desktop" style={{ "--sidebar-width": "16rem" }} />;
