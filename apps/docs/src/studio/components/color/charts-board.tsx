import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { chartTicks, niceCeiling, shareOf } from "../../lib/chart-layout";
import { ROLE_TILES } from "../../lib/color-roles";
import { PairTile } from "./pair-tile";

const chartsBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    figure: "m-0 flex flex-col gap-3",
    plot: "relative flex h-44 items-end gap-3 border-b border-border pl-10",
    // Layout only: carries its tick's height to the line and the label, outside the bar row.
    tickRow: "contents",
    gridline: "absolute inset-x-0 bottom-(--tick) ml-10 border-t border-dashed border-border",
    tick: "text-xs absolute bottom-(--tick) left-0 w-8 translate-y-1/2 text-end font-mono text-muted-foreground tabular-nums",
    column: "relative flex h-full min-w-0 flex-1 flex-col justify-end",
    bar: "h-(--share) rounded-t-sm",
    labels: "flex gap-3 pl-10",
    label: "text-xs min-w-0 flex-1 text-center font-mono whitespace-nowrap text-muted-foreground",
    tiles: "grid grid-cols-5 gap-x-3 gap-y-5",
    scale: "flex flex-col gap-1.5",
    ramp: "flex h-8 overflow-hidden rounded-md",
    step: "flex-1",
    stepLabels: "flex",
    stepLabel: "text-xs flex-1 text-center font-mono text-muted-foreground",
    swatches: "flex gap-3",
    swatch: "flex flex-1 flex-col gap-1.5",
    chip: "h-8 rounded-md",
  },
  variants: {
    series: {
      1: { bar: "bg-chart-1" },
      2: { bar: "bg-chart-2" },
      3: { bar: "bg-chart-3" },
      4: { bar: "bg-chart-4" },
      5: { bar: "bg-chart-5" },
      6: { bar: "bg-chart-6" },
      7: { bar: "bg-chart-7" },
      8: { bar: "bg-chart-8" },
    },
    // Each step of the ordinal scales, keyed by its token.
    fill: {
      "chart-seq-1": { step: "bg-chart-seq-1" },
      "chart-seq-2": { step: "bg-chart-seq-2" },
      "chart-seq-3": { step: "bg-chart-seq-3" },
      "chart-seq-4": { step: "bg-chart-seq-4" },
      "chart-seq-5": { step: "bg-chart-seq-5" },
      "chart-seq-6": { step: "bg-chart-seq-6" },
      "chart-seq-7": { step: "bg-chart-seq-7" },
      "chart-diverging-1": { step: "bg-chart-diverging-1" },
      "chart-diverging-2": { step: "bg-chart-diverging-2" },
      "chart-diverging-3": { step: "bg-chart-diverging-3" },
      "chart-diverging-4": { step: "bg-chart-diverging-4" },
      "chart-diverging-5": { step: "bg-chart-diverging-5" },
      "chart-diverging-6": { step: "bg-chart-diverging-6" },
      "chart-diverging-7": { step: "bg-chart-diverging-7" },
    },
    role: {
      "chart-sentiment-positive": { chip: "bg-chart-sentiment-positive" },
      "chart-sentiment-negative": { chip: "bg-chart-sentiment-negative" },
      "chart-other": { chip: "bg-chart-other" },
    },
  },
});

const styles = chartsBoard();

type Series = keyof typeof chartsBoard.variants.series;
type Fill = keyof typeof chartsBoard.variants.fill;
type Role = keyof typeof chartsBoard.variants.role;

/** One value per categorical slot, in kWh: a month's use per household, made up for the picture. */
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

const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

/** The diverging steps named by their side of zero, the midpoint between the arms. */
const DIVERGING_LABELS = ["−3", "−2", "−1", "0", "+1", "+2", "+3"] as const;

/** The ordinal scales, each a row of its steps with a label under each. */
const SCALES: readonly {
  name: string;
  caption: string;
  steps: readonly { fill: Fill; label: string }[];
}[] = [
  {
    name: "Sequential ramp",
    caption: "Sequential ramp, least to most",
    steps: STEPS.map((step) => ({ fill: `chart-seq-${step}`, label: `seq-${String(step)}` })),
  },
  {
    name: "Diverging scale",
    caption: "Diverging scale, below and above zero",
    steps: STEPS.map((step, index) => ({
      fill: `chart-diverging-${step}`,
      label: DIVERGING_LABELS[index] ?? "",
    })),
  },
];

const ROLES: readonly Role[] = ["chart-sentiment-positive", "chart-sentiment-negative", "chart-other"];

const CEILING = niceCeiling(Math.max(...SERIES.map(({ value }) => value)));
const TICKS = chartTicks(CEILING, 4);

/**
 * The chart roles. `--chart-1` to `--chart-8` as a plain bar chart in slot order, the slots and
 * Other with the text a direct label on them takes, then the sequential ramp, the diverging
 * scale, and the sentiment pair beside Other. Plain elements colored by the chart utilities, no
 * chart library.
 */
export function ChartsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <figure className={styles.figure()}>
        <Heading level={2} size="lg">
          Categorical slots
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
      <section className={styles.figure()} aria-label="Direct labels">
        <Heading level={2} size="lg">
          Direct labels
        </Heading>
        <div className={styles.tiles()}>
          {ROLE_TILES.charts.map((tile) => (
            <PairTile key={tile.role} tile={tile} />
          ))}
        </div>
      </section>
      {SCALES.map(({ name, caption, steps }) => (
        <section key={name} className={styles.scale()} aria-label={name}>
          <Text variant="muted" size="sm">
            {caption}
          </Text>
          <div className={styles.ramp()}>
            {steps.map(({ fill }) => (
              <span key={fill} aria-hidden className={styles.step({ fill })} />
            ))}
          </div>
          <div aria-hidden className={styles.stepLabels()}>
            {steps.map(({ fill, label }) => (
              <span key={fill} className={styles.stepLabel()}>
                {label}
              </span>
            ))}
          </div>
        </section>
      ))}
      <section className={styles.scale()} aria-label="Sentiment and Other">
        <Text variant="muted" size="sm">
          Sentiment and Other
        </Text>
        <div className={styles.swatches()}>
          {ROLES.map((role) => (
            <div key={role} className={styles.swatch()}>
              <span aria-hidden className={styles.chip({ role })} />
              <span className={styles.stepLabel()}>{role}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
