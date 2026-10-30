import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { ROLE_TILES } from "../../lib/color-roles";
import { PairTile } from "./pair-tile";

const chartsBoard = tv({
  slots: {
    root: "flex flex-col gap-6 p-8",
    figure: "m-0 flex flex-col gap-3",
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

type Fill = keyof typeof chartsBoard.variants.fill;
type Role = keyof typeof chartsBoard.variants.role;

/** One value per categorical slot, in kWh: a month's use per household, made up for the picture. */
const SLOTS = [84, 62, 71, 45, 93, 38, 56, 27] as const;

/** The categorical roles in slot order. */
const ROLES_IN_ORDER = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
] as const;

const KEYS = ROLES_IN_ORDER.map((role) => role.replace("-", ""));

const kwh = { preset: "energy", unit: "kWh" } as const;

const SLOT_CONFIG: ChartConfig = Object.fromEntries(
  ROLES_IN_ORDER.map((role, index) => [KEYS[index] ?? role, { label: role, color: role, format: kwh }])
);

const SLOT_ROW = [
  { month: "October", ...Object.fromEntries(KEYS.map((key, index) => [key, SLOTS[index] ?? 0])) },
];

/** Four series over twelve months, made up for the picture, so the first four slots draw as lines. */
const TRENDS = [
  [42, 46, 51, 49, 55, 60, 58, 63, 61, 66, 70, 68],
  [30, 33, 31, 36, 38, 35, 40, 43, 41, 45, 44, 48],
  [55, 52, 50, 47, 49, 45, 43, 40, 42, 38, 36, 35],
  [18, 22, 20, 25, 27, 26, 30, 29, 33, 31, 35, 37],
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const LINE_KEYS = KEYS.slice(0, TRENDS.length);

const LINE_CONFIG: ChartConfig = Object.fromEntries(
  LINE_KEYS.map((key) => [key, SLOT_CONFIG[key] ?? { label: key, color: "chart-1" }])
);

const LINE_ROWS = MONTHS.map((month, index) => ({
  month,
  ...Object.fromEntries(LINE_KEYS.map((key, series) => [key, TRENDS[series]?.[index] ?? 0])),
}));

/** A price day that crosses zero, so the diverging scale shows both arms, and its own rise for the ramp. */
const PRICE = [12, 8, 3, -2, -6, -9, -5, 1, 7, 14, 19, 16, 10, 4];

const SCALE_ROWS = PRICE.map((price, index) => ({
  hour: `${String(index).padStart(2, "0")}`,
  price,
  level: index * 7,
}));

const SEQ_CONFIG = { level: { label: "chart-seq", color: "chart-seq" } } as const satisfies ChartConfig;

const DIVERGING_CONFIG = {
  price: { label: "chart-diverging", color: "chart-diverging" },
} as const satisfies ChartConfig;

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

/**
 * The chart roles. `--chart-1` to `--chart-8` as Fuse bars side by side and the first four as
 * lines, the slots and Other with the text a direct label on them takes, the sequential ramp and
 * the diverging scale as swatches and as the areas that paint them, and the sentiment pair beside
 * Other.
 */
export function ChartsBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <figure className={styles.figure()}>
        <Heading level={2} size="lg">
          Categorical slots
        </Heading>
        <Chart.Root
          data={SLOT_ROW}
          config={SLOT_CONFIG}
          xKey="month"
          data-intro="none"
          aria-label="The eight categorical slots">
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.XAxis />
          <Chart.BarGroup series={KEYS}>
            {KEYS.map((key) => (
              <Chart.Bar key={key} dataKey={key} />
            ))}
          </Chart.BarGroup>
          <Chart.Legend />
        </Chart.Root>
        <Chart.Root
          data={LINE_ROWS}
          config={LINE_CONFIG}
          xKey="month"
          xScale="point"
          data-intro="none"
          aria-label="The first four slots as lines">
          <Chart.Grid />
          <Chart.YAxis />
          <Chart.XAxis />
          {LINE_KEYS.map((key) => (
            <Chart.Line key={key} dataKey={key} />
          ))}
        </Chart.Root>
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
      <figure className={styles.figure()}>
        <Text variant="muted" size="sm">
          The scales on a value: chart-seq rising, chart-diverging across zero
        </Text>
        <Chart.Root
          data={SCALE_ROWS}
          config={SEQ_CONFIG}
          xKey="hour"
          data-intro="none"
          aria-label="chart-seq on a rising value">
          <Chart.Area
            dataKey="level"
            variant="solid"
            curve="step-after"
            style={{ "--chart-area-opacity": 0.6 }}
          />
          <Chart.Line dataKey="level" curve="step-after" />
        </Chart.Root>
        <Chart.Root
          data={SCALE_ROWS}
          config={DIVERGING_CONFIG}
          xKey="hour"
          data-intro="none"
          aria-label="chart-diverging across zero">
          <Chart.Area
            dataKey="price"
            variant="solid"
            curve="step-after"
            style={{ "--chart-area-opacity": 0.6 }}
          />
          <Chart.Line dataKey="price" curve="step-after" />
        </Chart.Root>
      </figure>
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
