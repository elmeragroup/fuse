"use client";

/**
 * What a gauge's Root shares with its parts: the model its props describe and the frame that paints
 * every mark from one value per frame. A light leaf, so the scope every chart Root starts can reset
 * it without the gauge's modules.
 */
import { createContext, use } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import type { GaugeFrame } from "./chart-gauge-frame";
import type { ValueFormat } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
import type { GaugeDomain, GaugePlace } from "./layout/gauge";
import type { Sweep, SweepBox } from "./layout/polar-angle";

/** A gauge's reading: none, which Empty shows, or a value with its place against the domain. */
export type GaugeReading =
  | { readonly kind: "empty" }
  | {
      readonly kind: "value";
      /** The true value, which the centre and the meter's text print. */
      readonly value: number;
      /** Its share of the domain at rest, from 0 at `min` to 1 at `max`, clamped, which the loop moves. */
      readonly share: number;
      /** Its offset at rest, in degrees from the sweep's start, clamped to the sweep. */
      readonly offset: number;
      readonly place: GaugePlace;
    };

/** What a gauge's Root's props describe. */
export type GaugeModel = {
  readonly domain: GaugeDomain;
  readonly sweep: Sweep;
  /** The sweep's box in units of the outer radius, whose aspect the cell keeps. */
  readonly box: SweepBox;
  readonly reading: GaugeReading;
  /** Root's value format, which the centre, the meter's text and the ruler's labels read. */
  readonly format: ValueFormat;
  readonly locale: SupportedLocale;
};

/** What a gauge part reads from its Root. */
export type GaugeContextValue = {
  readonly model: GaugeModel;
  readonly frame: GaugeFrame;
};

/**
 * The enclosing gauge Root, or null outside one. Every chart Root's own scope resets it, so a gauge
 * part under another family's Root nested in a gauge throws `part-outside-root`.
 */
export const GaugeContext = createContext<GaugeContextValue | null>(null);

/**
 * Read the enclosing gauge Root.
 *
 * @param part - The calling part's display name, which the error names.
 * @returns The Root's context.
 * @throws {ChartCompositionError} `part-outside-root` when no `GaugeChart.Root` encloses the part.
 */
export function useGaugeContext(part: string): GaugeContextValue {
  const value = use(GaugeContext);
  if (value === null) {
    throw new ChartCompositionError(
      part,
      "part-outside-root",
      "must be used within GaugeChart.Root. Wrap the chart's parts in it."
    );
  }
  return value;
}
