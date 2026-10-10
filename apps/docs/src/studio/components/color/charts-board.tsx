import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { chartTicks, niceCeiling, shareOf } from "../../lib/chart-layout";

const chartsBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    figure: "m-0 flex flex-col gap-3",
    plot: "relative flex h-56 items-end gap-3 border-b border-border pl-10",
    // Layout only: carries its tick's height to the line and the label, outside the bar row.
    tickRow: "contents",
    gridline: "absolute inset-x-0 bottom-(--tick) ml-10 border-t border-dashed border-border",
    tick: "text-xs absolute bottom-(--tick) left-0 w-8 translate-y-1/2 text-end font-mono text-muted-foreground",
    column: "relative flex h-full min-w-0 flex-1 flex-col justify-end",
    bar: "h-(--share) rounded-t-sm",
    labels: "flex gap-3 pl-10",
    label: "text-xs min-w-0 flex-1 text-center font-mono whitespace-nowrap text-muted-foreground",
    ramp: "flex h-8 overflow-hidden rounded-md",
    step: "flex-1",
  },
  variants: {
    series: {
      1: { bar: "bg-chart-1", step: "bg-chart-1" },
      2: { bar: "bg-chart-2", step: "bg-chart-2" },
      3: { bar: "bg-chart-3", step: "bg-chart-3" },
      4: { bar: "bg-chart-4", step: "bg-chart-4" },
      5: { bar: "bg-chart-5", step: "bg-chart-5" },
      6: { bar: "bg-chart-6", step: "bg-chart-6" },
      7: { bar: "bg-chart-7", step: "bg-chart-7" },
      8: { bar: "bg-chart-8", step: "bg-chart-8" },
    },
  },
});

const styles = chartsBoard();

type Series = keyof typeof chartsBoard.variants.series;

/** One value per chart role, in kWh: a month's use per household, made up for the picture. */
const SERIES: readonly { series: Series; value: number }[] = [
  { series: 1, value: 84 },
  { series: 2, value: 62 },
  { series: 3, value: 71 },
  { series: 4, value: 45 },
  { series: 5, value: 93 },
  { series: 6, value: 38 },
  { series: 7, value: 56 },
  { series: 8, value: 27 },
];

const CEILING = niceCeiling(Math.max(...SERIES.map(({ value }) => value)));
const TICKS = chartTicks(CEILING, 4);

/**
 * `--chart-1` to `--chart-8` as a plain bar chart, one labelled bar per series, with the eight
 * roles as one ramp below it. Plain elements colored by the chart utilities, no chart library.
 */
export function ChartsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <figure className={styles.figure()}>
        <Heading level={2} size="lg">
          Use per series
        </Heading>
        <div className={styles.plot()}>
          {TICKS.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={styles.tickRow()}
              style={{ "--tick": `${String(shareOf(tick, CEILING))}%` }}>
              <span className={styles.gridline()} />
              <span className={styles.tick()}>{tick}</span>
            </div>
          ))}
          {SERIES.map(({ series, value }) => (
            <div key={series} className={styles.column()}>
              <div
                role="img"
                aria-label={`--chart-${String(series)}: ${String(value)} kWh`}
                className={styles.bar({ series })}
                style={{ "--share": `${String(shareOf(value, CEILING))}%` }}
                data-series={series}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className={styles.labels()}>
          {SERIES.map(({ series }) => (
            <span key={series} className={styles.label()}>{`chart-${String(series)}`}</span>
          ))}
        </div>
      </figure>
      <section className={styles.figure()} aria-label="Chart ramp">
        <Text variant="muted" size="sm">
          The eight chart roles in order
        </Text>
        <div className={styles.ramp()}>
          {SERIES.map(({ series }) => (
            <span key={series} aria-hidden className={styles.step({ series })} />
          ))}
        </div>
      </section>
    </div>
  );
}
