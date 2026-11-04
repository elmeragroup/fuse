"use client";

import { use, useEffect } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ToggleGroupItem, ToggleGroupRoot } from "../toggle-group/toggle-group";
import { assertKnownKey, ChartSelectionContext, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { isThresholdColor } from "./chart-paint";
import { usePendingOr } from "./chart-pending-root";
import {
  ChartLegendSideContext,
  ChartRowContext,
  fallbackSlot,
  readingText,
  shareDigits,
  shareText,
  useActiveSlot,
  useReadoutKey,
  windowShares,
} from "./chart-readout";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { seriesLabel } from "./chart-text";
import type {
  ChartDomProps,
  ChartFallback,
  ChartLayerProps,
  ChartFractionDigits,
  ChartThresholdSide,
  ValueFormat,
} from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { seriesOf } from "./layout/series-of";

/**
 * Props for `Chart.Legend`, a `ul` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendProps = ChartDomProps<"ul"> & {
  /** Where the legend sits around the plot. "bottom" by default. */
  side?: "top" | "bottom" | "start" | "end";
};

/**
 * Props for `Chart.LegendItem`, an `li` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendItemProps = ChartDomProps<"li"> & {
  /**
   * The series of this item. A threshold series renders one item per side. Without one, the item
   * is a template rendered once per legend entry.
   */
  dataKey?: string;
};

/**
 * Props for `Chart.LegendValue`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendValueProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a LegendItem template the item supplies it. */
  dataKey?: string;
  /** The datum to print when nothing is active. "last" by default. */
  fallback?: ChartFallback;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.LegendShare`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendShareProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a LegendItem template the item supplies it. */
  dataKey?: string;
  /** The percentage digits. */
  format?: ChartFractionDigits;
};

/**
 * Props for `Chart.LegendToggleGroup`, a closed part.
 *
 * @beta
 */
export type ChartLegendToggleGroupProps = ChartLayerProps & {
  /** The group's name. The dictionary's "Serier" is the default. */
  "aria-label"?: string;
  /** Where the group sits around the plot. "bottom" by default. */
  side?: ChartLegendProps["side"];
  /** LegendToggle parts. Without children, one per config key, or per kept category in a folded pie. */
  children?: ReactNode;
};

/**
 * Props for `Chart.LegendToggle`, a closed part.
 *
 * @beta
 */
export type ChartLegendToggleProps = ChartLayerProps & {
  /** The series the toggle selects. An unknown key throws `unknown-key`. */
  dataKey: string;
  /** The toggle's content. The series' swatch and label by default. */
  children?: ReactNode;
};

/**
 * A static list of the series, "bottom" by default, as Figma's `Chart` places it. Without children,
 * one LegendItem per config key, or per kept category and then one Other item in a folded pie. A
 * series coloured by a threshold has two entries, its `above` side first, each with the side's
 * label and swatch. The list is visible text, so screen readers read it, and its swatches are
 * decoration.
 *
 * @beta
 */
export function ChartLegend(props: ChartLegendProps): ReactElement {
  return usePendingOr(props, ChartLegendBody);
}

function ChartLegendBody({
  side = "bottom",
  render,
  className,
  children,
  ...props
}: ChartLegendProps): ReactElement {
  const context = useChartRoot("Chart.Legend");
  const items =
    children ?? Object.keys(context.config).map((key) => <ChartLegendItem key={key} dataKey={key} />);
  return useRender({
    defaultTagName: "ul",
    render,
    props: {
      "data-slot": "chart-legend",
      "data-side": side,
      ...mergeProps<"ul">({ className, children: items }, props),
    },
  });
}

/**
 * The legend entries of one series: one per side of a threshold colour, the upper side first as
 * the value axis reads, or one entry with no side for every other colour.
 */
function entrySides(context: ChartRootContextValue, key: string): readonly (ChartThresholdSide | null)[] {
  const color = context.config[key]?.color;
  return color !== undefined && isThresholdColor(color) ? [color.above, color.below] : [null];
}

/** One legend entry's own element. */
function LegendEntry({
  itemKey,
  side,
  render,
  className,
  children,
  props,
}: {
  readonly itemKey: string;
  readonly side: ChartThresholdSide | null;
  readonly render: ChartLegendItemProps["render"];
  readonly className: string | undefined;
  readonly children: ReactNode;
  readonly props: Omit<ChartLegendItemProps, "dataKey" | "render" | "className" | "children">;
}): ReactElement {
  const context = useChartRoot("Chart.LegendItem");
  const selectedKey = use(ChartSelectionContext);
  const seriesIndex = seriesOf(context.model, itemKey)?.seriesIndex;
  const element = useRender({
    defaultTagName: "li",
    render,
    props: {
      "data-slot": "chart-legend-item",
      "data-series": seriesIndex,
      "data-dimmed": selectedKey !== null && selectedKey !== itemKey ? "" : undefined,
      ...mergeProps<"li">(
        {
          className,
          children: children ?? (
            <>
              <ChartSwatch />
              <ChartSeriesLabel />
            </>
          ),
        },
        props
      ),
    },
  });
  return (
    <ChartRowContext value={itemKey}>
      <ChartLegendSideContext value={side === null ? null : { key: itemKey, side }}>
        {element}
      </ChartLegendSideContext>
    </ChartRowContext>
  );
}

/**
 * One legend entry. With a `dataKey`, that series' entries: one item, or one per side of a threshold
 * colour, above first. Without one, a template rendered once per legend entry, as TooltipItems is.
 * Inside a threshold side's item, a Swatch or a SeriesLabel of its series shows the side's paint
 * and label, while a LegendValue and a LegendShare print the whole series' value and share.
 *
 * @beta
 */
export function ChartLegendItem(props: ChartLegendItemProps): ReactElement {
  return usePendingOr(props, ChartLegendItemBody);
}

function ChartLegendItemBody({
  dataKey,
  render,
  className,
  children,
  ...props
}: ChartLegendItemProps): ReactElement {
  const context = useChartRoot("Chart.LegendItem");
  if (dataKey !== undefined) assertKnownKey("Chart.LegendItem", context.config, dataKey);
  const keys = dataKey === undefined ? Object.keys(context.config) : [dataKey];
  return (
    <>
      {keys.flatMap((key) =>
        entrySides(context, key).map((side, index) => (
          <LegendEntry
            // A series' sides never reorder, so their position tells its entries apart.
            key={`${key}\u0000${String(index)}`}
            itemKey={key}
            side={side}
            render={render}
            className={className}
            props={props}>
            {children}
          </LegendEntry>
        ))
      )}
    </>
  );
}

/**
 * The series' value at the active slot, or the `fallback` value when nothing is active, "last" by
 * default. In pie and radial charts it is the category's value. It renders once per change of the
 * active slot, never on a pointer move inside one slot.
 *
 * @beta
 */
export function ChartLegendValue(props: ChartLegendValueProps): ReactElement {
  return usePendingOr(props, ChartLegendValueBody);
}

function ChartLegendValueBody({
  dataKey,
  fallback = "last",
  format,
  render,
  className,
  ...props
}: ChartLegendValueProps): ReactElement {
  const context = useChartRoot("Chart.LegendValue");
  const active = useActiveSlot(context, true);
  const key = useReadoutKey("Chart.LegendValue", context, dataKey, null);
  const slot = key === null ? null : (active ?? fallbackSlot(context, key, fallback));
  const text = key === null || slot === null ? null : readingText(context, key, slot, format);
  return useRender({
    defaultTagName: "span",
    render,
    props: { "data-slot": "chart-legend-value", ...mergeProps<"span">({ className, children: text }, props) },
  });
}

/**
 * The series total's share of every series' total over the effective window, or the slice's share
 * in a pie. The legend's shares round together, so they sum to 100 %.
 *
 * @beta
 */
export function ChartLegendShare(props: ChartLegendShareProps): ReactElement {
  return usePendingOr(props, ChartLegendShareBody);
}

function ChartLegendShareBody({
  dataKey,
  format,
  render,
  className,
  ...props
}: ChartLegendShareProps): ReactElement {
  const context = useChartRoot("Chart.LegendShare");
  const key = useReadoutKey("Chart.LegendShare", context, dataKey, null);
  const text =
    key === null
      ? null
      : shareText(context, windowShares(context, shareDigits(format)).get(key) ?? null, format);
  return useRender({
    defaultTagName: "span",
    render,
    props: { "data-slot": "chart-legend-share", ...mergeProps<"span">({ className, children: text }, props) },
  });
}

/**
 * A Fuse ToggleGroup that edits Root's `selectedKey`. Root owns the value and the change callback,
 * so the group takes no `value`, `multiple` or `disabled` of its own. Each toggle selects a series,
 * so a series coloured by a threshold keeps one toggle, its swatch split between the two sides and
 * its label the series' own. One toggle is pressed at a time, and pressing the pressed toggle clears
 * the selection. While the group is mounted, Enter on the plot's option and a plot click select a
 * series too. Each change announces the selection through Root's status region.
 *
 * @beta
 */
export function ChartLegendToggleGroup(props: ChartLegendToggleGroupProps): ReactElement {
  return usePendingOr(props, ChartLegendToggleGroupBody);
}

function ChartLegendToggleGroupBody({
  "aria-label": ariaLabel,
  side = "bottom",
  className,
  style,
  children,
}: ChartLegendToggleGroupProps): ReactElement {
  const context = useChartRoot("Chart.LegendToggleGroup");
  const { registerToggleGroup, select, locale } = context;
  const selectedKey = use(ChartSelectionContext);
  useEffect(() => registerToggleGroup(), [registerToggleGroup]);
  return (
    <ToggleGroupRoot
      data-slot="chart-legend-toggle-group"
      data-side={side}
      aria-label={ariaLabel ?? CHART_STRINGS[locale].seriesGroup}
      size="xs"
      value={selectedKey === null ? [] : [selectedKey]}
      onValueChange={(value, details) => {
        select(value.at(-1) ?? null, "legend", details.event);
      }}
      className={className}
      style={style}>
      {children ?? Object.keys(context.config).map((key) => <ChartLegendToggle key={key} dataKey={key} />)}
    </ToggleGroupRoot>
  );
}

/**
 * One series toggle, named by the visible text of the series label, so a speech-input user can say
 * what they see. Hovering or focusing it highlights its series through Root's attributes, which
 * renders nothing in React.
 *
 * @beta
 */
export function ChartLegendToggle(props: ChartLegendToggleProps): ReactElement {
  return usePendingOr(props, ChartLegendToggleBody);
}

function ChartLegendToggleBody({
  dataKey,
  className,
  style,
  children,
}: ChartLegendToggleProps): ReactElement {
  const context = useChartRoot("Chart.LegendToggle");
  assertKnownKey("Chart.LegendToggle", context.config, dataKey);
  const seriesIndex = seriesOf(context.model, dataKey)?.seriesIndex;
  return (
    <ToggleGroupItem
      value={dataKey}
      size="xs"
      data-slot="chart-legend-toggle"
      data-series={seriesIndex}
      className={className}
      style={style}
      onPointerEnter={() => context.highlight(dataKey)}
      onPointerLeave={() => context.highlight(null)}
      onFocus={() => context.highlight(dataKey)}
      onBlur={() => context.highlight(null)}>
      <ChartRowContext value={dataKey}>
        {children ?? (
          <>
            <ChartSwatch />
            <span>{seriesLabel(context, dataKey).text}</span>
          </>
        )}
      </ChartRowContext>
    </ToggleGroupItem>
  );
}

Object.assign(ChartLegend, { displayName: "Chart.Legend" });
Object.assign(ChartLegendItem, { displayName: "Chart.LegendItem" });
Object.assign(ChartLegendValue, { displayName: "Chart.LegendValue" });
Object.assign(ChartLegendShare, { displayName: "Chart.LegendShare" });
Object.assign(ChartLegendToggleGroup, { displayName: "Chart.LegendToggleGroup" });
Object.assign(ChartLegendToggle, { displayName: "Chart.LegendToggle" });
