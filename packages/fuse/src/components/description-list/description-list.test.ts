import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { DescriptionList } from "./description-list";

const SLOTS = [
  "description-list",
  "description-list-heading",
  "description-list-content",
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
        createElement(DescriptionList.Term, null, "Name"),
        createElement(DescriptionList.Details, null, "Kari Nordmann"),
        createElement(DescriptionList.Term, null, "Meter point"),
        createElement(DescriptionList.Details, null, "7070575000")
      )
    )
  );
}

describe("DescriptionList server boundary", () => {
  it("imports and renders the namespace without a use client directive on the compound", () => {
    const html = markup();
    expect(html).toContain("<div");
    expect(html).toContain("<h2");
    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    expect(html).toContain("Customer");
    expect(html).toContain("Kari Nordmann");
    expect(html).toContain("7070575000");
    for (const slot of SLOTS) {
      expect(html, slot).toContain(`data-slot="${slot}"`);
    }
  });
});

describe("DescriptionList structure", () => {
  // Each part keeps its base class beside a consumer class; a conflicting consumer class wins.
  it.each([
    [
      "Details",
      "text-primary",
      "text-primary",
      "text-foreground",
      (className: string) => createElement(DescriptionList.Details, { className }, "Kari Nordmann"),
    ],
    [
      "Content",
      "max-w-md",
      "grid",
      undefined,
      (className: string) => createElement(DescriptionList.Content, { className }),
    ],
    [
      "Term",
      "font-medium",
      "text-muted-foreground",
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

  it("paints from tokens without a dark variant or raw palette utility", () => {
    const html = markup();
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("text-foreground");
    expect(html).not.toContain("dark:");
    expect(html).not.toContain("destructive");
    expect(html).not.toMatch(RAW_PALETTE_RE);
  });
});
