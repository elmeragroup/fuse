/**
 * The chart entry as the docs API extractor reads it. The extractor in `@elmeragroup/internal`
 * cannot model the type of an ES module namespace, which is how `src/chart.ts` exports `Chart` and
 * its siblings, so the chart pages extract from these plain objects instead. Each holds the same
 * part components under the same keys as its namespace, in the order the pages list them, which
 * `chart-api-facade.test.ts` checks. The extractor can't recover a part's implementation through a
 * spread of the parts module, so the objects list each part. The cartesian aliases have no
 * reference of their own, but the extractor fails on any ES module namespace the entry exports, so
 * each alias still shadows its namespace with `Chart`.
 */
import { ChartActiveValue, ChartActiveValueLine } from "../../src/components/chart/chart-active-value";
import { ChartArea } from "../../src/components/chart/chart-area";
import { ChartXAxis, ChartYAxis } from "../../src/components/chart/chart-axis";
import { ChartBackground } from "../../src/components/chart/chart-background";
import { ChartBar, ChartBarGroup } from "../../src/components/chart/chart-bar";
import { ChartBrush, ChartBrushPreview } from "../../src/components/chart/chart-brush";
import { ChartCrosshair } from "../../src/components/chart/chart-crosshair";
import {
  ChartActiveDot,
  ChartDots,
  ChartMarker,
  ChartValueLabel,
} from "../../src/components/chart/chart-dots";
import { ChartGlow, ChartReveal } from "../../src/components/chart/chart-effects";
import { ChartEmpty } from "../../src/components/chart/chart-empty";
import { ChartGrid } from "../../src/components/chart/chart-grid";
import { ChartHeadline, ChartTakeaway } from "../../src/components/chart/chart-headline";
import {
  ChartLegend,
  ChartLegendItem,
  ChartLegendShare,
  ChartLegendToggle,
  ChartLegendToggleGroup,
  ChartLegendValue,
} from "../../src/components/chart/chart-legend";
import { ChartLine } from "../../src/components/chart/chart-line";
import { ChartPanel } from "../../src/components/chart/chart-panel";
import { ChartReferenceArea, ChartReferenceLine } from "../../src/components/chart/chart-reference";
import { ChartRoot } from "../../src/components/chart/chart-root";
import { ChartSeriesIcon, ChartSeriesLabel, ChartSwatch } from "../../src/components/chart/chart-series";
import { ChartSkeleton } from "../../src/components/chart/chart-skeleton";
import { ChartTable, ChartTableColumn } from "../../src/components/chart/chart-table";
import {
  ChartTooltip,
  ChartTooltipItems,
  ChartTooltipLabel,
  ChartTooltipShare,
  ChartTooltipValue,
} from "../../src/components/chart/chart-tooltip";
import { ChartTooltipTotal } from "../../src/components/chart/chart-tooltip-total";
import {
  PieChartCenter,
  PieChartCenterLabel,
  PieChartCenterMax,
  PieChartCenterShare,
  PieChartCenterValue,
  PieChartTrack,
} from "../../src/components/chart/pie-chart-center";
import { PieChartGlow } from "../../src/components/chart/pie-chart-glow";
import { PieChartLabels, PieChartPie } from "../../src/components/chart/pie-chart-pie";
import { PieChartRoot } from "../../src/components/chart/pie-chart-root";
import { PieChartSkeleton } from "../../src/components/chart/pie-chart-skeleton";
import {
  RadarChartAngleAxis,
  RadarChartGrid,
  RadarChartRadiusAxis,
} from "../../src/components/chart/radar-chart-grid";
import {
  RadarChartActiveDot,
  RadarChartArea,
  RadarChartDots,
  RadarChartGlow,
  RadarChartLine,
} from "../../src/components/chart/radar-chart-marks";
import { RadarChartRoot } from "../../src/components/chart/radar-chart-root";
import { RadarChartSkeleton } from "../../src/components/chart/radar-chart-skeleton";
import { RadialChartBar } from "../../src/components/chart/radial-chart-bar";
import { RadialChartRoot } from "../../src/components/chart/radial-chart-root";
import { RadialChartSkeleton } from "../../src/components/chart/radial-chart-skeleton";

// Every other export of the entry passes through. A local export shadows the star export of the
// same name, so the objects below replace the entry's namespaces.
export * from "../../src/chart";

export const Chart = {
  Root: ChartRoot,
  Panel: ChartPanel,
  Grid: ChartGrid,
  XAxis: ChartXAxis,
  YAxis: ChartYAxis,
  Bar: ChartBar,
  BarGroup: ChartBarGroup,
  Line: ChartLine,
  Area: ChartArea,
  Dots: ChartDots,
  ActiveDot: ChartActiveDot,
  Marker: ChartMarker,
  ValueLabel: ChartValueLabel,
  Crosshair: ChartCrosshair,
  ReferenceLine: ChartReferenceLine,
  ReferenceArea: ChartReferenceArea,
  ActiveValue: ChartActiveValue,
  ActiveValueLine: ChartActiveValueLine,
  TooltipTotal: ChartTooltipTotal,
  Glow: ChartGlow,
  Reveal: ChartReveal,
  Brush: ChartBrush,
  BrushPreview: ChartBrushPreview,
  Skeleton: ChartSkeleton,
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

export const RadialChart = {
  Root: RadialChartRoot,
  Bar: RadialChartBar,
  Track: PieChartTrack,
  Center: PieChartCenter,
  CenterValue: PieChartCenterValue,
  CenterShare: PieChartCenterShare,
  CenterMax: PieChartCenterMax,
  CenterLabel: PieChartCenterLabel,
  Glow: PieChartGlow,
  Skeleton: RadialChartSkeleton,
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

export const RadarChart = {
  Root: RadarChartRoot,
  Grid: RadarChartGrid,
  AngleAxis: RadarChartAngleAxis,
  RadiusAxis: RadarChartRadiusAxis,
  Area: RadarChartArea,
  Line: RadarChartLine,
  Dots: RadarChartDots,
  ActiveDot: RadarChartActiveDot,
  Glow: RadarChartGlow,
  Skeleton: RadarChartSkeleton,
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

export const AreaChart = Chart;
export const BarChart = Chart;
export const LineChart = Chart;
