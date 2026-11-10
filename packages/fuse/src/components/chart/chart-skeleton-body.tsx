"use client";

/**
 * The loading sketch every chart family shares, which renders in place of a Root. Each family's
 * Skeleton part supplies its own shapes, so this module reads no Root.
 */
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { Loader } from "../loader/loader";
import type { ChartDomProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";

/** What a Skeleton part passes: its variant, its loader's name and the shapes it sketches. */
export type ChartSkeletonBodyProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The sketch's `data-variant`, which the stylesheet lays its shapes out by. */
  readonly variant: string;
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  readonly label: string | undefined;
  /** The family's Fuse Skeleton shapes. */
  readonly marks: ReactNode;
};

/**
 * A loading placeholder that renders in place of a Root. Its shapes are Fuse Skeleton shapes that
 * readers skip, and one Fuse Loader names the wait. It renders outside any Root, so it reads the
 * locale from the nearest LocaleProvider.
 *
 * @param props - The part's props, its variant, its label and its shapes.
 * @returns The placeholder.
 */
export function ChartSkeletonBody({
  variant,
  label,
  marks,
  className,
  style,
  ...props
}: ChartSkeletonBodyProps): ReactElement {
  const { locale } = useLocale();
  return (
    <div data-slot="chart-skeleton" data-variant={variant} className={className} style={style} {...props}>
      {marks}
      <Loader aria-label={label ?? CHART_STRINGS[locale].loading} />
    </div>
  );
}

Object.assign(ChartSkeletonBody, { displayName: "Chart.SkeletonBody" });
