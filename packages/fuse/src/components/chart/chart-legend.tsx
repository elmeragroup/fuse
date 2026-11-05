"use client";

import { use, useEffect } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ToggleGroupItem, ToggleGroupRoot } from "../toggle-group/toggle-group";
import { shareDigits, shareText, useActiveIndex, useChartReadout, useReadoutKey } from "./chart-readout";
import { ChartSelectionContext } from "./chart-readout-port";
import type { ChartReadout } from "./chart-readout-port";
import { ChartLegendSideContext, ChartRowContext } from "./chart-scope-contexts";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import type {
  ChartDomProps,
  ChartFallback,
  ChartLayerProps,
  ChartFractionDigits,
  ChartThresholdSide,
  ValueFormat,
} from "./chart-types";

/**
 * Props for `Chart.Legend`, a `ul` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendProps = ChartDomProps<"ul"> & {
  /**
   * Where the legend sits around the plot. "bottom" by default. In a polar chart narrower than
   * 30rem, a "start" or "end" legend moves under the dial, so the dial keeps its size.
   */
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
export function ChartLegend({
  side = "bottom",
  render,
  className,
  children,
  ...props
}: ChartLegendProps): ReactElement {
  useChartReadout("Chart.Legend");
  // The template walks the legend's own keys, Other among them, which no explicit dataKey may name.
  const items = children ?? <ChartLegendItem />;
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
function entrySides(readout: ChartReadout, key: string): readonly (ChartThresholdSide | null)[] {
  return readout.item(key)?.sides ?? [null];
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
  const readout = useChartReadout("Chart.LegendItem");
  const selectedKey = use(ChartSelectionContext);
  const seriesIndex = readout.item(itemKey)?.index;
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
export function ChartLegendItem({
  dataKey,
  render,
  className,
  children,
  ...props
}: ChartLegendItemProps): ReactElement {
  const readout = useChartReadout("Chart.LegendItem");
  if (dataKey !== undefined) readout.assertKey("Chart.LegendItem", dataKey);
  const keys = dataKey === undefined ? readout.legendKeys : [dataKey];
  return (
    <>
      {keys.flatMap((key) =>
        entrySides(readout, key).map((side, index) => (
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
export function ChartLegendValue({
  dataKey,
  fallback = "last",
  format,
  render,
  className,
  ...props
}: ChartLegendValueProps): ReactElement {
  const readout = useChartReadout("Chart.LegendValue");
  const active = useActiveIndex(readout, true);
  const key = useReadoutKey("Chart.LegendValue", readout, dataKey, null);
  const at = key === null ? null : readout.legendAt(key, active, fallback);
  const text = key === null || at === null ? null : readout.valueText(key, at, format);
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
export function ChartLegendShare({
  dataKey,
  format,
  render,
  className,
  ...props
}: ChartLegendShareProps): ReactElement {
  const readout = useChartReadout("Chart.LegendShare");
  const key = useReadoutKey("Chart.LegendShare", readout, dataKey, null);
  const text =
    key === null ? null : shareText(readout.locale, readout.legendShare(key, shareDigits(format)), format);
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
export function ChartLegendToggleGroup({
  "aria-label": ariaLabel,
  side = "bottom",
  className,
  style,
  children,
}: ChartLegendToggleGroupProps): ReactElement {
  const readout = useChartReadout("Chart.LegendToggleGroup");
  const { registerToggleGroup, select } = readout;
  const selectedKey = use(ChartSelectionContext);
  useEffect(() => registerToggleGroup(), [registerToggleGroup]);
  return (
    <ToggleGroupRoot
      data-slot="chart-legend-toggle-group"
      data-side={side}
      aria-label={ariaLabel ?? readout.toggleGroupName}
      size="xs"
      value={selectedKey === null ? [] : [selectedKey]}
      onValueChange={(value, details) => {
        select(value.at(-1) ?? null, "legend", details.event);
      }}
      className={className}
      style={style}>
      {children ??
        readout.legendKeys
          .filter((key) => readout.item(key)?.selectable === true)
          .map((key) => <ChartLegendToggle key={key} dataKey={key} />)}
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
export function ChartLegendToggle({
  dataKey,
  className,
  style,
  children,
}: ChartLegendToggleProps): ReactElement {
  const readout = useChartReadout("Chart.LegendToggle");
  readout.assertKey("Chart.LegendToggle", dataKey);
  const item = readout.item(dataKey);
  return (
    <ToggleGroupItem
      value={dataKey}
      size="xs"
      data-slot="chart-legend-toggle"
      data-series={item?.index}
      className={className}
      style={style}
      onPointerEnter={() => readout.highlight(dataKey)}
      onPointerLeave={() => readout.highlight(null)}
      onFocus={() => readout.highlight(dataKey)}
      onBlur={() => readout.highlight(null)}>
      <ChartRowContext value={dataKey}>
        {children ?? (
          <>
            <ChartSwatch />
            <span>{item?.label.text ?? dataKey}</span>
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
