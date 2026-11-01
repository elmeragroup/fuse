"use client";

import { createContext } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `Chart.Headline`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartHeadlineProps = ChartDomProps<"div">;

/**
 * Props for `Chart.Takeaway`, a `p` with Base UI's `render` whose children stay text.
 *
 * @beta
 */
export type ChartTakeawayProps = Omit<ChartDomProps<"p">, "children"> & {
  /** The takeaway sentence. Interpolated strings and numbers pass, and elements fail the type. */
  children: string | number | readonly (string | number)[];
};

/** Whether a part sits inside a Headline, where an ActiveValue is exposed text. */
export const ChartHeadlineContext = createContext(false);

/**
 * The key figure above the chart, such as `1,78 kr` over `Spotpris nå 16:00–16:15`. Format a static
 * figure with `formatChartValue` and `formatChartSlot`, or place an `ActiveValue`, which is exposed
 * text here. The headline's own text takes the theme's heading 2 role, as the Figma Spotpris card
 * sets its figure, and every child after the first takes the small muted paragraph role of the
 * card's caption.
 *
 * @beta
 */
export function ChartHeadline({ render, className, children, ...props }: ChartHeadlineProps): ReactElement {
  const element = useRender({
    defaultTagName: "div",
    render,
    props: { "data-slot": "chart-headline", ...mergeProps<"div">({ className, children }, props) },
  });
  return <ChartHeadlineContext value={true}>{element}</ChartHeadlineContext>;
}

/**
 * The takeaway in words, such as `Prisen er lavest kl. 03`. Fuse never writes one and never copies
 * it into the description. It takes the theme's default paragraph role.
 *
 * @beta
 */
export function ChartTakeaway({ render, className, children, ...props }: ChartTakeawayProps): ReactElement {
  const text = Array.isArray(children) ? children.join("") : String(children);
  return useRender({
    defaultTagName: "p",
    render,
    props: { "data-slot": "chart-takeaway", ...mergeProps<"p">({ className, children: text }, props) },
  });
}

Object.assign(ChartHeadline, { displayName: "Chart.Headline" });
Object.assign(ChartTakeaway, { displayName: "Chart.Takeaway" });
