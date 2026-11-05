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
import { ChartSlotLabel } from "../../src/components/chart/chart-slot-label";
import { ChartTable, ChartTableColumn } from "../../src/components/chart/chart-table";
import {
  ChartTooltip,
  ChartTooltipItems,
  ChartTooltipLabel,
  ChartTooltipShare,
  ChartTooltipValue,
} from "../../src/components/chart/chart-tooltip";
import { ChartTooltipTotal } from "../../src/components/chart/chart-tooltip-total";
import { ClockChartActiveDot } from "../../src/components/chart/clock-chart-active-dot";
import {
  ClockChartActiveValue,
  ClockChartCenter,
  ClockChartTooltipTotal,
} from "../../src/components/chart/clock-chart-center";
import { ClockChartColumn } from "../../src/components/chart/clock-chart-column";
import { ClockChartDots, ClockChartMarker } from "../../src/components/chart/clock-chart-dots";
import { ClockChartGlow } from "../../src/components/chart/clock-chart-glow";
import {
  ClockChartAngleAxis,
  ClockChartGrid,
  ClockChartNow,
  ClockChartRadiusAxis,
  ClockChartReferenceArea,
  ClockChartReferenceLine,
  ClockChartScrubber,
} from "../../src/components/chart/clock-chart-grid";
import { ClockChartArea, ClockChartLine } from "../../src/components/chart/clock-chart-marks";
import { ClockChartRoot } from "../../src/components/chart/clock-chart-root";
import { ClockChartSkeleton } from "../../src/components/chart/clock-chart-skeleton";
import { ClockChartTooltip } from "../../src/components/chart/clock-chart-tooltip";
import { ClockChartValueLabel } from "../../src/components/chart/clock-chart-value-label";
import {
  PieChartCenter,
  PieChartCenterLabel,
  PieChartCenterMax,
  PieChartCenterShare,
  PieChartCenterValue,
} from "../../src/components/chart/pie-chart-center";
import { PieChartGlow } from "../../src/components/chart/pie-chart-glow";
import { PieChartLabels } from "../../src/components/chart/pie-chart-labels";
import { PieChartPie } from "../../src/components/chart/pie-chart-pie";
import { PieChartRoot } from "../../src/components/chart/pie-chart-root";
import { PieChartSkeleton } from "../../src/components/chart/pie-chart-skeleton";
import { PieChartTrack } from "../../src/components/chart/pie-chart-track";
import {
  PieChartTable,
  RadarChartTable,
  ClockChartTable,
  RadialChartTable,
} from "../../src/components/chart/polar-chart-table";
import {
  PieChartTooltip,
  RadarChartTooltip,
  RadialChartTooltip,
} from "../../src/components/chart/polar-chart-tooltip";
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

import { ScatterChartEmpty, ScatterChartSkeleton } from "../../src/components/chart/scatter-chart-empty";
import {
  ScatterChartGrid,
  ScatterChartReferenceLine,
  ScatterChartXAxis,
  ScatterChartYAxis,
} from "../../src/components/chart/scatter-chart-guides";
import { ScatterChartLegend, ScatterChartLegendItem } from "../../src/components/chart/scatter-chart-legend";
import {
  ScatterChartActiveDot,
  ScatterChartLine,
  ScatterChartPoints,
} from "../../src/components/chart/scatter-chart-marks";
import { ScatterChartRoot } from "../../src/components/chart/scatter-chart-root";
import { ScatterChartTable } from "../../src/components/chart/scatter-chart-table";
import {
  ScatterChartTooltip,
  ScatterChartTooltipLabel,
  ScatterChartTooltipValue,
} from "../../src/components/chart/scatter-chart-tooltip";
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
  SlotLabel: ChartSlotLabel,
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
  Tooltip: PieChartTooltip,
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
  Table: PieChartTable,
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
  Tooltip: RadialChartTooltip,
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
  Table: RadialChartTable,
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
  Tooltip: RadarChartTooltip,
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
  Table: RadarChartTable,
  TableColumn: ChartTableColumn,
  Empty: ChartEmpty,
  Background: ChartBackground,
} as const;

export const ClockChart = {
  Root: ClockChartRoot,
  Line: ClockChartLine,
  Area: ClockChartArea,
  Column: ClockChartColumn,
  Dots: ClockChartDots,
  ActiveDot: ClockChartActiveDot,
  Marker: ClockChartMarker,
  ValueLabel: ClockChartValueLabel,
  Glow: ClockChartGlow,
  Grid: ClockChartGrid,
  AngleAxis: ClockChartAngleAxis,
  RadiusAxis: ClockChartRadiusAxis,
  ReferenceLine: ClockChartReferenceLine,
  ReferenceArea: ClockChartReferenceArea,
  Scrubber: ClockChartScrubber,
  Now: ClockChartNow,
  Center: ClockChartCenter,
  ActiveValue: ClockChartActiveValue,
  TooltipTotal: ClockChartTooltipTotal,
  Skeleton: ClockChartSkeleton,
  Headline: ChartHeadline,
  Takeaway: ChartTakeaway,
  Tooltip: ClockChartTooltip,
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
  Table: ClockChartTable,
  TableColumn: ChartTableColumn,
  Empty: ChartEmpty,
  Background: ChartBackground,
} as const;

export const ScatterChart = {
  Root: ScatterChartRoot,
  Grid: ScatterChartGrid,
  XAxis: ScatterChartXAxis,
  YAxis: ScatterChartYAxis,
  ReferenceLine: ScatterChartReferenceLine,
  Points: ScatterChartPoints,
  Line: ScatterChartLine,
  ActiveDot: ScatterChartActiveDot,
  Tooltip: ScatterChartTooltip,
  TooltipLabel: ScatterChartTooltipLabel,
  TooltipValue: ScatterChartTooltipValue,
  Legend: ScatterChartLegend,
  LegendItem: ScatterChartLegendItem,
  Table: ScatterChartTable,
  Empty: ScatterChartEmpty,
  Skeleton: ScatterChartSkeleton,
  Headline: ChartHeadline,
  Takeaway: ChartTakeaway,
  Background: ChartBackground,
} as const;

export const AreaChart = Chart;
export const BarChart = Chart;
export const LineChart = Chart;
