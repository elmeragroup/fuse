import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { gridListStrings } from "./intl";

const DRAG_COPY = {
  "nb-NO": "Dra for å endre rekkefølge",
  "sv-SE": "Dra för att ändra ordning",
  "en-US": "Drag to reorder",
  "fi-FI": "Vedä järjestääksesi",
} as const;

describe("grid-list dictionary", () => {
  it("owns the locked gridList.drag copy, and no other key, in all four locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(gridListStrings.getStringForLocale("drag", locale), locale).toBe(DRAG_COPY[locale]);
      expect(Object.keys(gridListStrings.getStringsForLocale(locale)), locale).toEqual(["drag"]);
    }
  });
});
