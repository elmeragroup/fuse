import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { popoverInfoButtonStrings } from "./intl";

describe("popover-info-button dictionary", () => {
  it("carries no key beyond the row owned by PopoverInfoButton", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(popoverInfoButtonStrings.getStringsForLocale(locale)), locale).toEqual([
        "moreInformation",
      ]);
    }
  });
});
