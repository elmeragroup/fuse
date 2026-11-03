/**
 * Bar charts the chart browser tests render. The rows come from committed Elhub files, and every
 * expectation the tests compare with is written by hand in the test.
 */
import type { ReactNode } from "react";

import { Chart } from "../../src/components/chart/chart-namespace";
import type { ChartConfig, ChartIntro } from "../../src/components/chart/chart-types";
import { LocaleProvider } from "../../src/intl/locale-context";
import type { SupportedLocale } from "../../src/intl/locale-context";
import { S06_HOURS } from "./elhub-rows";

/** S06's two series, household and cabin per metering point. */
export const S06_CONFIG = {
  household: { label: "Husholdning", color: "chart-1", format: { preset: "energy", unit: "kWh" } },
  cabin: { label: "Hytte", color: "chart-2", format: { preset: "energy", unit: "kWh" } },
} as const satisfies ChartConfig;

/**
 * S06 as an hourly bar chart in Oslo, with a button before and after it. Its entrance is off
 * unless a test names an origin, so marks read at rest from the first paint.
 *
 * @param props - The locale, the Root's orientation and entrance, and the parts inside the Root.
 * @returns The page.
 */
export function S06Chart({
  locale = "nb-NO",
  orientation,
  intro = "none",
  children,
}: {
  readonly locale?: SupportedLocale;
  readonly orientation?: "vertical" | "horizontal";
  readonly intro?: ChartIntro;
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale={locale}>
      <button type="button">før</button>
      <Chart.Root
        data={S06_HOURS}
        config={S06_CONFIG}
        xKey="start"
        interval="hour"
        timeZone="Europe/Oslo"
        orientation={orientation}
        data-intro={intro}
        aria-label="Forbruk per time">
        {children ?? <Chart.Bar dataKey="household" />}
      </Chart.Root>
      <button type="button">etter</button>
    </LocaleProvider>
  );
}
