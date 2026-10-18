/**
 * Server-visible namespace for `Chart` and its aliases `AreaChart`, `BarChart` and `LineChart`.
 * This module has no directive, so a server component reads each part as a client reference
 * instead of dotting into a client module. Each part is an explicit property, which keeps tree
 * shaking per family.
 */
import { ChartActiveValue, ChartActiveValueLine } from "./chart-active-value";
import { ChartArea } from "./chart-area";
import { ChartXAxis, ChartYAxis } from "./chart-axis";
import { ChartBackground } from "./chart-background";
import { ChartBar, ChartBarGroup } from "./chart-bar";
import { ChartBrush, ChartBrushPreview } from "./chart-brush";
import { ChartCrosshair } from "./chart-crosshair";
import { ChartActiveDot, ChartDots, ChartMarker, ChartValueLabel } from "./chart-dots";
import { ChartGlow, ChartReveal } from "./chart-effects";
import { ChartEmpty } from "./chart-empty";
import { ChartGrid } from "./chart-grid";
import { ChartHeadline, ChartTakeaway } from "./chart-headline";
import {
  ChartLegend,
  ChartLegendItem,
  ChartLegendShare,
  ChartLegendToggle,
  ChartLegendToggleGroup,
  ChartLegendValue,
} from "./chart-legend";
import { ChartLine } from "./chart-line";
import { ChartPanel } from "./chart-panel";
import { ChartReferenceArea, ChartReferenceLine } from "./chart-reference";
import { ChartRoot } from "./chart-root";
import { ChartSeriesIcon, ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { ChartSkeleton } from "./chart-skeleton";
import { ChartTable, ChartTableColumn } from "./chart-table";
import {
  ChartTooltip,
  ChartTooltipItems,
  ChartTooltipLabel,
  ChartTooltipShare,
  ChartTooltipValue,
} from "./chart-tooltip";
import { ChartTooltipTotal } from "./chart-tooltip-total";

/**
 * Cartesian charts. Bars, lines and areas over a category or time axis, with Panels for composed
 * charts that share one x axis, tooltip and crosshair. `Chart.Root` reads every series from
 * `config` and never inspects its children.
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

/**
 * `Chart` under the name area-chart readers search for. Every part is the same component.
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
export const AreaChart: typeof Chart = Chart;

/**
 * `Chart` under the name bar-chart readers search for. Every part is the same component.
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
export const BarChart: typeof Chart = Chart;

/**
 * `Chart` under the name line-chart readers search for. Every part is the same component.
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
export const LineChart: typeof Chart = Chart;
