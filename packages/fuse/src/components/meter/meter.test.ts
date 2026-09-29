import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { getMeterLevel, meterPercentage } from "./get-meter-level";
import { meterStrings } from "./intl";
import { METER_CONSTANTS } from "./meter-constants";
import type { MeterLevel, MeterMode } from "./meter-constants";
import { meterToneCell } from "./meter-tone";
import type { MeterIconName, MeterTone } from "./meter-tone";
import { meterVariants } from "./meter-variants";

const MODES = Object.values(METER_CONSTANTS.MODES);
const LEVELS = Object.values(METER_CONSTANTS.LEVELS);

/** the whole published matrix, one row per mode × level. */
const MATRIX = {
  default: {
    LOW: { tone: "success", icon: "none" },
    MEDIUM: { tone: "warning", icon: "warning" },
    FULL: { tone: "error", icon: "warning" },
    EXCEEDED_MAX_VALUE: { tone: "error", icon: "warning" },
  },
  inverted: {
    LOW: { tone: "error", icon: "none" },
    MEDIUM: { tone: "warning", icon: "none" },
    FULL: { tone: "success", icon: "none" },
    EXCEEDED_MAX_VALUE: { tone: "error", icon: "none" },
  },
  "success-only-when-full": {
    LOW: { tone: "error", icon: "warning" },
    MEDIUM: { tone: "error", icon: "warning" },
    FULL: { tone: "success", icon: "success" },
    EXCEEDED_MAX_VALUE: { tone: "error", icon: "warning" },
  },
  neutral: {
    LOW: { tone: "neutral", icon: "none" },
    MEDIUM: { tone: "neutral", icon: "none" },
    FULL: { tone: "neutral", icon: "none" },
    EXCEEDED_MAX_VALUE: { tone: "neutral", icon: "none" },
  },
} satisfies Record<MeterMode, Record<MeterLevel, { tone: MeterTone; icon: MeterIconName }>>;

const TONE_CLASSES = {
  success: { barFill: "bg-success", labelValue: "text-success" },
  warning: { barFill: "bg-warning", labelValue: "text-warning-foreground" },
  error: { barFill: "bg-error", labelValue: "text-error" },
  neutral: { barFill: "bg-primary", labelValue: "text-foreground" },
} satisfies Record<MeterTone, { barFill: string; labelValue: string }>;

describe("getMeterLevel", () => {
  it.each([
    ["at or below 80 is LOW, including the 80 boundary", 0, 100, 0, "LOW"],
    ["at or below 80 is LOW, including the 80 boundary", 80, 100, 80, "LOW"],
    ["strictly between 80 and 100 is MEDIUM", 81, 100, 81, "MEDIUM"],
    ["strictly between 80 and 100 is MEDIUM", 99, 100, 99, "MEDIUM"],
    ["100 is FULL when max is not exceeded", 100, 100, 100, "FULL"],
    ["a value above max is EXCEEDED_MAX_VALUE", 101, 100, 100, "EXCEEDED_MAX_VALUE"],
    ["a value above max is EXCEEDED_MAX_VALUE", 150, 120, 100, "EXCEEDED_MAX_VALUE"],
  ] as const)("percentage %s (value %d, max %d, percentage %d)", (_case, value, max, percentage, level) => {
    expect(getMeterLevel(value, max, percentage)).toBe(METER_CONSTANTS.LEVELS[level]);
  });

  it("maps max <= min to percentage 0 and LOW", () => {
    expect(meterPercentage(50, 100, 100)).toBe(0);
    expect(meterPercentage(50, 100, 50)).toBe(0);
    expect(getMeterLevel(50, 50, meterPercentage(50, 100, 50))).toBe(METER_CONSTANTS.LEVELS.LOW);
  });
});

describe("meter dictionary", () => {
  it("carries no key beyond the two rows owned by Meter", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(meterStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "success",
        "warning",
      ]);
    }
  });
});

describe("METER_TONE_TABLE", () => {
  it("resolves every tone cell to the published tone and glyph", () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        expect(meterToneCell(mode, level), `${mode}/${level}`).toEqual(MATRIX[mode][level]);
      }
    }
  });

  it("paints every barFill and labelValue class through the tone axis", () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const { tone } = meterToneCell(mode, level);
        const slots = meterVariants({ tone });
        expect(slots.barFill(), `${mode}/${level}`).toContain(TONE_CLASSES[tone].barFill);
        expect(slots.labelValue(), `${mode}/${level}`).toContain(TONE_CLASSES[tone].labelValue);
      }
    }
  });
});
