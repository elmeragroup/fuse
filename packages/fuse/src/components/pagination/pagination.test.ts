import { describe, expect, it } from "vitest";

import { SUPPORTED_LOCALES } from "../../../test/locale-matrix";
import { controlMd } from "../../styles/control-size-md";
import { paginationStrings } from "./intl";
import { paginationVariants } from "./pagination-variants";

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

describe("paginationVariants", () => {
  it("adds chevron-side padding only when direction is passed internally", () => {
    const undirected = paginationVariants();
    expect(undirected.link()).toContain("gap-1");
    expect(undirected.link()).not.toContain("pl-2.5");
    expect(undirected.link()).not.toContain("pr-2.5");
    expect(paginationVariants({ direction: "previous" }).link()).toContain("pl-2.5");
    expect(paginationVariants({ direction: "next" }).link()).toContain("pr-2.5");
  });

  it("keeps the reviewed layout slots and drops the dead item/button slots", () => {
    const slots = paginationVariants();
    expect(Object.keys(slots).sort()).toEqual([
      "base",
      "content",
      "ellipsis",
      "ellipsisIcon",
      "link",
      "linkIcon",
    ]);
    expect(slots.base()).toContain("mx-auto");
    expect(slots.content()).toContain("flex-row");
    expect(slots.linkIcon()).toContain("size-4");
    expect(slots.ellipsis()).toContain(controlMd.square());
    expect(slots.ellipsisIcon()).toContain("size-4");
  });
});
