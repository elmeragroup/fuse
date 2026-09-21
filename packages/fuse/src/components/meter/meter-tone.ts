import { METER_CONSTANTS } from "./meter-constants";
import type { MeterLevel, MeterMode } from "./meter-constants";

/** Color arm the fill and the value label share. */
export type MeterTone = "success" | "warning" | "error" | "neutral";

/** Status glyph in the value span; `none` paints nothing. */
export type MeterIconName = "none" | "warning" | "success";

/** One `mode` × `level` outcome: the recipe arm plus the glyph that goes with it. */
export type MeterToneCell = {
  tone: MeterTone;
  icon: MeterIconName;
};

const { MODES, LEVELS } = METER_CONSTANTS;

/**
 * The whole `mode` × `level` outcome in one place: the fill/label
 * color arm and the status glyph are read from the same cell, so the two cannot cross
 * the `> 80` boundary at different points. Adding a mode is one row.
 */
export const METER_TONE_TABLE = {
  [MODES.DEFAULT]: {
    [LEVELS.LOW]: { tone: "success", icon: "none" },
    [LEVELS.MEDIUM]: { tone: "warning", icon: "warning" },
    [LEVELS.FULL]: { tone: "error", icon: "warning" },
    [LEVELS.EXCEEDED_MAX_VALUE]: { tone: "error", icon: "warning" },
  },
  [MODES.INVERTED]: {
    [LEVELS.LOW]: { tone: "error", icon: "none" },
    [LEVELS.MEDIUM]: { tone: "warning", icon: "none" },
    [LEVELS.FULL]: { tone: "success", icon: "none" },
    [LEVELS.EXCEEDED_MAX_VALUE]: { tone: "error", icon: "none" },
  },
  [MODES.SUCCESS_ONLY_WHEN_FULL]: {
    [LEVELS.LOW]: { tone: "error", icon: "warning" },
    [LEVELS.MEDIUM]: { tone: "error", icon: "warning" },
    [LEVELS.FULL]: { tone: "success", icon: "success" },
    [LEVELS.EXCEEDED_MAX_VALUE]: { tone: "error", icon: "warning" },
  },
  [MODES.NEUTRAL]: {
    [LEVELS.LOW]: { tone: "neutral", icon: "none" },
    [LEVELS.MEDIUM]: { tone: "neutral", icon: "none" },
    [LEVELS.FULL]: { tone: "neutral", icon: "none" },
    [LEVELS.EXCEEDED_MAX_VALUE]: { tone: "neutral", icon: "none" },
  },
} as const satisfies Record<MeterMode, Record<MeterLevel, MeterToneCell>>;

/** The single lookup Meter and its icon both go through. */
export function meterToneCell(mode: MeterMode, level: MeterLevel): MeterToneCell {
  return METER_TONE_TABLE[mode][level];
}
