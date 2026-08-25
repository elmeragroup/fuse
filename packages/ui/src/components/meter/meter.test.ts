import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { getMeterLevel, meterPercentage } from "./get-meter-level";
import { meterStrings } from "./intl";
import { METER_CONSTANTS } from "./meter-constants";
import { meterVariants } from "./meter-variants";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "meter.tsx"), "utf8");
const variantsSource = readFileSync(join(here, "meter-variants.ts"), "utf8");
const facade = readFileSync(join(here, "../../meter.ts"), "utf8");

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

  it("carries no key beyond the two rows accessibility.md §4.1 assigns to Meter", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(meterStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "success",
        "warning",
      ]);
    }
  });
});

describe("meterVariants color matrix", () => {
  it("spot-checks each §4 column of barFill classes", () => {
    const fill = (
      mode: (typeof METER_CONSTANTS.MODES)[keyof typeof METER_CONSTANTS.MODES],
      level: (typeof METER_CONSTANTS.LEVELS)[keyof typeof METER_CONSTANTS.LEVELS]
    ) => meterVariants({ mode, level }).barFill();

    expect(fill("default", "LOW")).toContain("bg-success");
    expect(fill("default", "MEDIUM")).toContain("bg-warning");
    expect(fill("default", "FULL")).toContain("bg-error");
    expect(fill("default", "EXCEEDED_MAX_VALUE")).toContain("bg-error");

    expect(fill("inverted", "LOW")).toContain("bg-error");
    expect(fill("inverted", "MEDIUM")).toContain("bg-warning");
    expect(fill("inverted", "FULL")).toContain("bg-success");
    expect(fill("inverted", "EXCEEDED_MAX_VALUE")).toContain("bg-error");

    expect(fill("success-only-when-full", "LOW")).toContain("bg-error");
    expect(fill("success-only-when-full", "MEDIUM")).toContain("bg-error");
    expect(fill("success-only-when-full", "FULL")).toContain("bg-success");
    expect(fill("success-only-when-full", "EXCEEDED_MAX_VALUE")).toContain("bg-error");

    expect(fill("neutral", "LOW")).toContain("bg-primary");
    expect(fill("neutral", "MEDIUM")).toContain("bg-primary");
    expect(fill("neutral", "FULL")).toContain("bg-primary");
    expect(fill("neutral", "EXCEEDED_MAX_VALUE")).toContain("bg-primary");
  });
});

describe("meter source contract", () => {
  it("is a client labeled composite with the five data-slots before any props spread", () => {
    expect(source.startsWith('"use client";')).toBe(true);
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("inverted:");
    expect(source).not.toContain("data-density");
    expect(source).not.toContain("dense:");
    expect(source).not.toContain("comfortable:");
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toMatch(RAW_PALETTE_RE);
    expect(variantsSource).not.toContain("destructive");
    expect(variantsSource).not.toContain("inverted:");
    expect(source).toContain("useElmeraGroupUi");
    expect(source).toContain("locale={locale}");
    expect(source).toContain("Warning");
    expect(source).toContain("CheckCircle");
    expect(source).not.toContain("h-9 ");
    expect(source).not.toContain("px-2.5");
    expect(variantsSource).toContain("h-1.5");
    expect(variantsSource).toContain("rounded-full");
    expect(variantsSource).toContain("bg-muted");
    expect(source).toContain("tabular-nums");
    expect(source).toContain("text-sm font-medium");

    for (const slot of ["meter", "meter-label", "meter-bar", "meter-bar-fill", "meter-value"]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
    }
    expect(source.indexOf('data-slot="meter"')).toBeLessThan(source.indexOf("{...props}"));
  });

  it("keeps meterVariants private and the facade a named re-export", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).not.toContain("export *");
    expect(facade).not.toContain("meterVariants");
    expect(facade).not.toContain("getMeterLevel");
    expect(facade).toContain('export { Meter } from "./components/meter/meter";');
    expect(facade).toContain('export type { MeterProps } from "./components/meter/meter";');
    expect(facade).toContain('export { METER_CONSTANTS } from "./components/meter/meter-constants";');
  });
});
