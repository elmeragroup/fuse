import { Sparkline } from "@elmeragroup/fuse/chart";

const ORE = [61.2, 58.4, 55.9, 54.1, 57.3, 72.8, 104.5, 131.9, 118.2, 96.4, 88.7, 84.1];
const START = new Date(Date.UTC(2026, 9, 16, 22));
const PRICE = { preset: "unit-price", currency: "NOK", minor: true, vat: "included" } as const;

/**
 * Each variant from a server component, with no client JavaScript: a line against a flat fixed
 * price, an area that reaches 0, and bars. Each name ends in its range sentence.
 */
export function SparklineVariants() {
  return (
    <div className="max-w-sm grid w-full gap-4">
      <Sparkline
        aria-label="Spot price against Norgespris"
        data={ORE}
        locale="en-US"
        format={PRICE}
        reference={50}
        emphasis="max"
        start={START}
        interval="hour"
        timeZone="Europe/Oslo"
      />
      <Sparkline
        aria-label="Spot price, area"
        data={ORE}
        locale="en-US"
        format={PRICE}
        variant="area"
        color="chart-2"
      />
      <Sparkline
        aria-label="Spot price, bars"
        data={ORE}
        locale="en-US"
        format={PRICE}
        variant="bar"
        color="chart-3"
      />
    </div>
  );
}
