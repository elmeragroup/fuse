import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { overlayCloseStrings } from "./intl";

describe("overlay close dictionary", () => {
  it("carries no key beyond the one row owned by the overlay family", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(overlayCloseStrings.getStringsForLocale(locale)), locale).toEqual(["close"]);
    }
  });
});
