/**
 * Server-visible namespace for `PieChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each part is an explicit property, which keeps tree
 * shaking per family.
 */
import { ChartBackground } from "./chart-background";
import { ChartEmpty } from "./chart-empty";
import { ChartHeadline, ChartTakeaway } from "./chart-headline";
import {
  ChartLegend,
  ChartLegendItem,
  ChartLegendShare,
  ChartLegendToggle,
  ChartLegendToggleGroup,
  ChartLegendValue,
} from "./chart-legend";
import { ChartSeriesIcon, ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { ChartTable, ChartTableColumn } from "./chart-table";
import {
  ChartTooltip,
  ChartTooltipItems,
  ChartTooltipLabel,
  ChartTooltipShare,
  ChartTooltipValue,
} from "./chart-tooltip";
import {
  PieChartCenter,
  PieChartCenterLabel,
  PieChartCenterMax,
  PieChartCenterShare,
  PieChartCenterValue,
  PieChartTrack,
} from "./pie-chart-center";
import { PieChartGlow } from "./pie-chart-glow";
import { PieChartLabels, PieChartPie } from "./pie-chart-pie";
import { PieChartRoot } from "./pie-chart-root";
import { PieChartSkeleton } from "./pie-chart-skeleton";

/**
 * Pie and donut charts, and gauges through `max`. Slices draw in data order, and past `maxSlices`
 * the smallest rows fold into one Other slice.
 *
 * Preview: names and props can change until Fuse's first stable release.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, start to throw once the parts render in
 * a later preview release.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * @beta
 */
export const PieChart = {
  Root: PieChartRoot,
  Pie: PieChartPie,
  Labels: PieChartLabels,
  Track: PieChartTrack,
  Center: PieChartCenter,
  CenterValue: PieChartCenterValue,
  CenterShare: PieChartCenterShare,
  CenterMax: PieChartCenterMax,
  CenterLabel: PieChartCenterLabel,
  Glow: PieChartGlow,
  Skeleton: PieChartSkeleton,
  Headline: ChartHeadline,
  Takeaway: ChartTakeaway,
  Tooltip: ChartTooltip,
  TooltipLabel: ChartTooltipLabel,
  TooltipItems: ChartTooltipItems,
  TooltipValue: ChartTooltipValue,
  TooltipShare: ChartTooltipShare,
  Swatch: ChartSwatch,
  SeriesLabel: ChartSeriesLabel,
  SeriesIcon: ChartSeriesIcon,
  Legend: ChartLegend,
  LegendItem: ChartLegendItem,
  LegendValue: ChartLegendValue,
  LegendShare: ChartLegendShare,
  LegendToggleGroup: ChartLegendToggleGroup,
  LegendToggle: ChartLegendToggle,
  Table: ChartTable,
  TableColumn: ChartTableColumn,
  Empty: ChartEmpty,
  Background: ChartBackground,
} as const;
