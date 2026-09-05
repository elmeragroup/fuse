const METER_CONSTANTS = {
  // modes documentation
  // default: full bar equals error colors
  // inverted: full bar equals success colors
  // success-only-when-full: full bar equals success colors all other values equals error colors
  // neutral: primary-colored bar at every level (no good/bad semantics, no icon)
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
