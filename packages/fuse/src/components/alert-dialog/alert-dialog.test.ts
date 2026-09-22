import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { alertDialogStrings } from "./intl";

const CANCEL_COPY = {
  "nb-NO": "Avbryt",
  "sv-SE": "Avbryt",
  "en-US": "Cancel",
  "fi-FI": "Peruuta",
} as const;

describe("alert-dialog dictionary", () => {
  it("owns the locked alertDialog.cancel copy in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(alertDialogStrings.getStringForLocale("cancel", locale), locale).toBe(CANCEL_COPY[locale]);
    }
  });

  it("carries no key beyond the one row owned by AlertDialog", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(alertDialogStrings.getStringsForLocale(locale)), locale).toEqual(["cancel"]);
    }
  });
});
