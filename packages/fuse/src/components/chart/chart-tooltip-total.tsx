"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useChartRoot } from "./chart-context";
import { stackTotal, useActivePoint } from "./chart-readout";
import type { ChartDomProps, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { formatValue } from "./format/value-format";
import { ChartCompositionError } from "./layout/errors";

/**
 * Props for `Chart.TooltipTotal`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipTotalProps = ChartDomProps<"div"> & {
  /** A config stack id. The first stack id in config order is the default. */
  stack?: string;
  /** The row's label. The dictionary's "Totalt" is the default. */
  label?: string;
  /** The total's format. The stack's first series' format is the default. */
  format?: ValueFormat;
};

/**
 * A tooltip row with one stack's net total at the active slot, followed by the incomplete word when
 * a part is missing. Only cartesian config takes `stack`, so only `Chart` has this part. A `stack`
 * that names no stack of two or more series throws `unknown-key`.
 *
 * @beta
 */
export function ChartTooltipTotal({
  stack,
  label,
  format,
  render,
  className,
  ...props
}: ChartTooltipTotalProps): ReactElement {
  const context = useChartRoot("Chart.TooltipTotal");
  const { slot } = useActivePoint(context);
  const stacks = context.model.stacks;
  const id = stack ?? stacks[0]?.id;
  const entry = stacks.find((candidate) => candidate.id === id);
  if (stack !== undefined && entry === undefined) {
    throw new ChartCompositionError(
      "Chart.TooltipTotal",
      "unknown-key",
      `received stack ${JSON.stringify(stack)}, which names no stack of two or more series. Use one of ${stacks.map(({ id: name }) => JSON.stringify(name)).join(", ")}.`
    );
  }
  const strings = CHART_STRINGS[context.locale];
  const first = entry?.keys[0];
  const total = entry === undefined || slot === null ? null : stackTotal(context, entry.id, slot);
  const value =
    total === null
      ? strings.pending
      : `${formatValue(context.locale, total.total, format ?? (first === undefined ? {} : context.config[first]?.format) ?? {}, "full").text}${total.incomplete ? ` (${strings.incomplete})` : ""}`;
  return useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "chart-tooltip-total",
      ...mergeProps<"div">(
        {
          className,
          children: (
            <>
              <span>{label ?? strings.total}</span>
              <span>{value}</span>
            </>
          ),
        },
        props
      ),
    },
  });
}

Object.assign(ChartTooltipTotal, { displayName: "Chart.TooltipTotal" });
