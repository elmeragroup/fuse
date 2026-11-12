import { Sparkline } from "@elmeragroup/fuse/chart";

const NO2 = [21.4, 15.2, 9.6, 2.4, -4.2, -8.3, -3.4, 6.8, 18.2, 31.3, 24.1, 16.2];
/** A house with solar panels exporting through the middle of the day, in kWh per hour. */
const EXPORT = [-0.4, -1.1, -2.3, -3.2, -3.8, -4.1, -3.9, -3.1, -2.2, -1.2, -0.6, -0.3];
const START = new Date(Date.UTC(2026, 9, 16, 22));
const PRICE = { preset: "unit-price", currency: "NOK", minor: true, vat: "excluded" } as const;

/**
 * Values below 0, from a server component. Bars hang negative values below the zero line with their
 * far corners rounded. An area fades from its values toward 0 on both sides of the zero line, and
 * upward when every value is negative.
 */
export function SparklineNegative() {
  return (
    <div className="max-w-sm grid w-full grid-cols-1 gap-4">
      <Sparkline
        aria-label="Spot price in NO2, bars"
        data={NO2}
        locale="en-US"
        format={PRICE}
        variant="bar"
        color="chart-2"
        start={START}
        interval="hour"
        timeZone="Europe/Oslo"
      />
      <Sparkline
        aria-label="Spot price in NO2, area"
        data={NO2}
        locale="en-US"
        format={PRICE}
        variant="area"
        emphasis="min"
        start={START}
        interval="hour"
        timeZone="Europe/Oslo"
      />
      <Sparkline
        aria-label="Net use while exporting"
        data={EXPORT}
        locale="en-US"
        format={{ preset: "energy", unit: "kWh" }}
        variant="area"
        color="chart-3"
      />
    </div>
  );
}
