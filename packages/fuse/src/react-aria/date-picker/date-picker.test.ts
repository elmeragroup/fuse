import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { datePickerStrings } from "./intl";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

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

describe("date-picker package surface", () => {
  it("is a subpath-only react-aria entry publishing exactly the three documented names", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/date-picker");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"]);
    expect(entry?.sourceFile).toBe("src/react-aria/date-picker.ts");
    for (const name of ["DatePicker", "DatePickerPresetGroup", "DatePickerPresetItem"]) {
      expect(root?.runtimeExports).not.toContain(name);
    }
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/date-picker");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("date-picker");
  }, 30_000);
});
