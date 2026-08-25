"use client";

import { Code } from "@elmeragroup/ui/code";

const listing = `export type MeterReading = {
  meterId: string;
  kwh: number;
  readAt: string;
};

export function parseMeterReadings(raw: string): MeterReading[] {
  const rows = raw.trim().split("\\n");
  const readings: MeterReading[] = [];

  for (const row of rows) {
    const [meterId, kwhText, readAt] = row.split(",");
    if (meterId === undefined || kwhText === undefined || readAt === undefined) {
      throw new RangeError(\`Malformed meter reading row: \${row}\`);
    }
    const kwh = Number(kwhText);
    if (!Number.isFinite(kwh)) {
      throw new RangeError(\`Meter reading kWh is not a number: \${kwhText}\`);
    }
    readings.push({ meterId, kwh, readAt });
  }

  return readings;
}

export function totalKwh(readings: readonly MeterReading[]): number {
  let total = 0;
  for (const reading of readings) {
    total += reading.kwh;
  }
  return total;
}

export function readingsForMeter(
  readings: readonly MeterReading[],
  meterId: string
): MeterReading[] {
  return readings.filter((reading) => reading.meterId === meterId);
}

const sample = \`735999123,142.5,2026-03-12T08:30:00.000Z
735999123,138.0,2026-04-12T08:30:00.000Z
735888111,96.2,2026-03-12T09:00:00.000Z\`;

export const parsed = parseMeterReadings(sample);
export const usage = totalKwh(readingsForMeter(parsed, "735999123"));
`;

export function CodeScroll() {
  return <Code code={listing} aria-label="Meter reading parser source" />;
}
