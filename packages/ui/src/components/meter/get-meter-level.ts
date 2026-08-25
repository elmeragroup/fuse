import { METER_CONSTANTS } from "./meter-constants";
import type { MeterLevel } from "./meter-constants";

export function meterPercentage(value: number, min: number, max: number): number {
  return max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
}

export function getMeterLevel(value: number, maxValue: number | undefined, percentage: number): MeterLevel {
  if (maxValue !== undefined && value > maxValue) {
    return METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE;
  }

  if (percentage === 100) {
    return METER_CONSTANTS.LEVELS.FULL;
  }

  if (percentage > 80) {
    return METER_CONSTANTS.LEVELS.MEDIUM;
  }

  return METER_CONSTANTS.LEVELS.LOW;
}
