/**
 * Fuse charts. Preview: names and props can change until Fuse's first stable release.
 *
 * Every later chart change follows the growth rule. A new capability becomes a new part, a variant
 * or datum-selector value, a `config` field, a Root prop that describes the data's shape or a Panel
 * prop that mirrors one, Root state or a data attribute. It never becomes a boolean or mode prop on
 * a part below Root.
 *
 * The errors the parts' JSDoc names, such as `unknown-key`, throw as the cartesian parts render.
 * `PieChart`, `RadialChart` and `RadarChart` render nothing yet, so theirs start to throw once those
 * parts render in a later preview release.
 *
 * Import `@elmeragroup/fuse/chart.css` once, beside Fuse's own stylesheet.
 *
 * @packageDocumentation
 */
// This is the source entry facade for `@elmeragroup/fuse/chart`. It holds explicit named re-exports
// and no `export *`, local declaration or directive. The exports and barrel generators discover
// this file. It stays out of the root barrel while it carries the preview label.
export { Chart, AreaChart, BarChart, LineChart } from "./components/chart/chart-namespace";
export { PieChart } from "./components/chart/pie-chart-namespace";
export { RadialChart } from "./components/chart/radial-chart-namespace";
export { RadarChart } from "./components/chart/radar-chart-namespace";
export { Sparkline } from "./components/chart/sparkline";
export { useChartPoint } from "./components/chart/use-chart-point";
export { formatChartValue, formatChartSlot } from "./components/chart/chart-format";
export type { SupportedLocale } from "./intl/locale-context";
export type {
  ChartAccessibleName,
  ChartBackgroundPattern,
  ChartCategoricalRole,
  ChartCategoryConfigCheck,
  ChartCategoryKey,
  ChartChangeEventDetails,
  ChartColor,
  ChartConfig,
  ChartCurve,
  ChartDatum,
  ChartDivergingRole,
  ChartDomProps,
  ChartFallback,
  ChartFigureProps,
  ChartFractionDigits,
  ChartInstant,
  ChartIntro,
  ChartKeyOf,
  ChartLayerProps,
  ChartPeriod,
  ChartPoint,
  ChartPolarColor,
  ChartPolarFieldCheck,
  ChartPolarRole,
  ChartQuality,
  ChartQualityKey,
  ChartRadarCap,
  ChartRadarFieldCheck,
  ChartRole,
  ChartRow,
  ChartRowOf,
  ChartScalar,
  ChartScale,
  ChartSelectionChangeReason,
  ChartSelectionProps,
  ChartSentimentRole,
  ChartSequentialRole,
  ChartSeriesConfig,
  ChartSeriesConfigCheck,
  ChartSeriesKey,
  ChartStyle,
  ChartStyleVars,
  ChartTimeAxisProps,
  ChartTimeFields,
  ChartTone,
  ChartX,
  ChartXKey,
  ChartXOut,
  ChartXRange,
  ChartXRangeChangeReason,
  ChartXValue,
  FormattedText,
  Interval,
  TimePreset,
  ValueFormat,
  XFormat,
} from "./components/chart/chart-types";
export type { ChartRootProps } from "./components/chart/chart-root";
export type { PieChartRootProps } from "./components/chart/pie-chart-root";
export type { RadialChartRootProps } from "./components/chart/radial-chart-root";
export type { RadarChartRootProps } from "./components/chart/radar-chart-root";
export type { ChartActiveValueLineProps, ChartActiveValueProps } from "./components/chart/chart-active-value";
export type { ChartAreaProps } from "./components/chart/chart-area";
export type { ChartXAxisProps, ChartYAxisProps } from "./components/chart/chart-axis";
export type { ChartBackgroundProps } from "./components/chart/chart-background";
export type { ChartBarGroupProps, ChartBarProps } from "./components/chart/chart-bar";
export type { ChartBrushPreviewProps, ChartBrushProps } from "./components/chart/chart-brush";
export type { ChartCrosshairProps } from "./components/chart/chart-crosshair";
export type {
  ChartActiveDotProps,
  ChartDotsProps,
  ChartMarkerProps,
  ChartValueLabelProps,
} from "./components/chart/chart-dots";
export type { ChartGlowProps, ChartRevealProps } from "./components/chart/chart-effects";
export type { ChartEmptyProps } from "./components/chart/chart-empty";
export type { ChartGridProps } from "./components/chart/chart-grid";
export type { ChartHeadlineProps, ChartTakeawayProps } from "./components/chart/chart-headline";
export type {
  ChartLegendItemProps,
  ChartLegendProps,
  ChartLegendShareProps,
  ChartLegendToggleGroupProps,
  ChartLegendToggleProps,
  ChartLegendValueProps,
} from "./components/chart/chart-legend";
export type { ChartLineProps } from "./components/chart/chart-line";
export type { ChartPanelProps } from "./components/chart/chart-panel";
export type { ChartReferenceAreaProps, ChartReferenceLineProps } from "./components/chart/chart-reference";
export type {
  ChartSeriesIconProps,
  ChartSeriesLabelProps,
  ChartSwatchProps,
} from "./components/chart/chart-series";
export type { ChartSkeletonProps } from "./components/chart/chart-skeleton";
export type { ChartTableColumnProps, ChartTableProps } from "./components/chart/chart-table";
export type {
  ChartTooltipItemsProps,
  ChartTooltipLabelProps,
  ChartTooltipProps,
  ChartTooltipShareProps,
  ChartTooltipValueProps,
} from "./components/chart/chart-tooltip";
export type { ChartTooltipTotalProps } from "./components/chart/chart-tooltip-total";
export type {
  PieChartCenterLabelProps,
  PieChartCenterMaxProps,
  PieChartCenterProps,
  PieChartCenterShareProps,
  PieChartCenterValueProps,
  PieChartTrackProps,
} from "./components/chart/pie-chart-center";
export type { PieChartGlowProps } from "./components/chart/pie-chart-glow";
export type { PieChartLabelsProps, PieChartPieProps } from "./components/chart/pie-chart-pie";
export type { PieChartSkeletonProps } from "./components/chart/pie-chart-skeleton";
export type { RadialChartBarProps } from "./components/chart/radial-chart-bar";
export type { RadialChartSkeletonProps } from "./components/chart/radial-chart-skeleton";
export type {
  RadarChartAngleAxisProps,
  RadarChartGridProps,
  RadarChartRadiusAxisProps,
} from "./components/chart/radar-chart-grid";
export type {
  RadarChartActiveDotProps,
  RadarChartAreaProps,
  RadarChartDotsProps,
  RadarChartGlowProps,
  RadarChartLineProps,
} from "./components/chart/radar-chart-marks";
export type { RadarChartSkeletonProps } from "./components/chart/radar-chart-skeleton";
export type { SparklineProps } from "./components/chart/sparkline";
