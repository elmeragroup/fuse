/**
 * The parts of `GaugeChart`, which `gauge-chart-namespace` re-exports as an ES module namespace, so
 * a bundler keeps only the parts a route names. This module has no directive, so a server
 * component reads each part as a client reference. Each export name is the part's key.
 */
export { GaugeChartRoot as Root } from "./gauge-chart-root";
export { GaugeChartZone as Zone } from "./gauge-chart-zone";
export {
  GaugeChartTrack as Track,
  GaugeChartFill as Fill,
  GaugeChartGlow as Glow,
} from "./gauge-chart-track";
export { GaugeChartRuler as Ruler } from "./gauge-chart-ruler";
export { GaugeChartNeedle as Needle } from "./gauge-chart-needle";
export { GaugeChartSector as Sector } from "./gauge-chart-sector";
export { GaugeChartProgressRing as ProgressRing } from "./gauge-chart-progress-ring";
export { GaugeChartDots as Dots } from "./gauge-chart-dots";
export {
  GaugeChartCenter as Center,
  GaugeChartCenterValue as CenterValue,
  GaugeChartCenterLabel as CenterLabel,
} from "./gauge-chart-center";
export { GaugeChartSkeleton as Skeleton, GaugeChartEmpty as Empty } from "./gauge-chart-skeleton";
export { ChartHeadline as Headline, ChartTakeaway as Takeaway } from "./chart-headline";
