import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { DescriptionList } from "./description-list";

const SLOTS = [
  "description-list",
  "description-list-heading",
  "description-list-content",
  "description-list-item",
  "description-list-term",
  "description-list-details",
] as const;

function markup(): string {
  return renderToStaticMarkup(
    createElement(
      DescriptionList.Root,
      null,
      createElement(DescriptionList.Heading, null, "Customer"),
      createElement(
        DescriptionList.Content,
        null,
        createElement(
          DescriptionList.Item,
          null,
          createElement(DescriptionList.Term, null, "Name"),
          createElement(DescriptionList.Details, null, "Kari Nordmann")
        ),
        createElement(
          DescriptionList.Item,
          null,
          createElement(DescriptionList.Term, null, "Meter point"),
          createElement(DescriptionList.Details, null, "7070575000")
        )
      )
    )
  );
}

describe("DescriptionList slots", () => {
  it("stamps each part's data-slot", () => {
    const html = markup();
    for (const slot of SLOTS) {
      expect(html, slot).toContain(`data-slot="${slot}"`);
    }
  });
});

describe("DescriptionList structure", () => {
  // Each part keeps its base class beside a consumer class; a conflicting consumer class wins.
  it.each([
    [
      "Content",
      "max-w-md",
      "grid",
      undefined,
      (className: string) => createElement(DescriptionList.Content, { className }),
    ],
    [
      "Item",
      "border-0",
      "grid",
      "border-t",
      (className: string) => createElement(DescriptionList.Item, { className }),
    ],
    [
      "Term",
      "font-medium",
      "col-start-1",
      undefined,
      (className: string) => createElement(DescriptionList.Term, { className }, "Name"),
    ],
    [
      "Heading",
      "mb-4",
      "font-heading",
      undefined,
      (className: string) => createElement(DescriptionList.Heading, { className }, "Customer"),
    ],
  ] as const)("merges className on %s", (_part, className, kept, replaced, element) => {
    const html = renderToStaticMarkup(element(className));
    expect(html).toContain(className);
    expect(html).toContain(kept);
    if (replaced !== undefined) {
      expect(html).not.toContain(replaced);
    }
  });

  it("paints without a dark variant or raw palette utility", () => {
    const html = markup();
    expect(html).not.toContain("dark:");
    expect(html).not.toContain("destructive");
    expect(html).not.toMatch(RAW_PALETTE_RE);
  });
});

describe("DescriptionList layouts", () => {
  function list(layout?: "responsive" | "inline"): string {
    return renderToStaticMarkup(
      createElement(DescriptionList.Content, layout === undefined ? null : { layout })
    );
  }

  it.each([
    [undefined, "responsive", "sm:text-sm/6", "gap-y-(--surface-gap-sm)"],
    ["responsive", "responsive", "sm:text-sm/6", "gap-y-(--surface-gap-sm)"],
    ["inline", "inline", "gap-y-(--surface-gap-sm)", "sm:text-sm/6"],
  ] as const)(
    "writes layout=%s as data-layout=%s with its own type and spacing",
    (layout, written, present, absent) => {
      const html = list(layout);
      expect(html).toContain(`data-layout="${written}"`);
      expect(html).toContain(present);
      expect(html).not.toContain(absent);
      expect(html).not.toContain(" layout=");
    }
  );
});
