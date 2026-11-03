/**
 * Chart test rows built from the committed Elhub files. Each value is one hour's `quantityKwh` over
 * `meteringPointCount`, the per-meter consumption SCENARIOS.md's household rule names. The rows are
 * inputs, never expectations.
 */
import fallBack from "../../src/components/chart/format/fixtures/elhub/no1-consumption-2025-10-26.json" with { type: "json" };
import normalDay from "../../src/components/chart/format/fixtures/elhub/no1-consumption-2026-10-16.json" with { type: "json" };

/** One hour of NO1 consumption per metering point. */
export type HourRow = { readonly start: Date; readonly household: number; readonly cabin: number };

type ElhubRow = {
  readonly startTime: string;
  readonly consumptionGroup: string;
  readonly quantityKwh: number;
  readonly meteringPointCount: number;
};

function hours(rows: readonly ElhubRow[]): HourRow[] {
  const perMeter = (group: string) =>
    new Map(
      rows
        .filter((row) => row.consumptionGroup === group)
        .map((row) => [Date.parse(row.startTime), row.quantityKwh / row.meteringPointCount] as const)
    );
  const household = perMeter("household");
  const cabin = perMeter("cabin");
  return [...household.keys()]
    .sort((a, b) => a - b)
    .map((start) => ({
      start: new Date(start),
      household: household.get(start) ?? 0,
      cabin: cabin.get(start) ?? 0,
    }));
}

/** S06's normal day, 24 Oslo hours of 2026-10-16. */
export const S06_HOURS = hours(normalDay.rows);

/** The Oslo fall-back day, 25 hours of 2025-10-26. */
export const FALL_BACK_HOURS = hours(fallBack.rows);
