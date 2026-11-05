"use client";

/**
 * The tooltip's stack total row, which `Chart.TooltipTotal` and `ClockChart.TooltipTotal` render
 * over their own series model: one stack's net total at the active slot, followed by the incomplete
 * word when a part is missing. It reads no plot geometry.
 */
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { stackTotal } from "./chart-series-readout";
import type { TextContext } from "./chart-text";
import type { ChartDomProps, ValueFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import { formatValue } from "./format/value-format";
import { ChartCompositionError } from "./layout/errors";

/** What a stack total row renders: its part's props, its family's series model and the active slot. */
export type TooltipTotalRowProps = ChartDomProps<"div"> & {
  /** The part's display name, which an unknown stack names. */
  readonly part: string;
  readonly context: TextContext;
  /** The active slot, or null while nothing is active. */
  readonly at: number | null;
  /** A config stack id. The first stack id in config order is the default. */
  readonly stack?: string | undefined;
  /** The row's label. The dictionary's "Totalt" is the default. */
  readonly label?: string | undefined;
  /** The total's format. The stack's first series' format is the default. */
  readonly format?: ValueFormat | undefined;
};

/**
 * One stack's total at the active slot as a tooltip row.
 *
 * @param props - The part's props, its series model and the active slot.
 * @returns The row.
 * @throws {ChartCompositionError} `unknown-key` for a stack that names no stack of two or more series.
 */
export function TooltipTotalRow({
  part,
  context,
  at,
  stack,
  label,
  format,
  render,
  className,
  ...props
}: TooltipTotalRowProps): ReactElement {
  const stacks = context.model.stacks;
  const id = stack ?? stacks[0]?.id;
  const entry = stacks.find((candidate) => candidate.id === id);
  if (stack !== undefined && entry === undefined) {
    throw new ChartCompositionError(
      part,
      "unknown-key",
      `received stack ${JSON.stringify(stack)}, which names no stack of two or more series. Use one of ${stacks.map(({ id: name }) => JSON.stringify(name)).join(", ")}.`
    );
  }
  const strings = CHART_STRINGS[context.locale];
  const first = entry?.keys[0];
  const total = entry === undefined || at === null ? null : stackTotal(context, entry.id, at);
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

Object.assign(TooltipTotalRow, { displayName: "Chart.TooltipTotalRow" });
