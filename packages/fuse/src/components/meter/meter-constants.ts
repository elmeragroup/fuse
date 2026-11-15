const METER_CONSTANTS = {
  // The modes:
  // - `default`: a full bar shows the error colors.
  // - `inverted`: a full bar shows the success colors.
  // - `success-only-when-full`: a full bar shows the success colors, and every other value shows
  //   the error colors.
  // - `neutral`: the bar shows the primary color at every level, with no good or bad meaning and
  //   no icon.
  MODES: {
    DEFAULT: "default",
    INVERTED: "inverted",
    SUCCESS_ONLY_WHEN_FULL: "success-only-when-full",
    NEUTRAL: "neutral",
  },
  LEVELS: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    FULL: "FULL",
    EXCEEDED_MAX_VALUE: "EXCEEDED_MAX_VALUE",
  },
} as const;

export { METER_CONSTANTS };

export type MeterMode = (typeof METER_CONSTANTS.MODES)[keyof typeof METER_CONSTANTS.MODES];
export type MeterLevel = (typeof METER_CONSTANTS.LEVELS)[keyof typeof METER_CONSTANTS.LEVELS];
