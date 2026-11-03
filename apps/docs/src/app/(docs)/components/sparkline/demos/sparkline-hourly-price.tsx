"use client";

import { Sparkline } from "@elmeragroup/fuse/chart";

const ORE = [61.2, 58.4, 55.9, 54.1, 57.3, 72.8, 104.5, 131.9, 118.2, 96.4, 88.7, 84.1];

export function SparklineHourlyPrice() {
  return (
    <Sparkline
      aria-label="Spot price tonight"
      data={ORE}
      locale="en-US"
      format={{ preset: "unit-price", currency: "NOK", minor: true, vat: "included" }}
      variant="line"
      curve="step-after"
      emphasis="last"
      start={new Date(Date.UTC(2026, 9, 16, 22))}
      interval="hour"
      timeZone="Europe/Oslo"
    />
  );
}
