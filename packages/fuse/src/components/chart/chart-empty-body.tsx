"use client";

/**
 * The empty state every chart family shares inside its Root. Each family's Empty part supplies
 * what its own Root knows, so this module reads no Root.
 */
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import type { SupportedLocale } from "../../intl/locale-context";
import { Empty } from "../empty/empty";
import type { ChartDomProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";

/** What an Empty part passes from its Root: the locale its default words read and whether no datum draws. */
export type ChartEmptyBodyProps = ChartDomProps<"div"> & {
  readonly locale: SupportedLocale;
  readonly empty: boolean;
};

/**
 * Fuse Empty in the plot cell while the Root draws nothing. The part is the plot cell's `div`, and
 * Fuse Empty inside it keeps its own slots and spacing. Its default children are the dictionary's
 * "Ingen data for perioden". While anything draws it renders nothing.
 *
 * @param props - The part's props, the Root's locale, and whether the Root is empty.
 * @returns The empty state, or an empty fragment.
 */
export function ChartEmptyBody({
  locale,
  empty,
  render,
  className,
  children,
  ...props
}: ChartEmptyBodyProps): ReactElement {
  const element = useRender({
    defaultTagName: "div",
    render,
    props: {
      "data-slot": "chart-empty",
      ...mergeProps<"div">(
        {
          className,
          children: (
            <Empty.Root>
              {children ?? <Empty.Description>{CHART_STRINGS[locale].noData}</Empty.Description>}
            </Empty.Root>
          ),
        },
        props
      ),
    },
  });
  return empty ? element : <></>;
}

Object.assign(ChartEmptyBody, { displayName: "Chart.EmptyBody" });
