import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { getMeterLevel, meterPercentage } from "./get-meter-level";
import { meterStrings } from "./intl";
import { METER_CONSTANTS } from "./meter-constants";
import type { MeterLevel, MeterMode } from "./meter-constants";
import { METER_TONE_TABLE, meterToneCell } from "./meter-tone";
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

const WARNING_COPY = {
  "nb-NO": "Advarsel",
  "sv-SE": "Varning",
  "en-US": "Warning",
  "fi-FI": "Varoitus",
} as const;

const SUCCESS_COPY = {
  "nb-NO": "Vellykket",
  "sv-SE": "Lyckades",
  "en-US": "Success",
  "fi-FI": "Onnistui",
} as const;

describe("getMeterLevel", () => {
  it("treats percentage at or below 80 as LOW, including the 80 boundary", () => {
    expect(getMeterLevel(0, undefined, 0)).toBe(METER_CONSTANTS.LEVELS.LOW);
    expect(getMeterLevel(80, undefined, 80)).toBe(METER_CONSTANTS.LEVELS.LOW);
  });

  it("treats percentage strictly between 80 and 100 as MEDIUM", () => {
    expect(getMeterLevel(81, undefined, 81)).toBe(METER_CONSTANTS.LEVELS.MEDIUM);
    expect(getMeterLevel(99, undefined, 99)).toBe(METER_CONSTANTS.LEVELS.MEDIUM);
  });

  it("treats percentage 100 as FULL when maxValue is not exceeded", () => {
    expect(getMeterLevel(100, undefined, 100)).toBe(METER_CONSTANTS.LEVELS.FULL);
    expect(getMeterLevel(100, 100, 100)).toBe(METER_CONSTANTS.LEVELS.FULL);
  });

  it("returns EXCEEDED_MAX_VALUE only when maxValue is explicit and value exceeds it", () => {
    expect(getMeterLevel(101, 100, 100)).toBe(METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE);
    expect(getMeterLevel(150, 120, 100)).toBe(METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE);
  });

  it("never returns EXCEEDED_MAX_VALUE when maxValue is omitted", () => {
    expect(getMeterLevel(150, undefined, 100)).toBe(METER_CONSTANTS.LEVELS.FULL);
    expect(getMeterLevel(200, undefined, 100)).not.toBe(METER_CONSTANTS.LEVELS.EXCEEDED_MAX_VALUE);
  });

  it("maps max <= min to percentage 0 and LOW", () => {
    expect(meterPercentage(50, 100, 100)).toBe(0);
    expect(meterPercentage(50, 100, 50)).toBe(0);
    expect(getMeterLevel(50, undefined, meterPercentage(50, 100, 50))).toBe(METER_CONSTANTS.LEVELS.LOW);
  });
});

describe("meter dictionary", () => {
  it("owns the locked meter.warning and meter.success copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(meterStrings.getStringForLocale("warning", locale), locale).toBe(WARNING_COPY[locale]);
      expect(meterStrings.getStringForLocale("success", locale), locale).toBe(SUCCESS_COPY[locale]);
    }
  });

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
  it("carries one cell for every mode × level, so adding a mode is one row", () => {
    expect(Object.keys(METER_TONE_TABLE).sort()).toEqual([...MODES].sort());
    for (const mode of MODES) {
      expect(Object.keys(METER_TONE_TABLE[mode]).sort(), mode).toEqual([...LEVELS].sort());
    }
  });

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

  it("moves the glyph and the fill across the > 80 boundary in the same cell", () => {
    for (const mode of MODES) {
      const atEighty = meterToneCell(mode, getMeterLevel(80, undefined, meterPercentage(80, 0, 100)));
      const pastEighty = meterToneCell(mode, getMeterLevel(81, undefined, meterPercentage(81, 0, 100)));
      expect(atEighty, mode).toBe(METER_TONE_TABLE[mode].LOW);
      expect(pastEighty, mode).toBe(METER_TONE_TABLE[mode].MEDIUM);
    }
  });

  it("never pairs a success fill with a warning glyph", () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const cell = meterToneCell(mode, level);
        expect(cell.tone === "success" && cell.icon === "warning", `${mode}/${level}`).toBe(false);
      }
    }
  });
});
