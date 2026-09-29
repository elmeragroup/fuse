import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { datePickerStrings } from "./intl";

const PRESETS_COPY = {
  "nb-NO": "Datoforvalg",
  "sv-SE": "Datumalternativ",
  "en-US": "Date presets",
  "fi-FI": "Päivämäärän pikavalinnat",
} as const;

describe("date-picker dictionary", () => {
  it("owns the locked datePicker.presets copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(datePickerStrings.getStringForLocale("presets", locale), locale).toBe(PRESETS_COPY[locale]);
    }
  });

  it("carries no key beyond the single row owned by DatePicker", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(datePickerStrings.getStringsForLocale(locale)), locale).toEqual(["presets"]);
    }
  });
});
