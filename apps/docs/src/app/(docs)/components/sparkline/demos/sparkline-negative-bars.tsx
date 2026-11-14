"use client";

import { Sparkline } from "@elmeragroup/fuse/chart";

// NO2 spot price per hour from 23:00 on 16 October 2026 Oslo time, in øre per kWh.
const NO2 = [21.4, 15.2, 9.6, 2.4, -4.2, -8.3, -3.4, 6.8, 18.2, 31.3, 24.1, 16.2];

export function SparklineNegativeBars() {
  return (
    <Sparkline
      aria-label="Spot price in NO2 tonight"
      data={NO2}
      locale="en-US"
      format={{ preset: "unit-price", currency: "NOK", minor: true, vat: "included" }}
      start={new Date(Date.UTC(2026, 9, 16, 21))}
      interval="hour"
      timeZone="Europe/Oslo"
      variant="bar"
    />
  );
}
