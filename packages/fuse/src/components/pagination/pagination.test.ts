import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { paginationStrings } from "./intl";

describe("pagination dictionary", () => {
  it("carries no key beyond the six rows owned by Pagination", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(paginationStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "goToNext",
        "goToPrevious",
        "landmark",
        "morePages",
        "next",
        "previous",
      ]);
    }
  });
});
