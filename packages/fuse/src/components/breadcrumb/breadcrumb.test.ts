import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { breadcrumbStrings } from "./intl";

describe("breadcrumb dictionary", () => {
  it("carries no key beyond the two rows owned by Breadcrumb", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(breadcrumbStrings.getStringsForLocale(locale)).sort(), locale).toEqual([
        "landmark",
        "more",
      ]);
    }
  });
});
