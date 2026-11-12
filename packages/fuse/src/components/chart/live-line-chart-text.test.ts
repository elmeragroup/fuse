// A live reading's words. Unit under test: liveTimeText and liveDescription. Oracles: nb-NO's CLDR
// time with three fractional digits, written by hand: 12:00:00.123 UTC on 16 October 2026 is
// 14:00:00,123 in Oslo; and description sentences written by hand in the family's wording, the
// unit named once after the value's name, as `Forbruk i kilowattimer: lavest 0,33`.
import { describe, expect, it } from "vitest";

import { liveDescription, liveTimeText } from "./live-line-chart-text";
import type { LiveText } from "./live-line-chart-text";

const NOON = Date.UTC(2026, 9, 16, 12);
const SECOND = 1_000;

describe("liveTimeText", () => {
  it("prints a reading's own instant, milliseconds and all, in Intl options that name them", () => {
    const text = {
      locale: "nb-NO",
      timeZone: "Europe/Oslo",
      timeFormat: { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 },
    } as const;
    expect(liveTimeText(text, NOON + 123, "full")).toEqual({ text: "14:00:00,123", spoken: "14:00:00,123" });
    expect(liveTimeText(text, NOON + 456, "tick").text).toBe("14:00:00,456");
  });
});

describe("liveDescription", () => {
  const text: LiveText = {
    locale: "nb-NO",
    timeZone: "Europe/Oslo",
    timeFormat: "time-seconds",
    valueFormat: { preset: "energy", unit: "kWh" },
    label: "Forbruk",
  };

  it("names the unit once after the value's name, and speaks every value after it unitless", () => {
    const points = [
      { time: NOON, value: 0.5 },
      { time: NOON + 10 * SECOND, value: 0.33 },
      { time: NOON + 20 * SECOND, value: 0.75 },
    ];
    expect(liveDescription(text, points, 30 * SECOND, 0.6)).toBe(
      "Fra kl. 14:00:00 til kl. 14:00:20, 3 punkter. Forbruk i kilowattimer: lavest 0,33 kl. 14:00:10, høyest 0,75 kl. 14:00:20. Siste verdi 0,6 kl. 14:00:20."
    );
  });

  it("starts a one-reading description as a sentence", () => {
    expect(liveDescription(text, [{ time: NOON, value: 0.5 }], 30 * SECOND, 0.5)).toBe(
      "Kl. 14:00:00, 1 punkt. Forbruk i kilowattimer: lavest 0,5 kl. 14:00:00, høyest 0,5 kl. 14:00:00. Siste verdi 0,5 kl. 14:00:00."
    );
  });
});
