import { METER_CONSTANTS } from "./meter-constants";
import type { MeterLevel, MeterMode } from "./meter-constants";

/** The color arm the fill and the value label share. */
export type MeterTone = "success" | "warning" | "error" | "neutral";

/** The status glyph in the value span. `none` paints nothing. */
export type MeterIconName = "none" | "warning" | "success";

/** The outcome of one `mode` and one `level`: the recipe arm and the glyph that goes with it. */
type MeterToneCell = {
  tone: MeterTone;
  icon: MeterIconName;
};

const { MODES, LEVELS } = METER_CONSTANTS;

/**
 * Every outcome of a `mode` and a `level`, in one table. The fill and label color arm and the status
 * glyph come from the same cell, so the two cannot cross the `> 80` boundary at different points. A
 * new mode is one row.
 */
const METER_TONE_TABLE = {
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

/** The cell of a `mode` and a `level`, the single lookup Meter and its icon both go through. */
export function meterToneCell(mode: MeterMode, level: MeterLevel): MeterToneCell {
  return METER_TONE_TABLE[mode][level];
}
