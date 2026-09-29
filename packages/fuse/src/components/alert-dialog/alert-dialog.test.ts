import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { alertDialogStrings } from "./intl";

describe("alert-dialog dictionary", () => {
  it("carries no key beyond the one row owned by AlertDialog", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(alertDialogStrings.getStringsForLocale(locale)), locale).toEqual(["cancel"]);
    }
  });
});
